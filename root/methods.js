const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");
// const { KMSClient, DecryptCommand } = require("@aws-sdk/client-kms");
const async = require("async");
const axios = require("axios");
const fs = require("fs");
const { spawn } = require("child_process");

let hexTest = new RegExp(/\.hex$/);

const Decrypt = function (blob, next) {
  const client = new KMSClient();
  const command = new DecryptCommand({
    CiphertextBlob: blob,
    // EncryptionAlgorithm: "",
    // KeyId: ""
  });
  client
    .send(command)
    .then((response) => {
      next(null, response);
    })
    .catch((error) => {
      next(error);
    });
};

const LoadParameter = function (path, next) {
  const client = new SSMClient();
  const command = new GetParameterCommand({
    Name: path,
    WithDecryption: true,
  });

  client
    .send(command)
    .then((result) => {
      if (result.Parameter.Type == "SecureString") {
        let buff = Buffer.from(result.Parameter.Value, "base64");
        result.Parameter.Value = buff.toString();
      }
      next(null, result);
    })
    .catch((error) => {
      next(error);
    });
};

const ResponseConstructor = function (err, event, barrel, result) {
  this.statusCode = 200;
  this.headers = {
    // 'Cache-Control': 'max-age=0',
    "Cache-Control": "no-cache,no-store",
    "Content-Type": "application/json",
  };
  this.body = {};

  if (!isNaN(parseInt(process.env.MAX_AGE))) {
    // this.headers['Cache-Control'] = process.env.MAX_AGE
  }

  if (err) {
    this.statusCode = err.statusCode;
    this.body.error = err.body;
  } else if (result && typeof result === "object") {
    this.body = result;
  }

  if (process.env.Environment !== "prod") {
    if (barrel && barrel.STATUS) {
      this.body.status = barrel.STATUS;
    } else {
      this.body.status = [];
    }
  }
  if (barrel) {
    console.log(JSON.stringify(barrel.STATUS));
  }
  this.body = JSON.stringify(this.body);
  this.headers["Content-Length"] = this.body.length;

  return this;
};

const SanitizeBody = function (body) {
  // validate string
  // remove whitespace
  if (!body || typeof body !== "object" || Object.keys(body).length === 0) {
    return body;
  }

  for (let k in body) {
    if (typeof body[k] === "string") {
      body[k] = body[k].trim();
      if (!/^(\w|\:){6,}$/.test(body[k]) && k === "unique_id") {
        throw new Error(
          `Invalid ${k}. Must be at leat 6 characters with allowed characters: a-z A-Z 0-9 _ :`
        );
      }
    }
  }
  return body;
};

const Barrel = function (event, context) {
  this.AWS_REGION = process.env.AWS_REGION;
  this.STATUS = [];
  if (context) {
    this.AWS_ACCOUNT = context.invokedFunctionArn.split(":")[4];
  }

  if (event) {
    this.HTTP_METHOD = event.httpMethod;

    try {
      if (typeof event.body === "string") {
        event.body = JSON.parse(event.body);
      }

      // silly, null type is object
      if (typeof event.body === "object" && event.body !== null) {
        this.BODY = SanitizeBody(event.body);
      } else {
        this.BODY = {};
      }
    } catch (error) {
      this.ERROR = {
        statusCode: 400,
        body: "Error: Bad Request, " + error.message,
      };
      this.BODY = {};
    }

    this.HEADERS = {};
    if (event.headers) {
      this.HEADERS = event.headers;
      try {
        this.TOKEN = decodeURIComponent(event.headers["Authorization"]);
      } catch (error) {
        this.TOKEN = event.headers["Authorization"];
      }
    }

    this.QUERY_PARAMETERS = event.queryStringParameters || {};
    for (const k in this.QUERY_PARAMETERS) {
      try {
        this.QUERY_PARAMETERS[k] = decodeURIComponent(this.QUERY_PARAMETERS[k]);
      } catch (error) {
        this.QUERY_PARAMETERS[k] = this.QUERY_PARAMETERS[k];
      }
    }

    this.PATH_PARAMETERS = event.pathParameters || {};
    for (const k in this.PATH_PARAMETERS) {
      try {
        this.PATH_PARAMETERS[k] = decodeURIComponent(this.PATH_PARAMETERS[k]);
      } catch (error) {
        this.PATH_PARAMETERS[k] = this.PATH_PARAMETERS[k];
      }
    }
  }
};

const LoadManifest = function (barrel, next) {
  // load from URL
  if (barrel.BODY.manifest.url) {
    const params = {
      url: barrel.BODY.manifest,
    };

    if (barrel.HEADERS["x-api-key"]) {
      params.headers = {
        "x-api-key": barrel.HEADERS["x-api-key"],
      };
    }

    console.log("Loading Manifest File", params);
    axios(params)
      .then((result) => {
        // console.log(result);
        barrel.MANIFEST = JSON.parse(result.data);
        if (!("location" in barrel.MANIFEST)) {
          barrel.MANIFEST.location = params.url.split("/");
          barrel.MANIFEST.location.pop();
          barrel.MANIFEST.location.push("");
          barrel.MANIFEST.location.join("/");
        }

        let filename = `${process.env.tmpFolder}${params.url.split("/").pop()}`;
        let error = fs.writeFileSync(filename, result.data);

        barrel.STATUS.push(
          `Manifest File Loaded: ${params.url} as ${filename}`
        );
        next(error, barrel);
      })
      .catch((error) => {
        console.log(error);
        next(
          {
            statusCode: 404,
            body: `File could not be loaded: ${params.url}`,
          },
          barrel
        );
      });
    // load from request body
  } else if (barrel.BODY.manifest.location) {
    let filename = `${process.env.tmpFolder}manifest.json`;
    barrel.MANIFEST = JSON.parse(JSON.stringify(barrel.BODY.manifest));
    let error = fs.writeFileSync(filename, JSON.stringify(barrel.MANIFEST));

    barrel.STATUS.push(`Manifest File Loaded: ${filename}`);
    next(error, barrel);
  }
};

// Loads files from the file service by url or the param store by path
const LoadFiles = function (barrel, next) {
  async.eachSeries(
    barrel.MANIFEST.files,
    (file, _next) => {
      if (file.url) {
        const params = {
          url: file.url,
        };

        if (barrel.HEADERS["x-api-key"]) {
          params.headers = {
            "x-api-key": barrel.HEADERS["x-api-key"],
          };
        }
        console.log("Loading File", params);
        axios(params)
          .then((result) => {
            file.name = `${process.env.tmpFolder}${params.url
              .split("/")
              .pop()}`;
            let error = fs.writeFileSync(file.name, result.data);
            barrel.STATUS.push(`File Loaded: ${params.url} as ${file.name}`);
            _next(error);
          })
          .catch((error) => {
            console.log("Axios Error");
            console.log(error.message);
            _next({
              statusCode: 404,
              body: `File could not be loaded: ${params.url}`,
            });
          });
      } else if (file.path) {
        console.log("file", file.path);
        // load the encrypted key
        LoadParameter(file.path, (err, result) => {
          console.log("got parameter", err, result);
          if (err || !result.Parameter) {
            barrel.STATUS.push(`Key Not Loaded: ${file.path}: ${err.message}`);

            return _next({
              statusCode: 400,
              body: `Parameter Not Found ${file.path}`,
            });
          }

          console.log("writing key");
          file.key = file.path.split("/");
          file.name = `${process.env.tmpFolder}${
            file.key[file.key.length - 1]
          }`;

          barrel.STATUS.push(`Key Loaded: ${file.path} as ${file.name}`);

          const error = fs.writeFileSync(
            `${file.name}`,
            result.Parameter.Value
          );
          _next(error);
        });
      } else {
        _next();
      }
    },
    (err) => {
      console.log(err);
      next(err, barrel);
    }
  );
};

// const LoadSigningKeys = function (barrel, next) {
//   console.log("file", barrel.BODY.files.length);

//   async.eachSeries(
//     barrel.BODY.files,
//     (file, _next) => {

//     },
//     (err, result) => {
//       next(err, barrel);
//     }
//   );
// };

const SignSlot = function (barrel, next) {
  let slot = barrel.MANIFEST.mcuboot[barrel.SLOT];

  async.waterfall(
    [
      function (_next) {
        _next(null, barrel);
      },
      function (_barrel, _next) {
        let err = null;
        // generate the signature file
        // https://github.com/nrfconnect/sdk-nrf/tree/v1.9.0/scripts/bootloader
        // nrf/scripts/bootloader/hash.py --in s0_image.hex
        const parameters = ["hash.py", "--in", slot.name];
        console.log("calling hash.py", parameters);

        const pythonProcess = spawn(`python3`, parameters);
        const stderr = [];
        const stdout = [];
        pythonProcess.stdout.setEncoding("hex").on("data", (data) => {
          stdout.push(data);
        });

        pythonProcess.stderr.setEncoding("utf8").on("data", (data) => {
          stderr.push(data);
        });

        pythonProcess.on("close", (code) => {
          console.log(`pythonProcess process ends with code ${code}`);

          if (code == 0) {
            console.log("stdout", stdout);
            barrel.STATUS.push(`hash.py, slot ${slot.id} complete`);
            fs.writeFileSync(
              `${process.env.tmpFolder}s${slot.id}_image_firmware.sha256`,
              Buffer.from(stdout.join(""), "hex")
            );
          } else {
            console.log(stderr);
            err = `hash.py, slot ${slot.id} error ${stderr.join()}`;
            barrel.STATUS.push(err);
          }
          _next(null, _barrel);
        });
      },
      function (_barrel, _next) {
        let err = null;
        // generate the signature file
        // https://github.com/nrfconnect/sdk-nrf/tree/v1.9.0/scripts/bootloader
        // generated/s0_image_firmware.sha256 &&
        // nrf/scripts/bootloader/do_sign.py --private-key GENERATED_NON_SECURE_SIGN_KEY_PRIVATE.pem --in generated/s0_image_firmware.sha256 > generated/s0_image_firmware.signature

        const parameters = [
          "do_sign.py",
          "--private-key",
          barrel.MANIFEST.signingKey.name,
          "--in",
          `${process.env.tmpFolder}s${slot.id}_image_firmware.sha256`,
        ];

        console.log(parameters);

        const pythonProcess = spawn(`python3`, parameters);
        const stderr = [];
        const stdout = [];
        pythonProcess.stdout.setEncoding("hex").on("data", (data) => {
          stdout.push(data);
        });

        pythonProcess.stderr.setEncoding("utf8").on("data", (data) => {
          stderr.push(data);
        });

        pythonProcess.on("close", (code) => {
          console.log(`pythonProcess process ends with code ${code}`);

          if (code == 0) {
            console.log("stdout", stdout);

            fs.writeFileSync(
              `${process.env.tmpFolder}s${slot.id}_image_firmware.signature`,
              Buffer.from(stdout.join(""), "hex")
            );
            barrel.STATUS.push(`do_sign.py, slot ${slot.id} complete`);
          } else {
            console.log(stderr);
            err = `do_sign.py, slot ${slot.id} error ${stderr.join()}`;
            barrel.STATUS.push(err);
          }
          _next(err, _barrel);
        });
      },
      function (_barrel, _next) {
        let err = null;
        // signed_by_b0_s0_image.hex
        slot.b0signedHex = `${process.env.tmpFolder}signed_by_b0_s${slot.id}_image.hex`;
        slot.b0signedBin = slot.b0signedHex.replace(/\.hex$/, ".bin");

        const parameters = [
          "validation_data.py",
          "--input",
          slot.name,
          "--output-hex",
          slot.b0signedHex,
          "--output-bin",
          slot.b0signedBin,
          "--offset",
          slot.offset || 0,
          "--signature",
          `${process.env.tmpFolder}s${slot.id}_image_firmware.signature`,
          "--public-key",
          _barrel.MANIFEST.publicKeys[0].name,
          "--magic-value",
          slot.magicValue || "0x281ee6de,0x86518483,78850",
        ];
        console.log(parameters);

        const pythonProcess = spawn(`python3`, parameters);
        const stderr = [];
        const stdout = [];
        pythonProcess.stdout.setEncoding("utf8").on("data", (data) => {
          stdout.push(data);
        });

        pythonProcess.stderr.setEncoding("utf8").on("data", (data) => {
          stderr.push(data);
        });

        pythonProcess.on("close", (code) => {
          console.log(`pythonProcess process ends with code ${code}`);

          if (code == 0) {
            barrel.STATUS.push(`validation_data.py, slot ${slot.id} complete`);
          } else {
            console.log(stderr);
            err = `validation_data.py, slot ${slot.id} error ${stderr.join()}`;
            barrel.STATUS.push(err);
          }
          _next(err, _barrel);
        });
      },
      function (barrel, next) {
        // python3 imgtool.py sign --key bootloader/mcuboot/root-ec-p256.pem --header-size 0x200
        // --align 4 --version 0.1.0+1651685669 --pad-header --slot-size 0xd6000
        // zephyr/signed_by_b0_s0_image.hex zephyr/signed_by_mcuboot_and_b0_s0_image_signed.hex

        slot.mcuboots0signedHex = `${process.env.tmpFolder}signed_by_mcuboot_and_b0_s${slot.id}_image_signed.hex`;
        ImgToolSign(
          {
            barrel: barrel,
            key: barrel.MANIFEST.signingKey.name,
            filein: slot.b0signedHex,
            fileout: slot.mcuboots0signedHex,
            version: barrel.MANIFEST.app.version,
            headerSize: slot.headerSize,
            align: slot.align,
            version: slot.version,
            size: slot.size,
          },
          (err) => {
            next(err, barrel);
          }
        );
      },
      function (barrel, next) {
        // objcopy --input-target=ihex --output-target=binary --gap-fill=0xff
        // zephyr/signed_by_b0_s0_image.hex zephyr/signed_by_mcuboot_and_b0_s0_image_to_sign.bin
        slot.ToSignBin = `${process.env.tmpFolder}signed_by_mcuboot_and_b0_s${slot.id}_image_to_sign.bin`;
        ObjCopy(
          {
            barrel: barrel,
            filein: slot.b0signedHex,
            fileout: slot.ToSignBin,
          },
          (err) => {
            next(err, barrel);
          }
        );
      },
      function (barrel, next) {
        // imgtool.py sign --key bootloader/mcuboot/root-ec-p256.pem --header-size 0x200
        // --align 4 --version 0.1.0+1651685669 --pad-header --slot-size 0xd6000
        // zephyr/signed_by_mcuboot_and_b0_s0_image_to_sign.bin zephyr/signed_by_mcuboot_and_b0_s0_image_update.bin
        slot.mcuboots0signedHex = `${process.env.tmpFolder}signed_by_mcuboot_and_b0_s${slot.id}_image_update.bin`;
        ImgToolSign(
          {
            barrel: barrel,
            key: barrel.MANIFEST.signingKey.name,
            filein: slot.ToSignBin,
            fileout: slot.mcuboots0signedHex,
            version: barrel.MANIFEST.app.version,
          },
          (err) => {
            next(err, barrel);
          }
        );
      },
    ],
    (err, result) => {
      next(err, barrel);
    }
  );
};

const UploadFiles = function (barrel, next) {
  async.eachSeries(
    barrel.TO_UPLOAD,
    (file, _next) => {
      // read file from
      let fileData = fs.readFileSync(file);
      // write back to fileservice
      const params = {
        method: "post",
        url: `${barrel.MANIFEST.location}signed/${file.split("/").pop()}`,
        data: fileData,
        headers: { "Content-Type": "application/octet-stream" },
      };

      if (barrel.HEADERS["x-api-key"]) {
        params.headers["x-api-key"] = barrel.HEADERS["x-api-key"];
      }

      axios(params)
        .then((result) => {
          barrel.UPLOADED.push(params.url);
          _next(null, barrel);
        })
        .catch((error) => {
          next(error, barrel);
        });
    },
    (err, result) => {
      next(err, barrel);
    }
  );
};

// Script Spawners
const ObjCopy = function ({ filein, fileout, gapfill, barrel }, next) {
  let err = null;
  fileout = fileout || filein.replace(hexTest, ".bin");
  gapfill = gapfill || "0xff";

  let parameters = [
    "--input-target=ihex",
    "--output-target=binary",
    `--gap-fill=${gapfill}`,
    filein,
    fileout,
  ];

  console.log("calling objcopy", parameters);
  const imgcopyProcess = spawn(`./objcopy`, parameters);
  const stderr = [];
  const stdout = [];
  imgcopyProcess.stdout.setEncoding("utf8").on("data", (data) => {
    stdout.push(data);
  });

  imgcopyProcess.stderr.setEncoding("utf8").on("data", (data) => {
    stderr.push(data);
  });

  imgcopyProcess.on("close", (code) => {
    console.log(`objcopy process ends with code ${code}`);
    if (code == 0) {
      barrel.STATUS.push(`objcopy complete`);
    } else {
      console.log(stderr);
      err = `objcopy error ${stderr.join()}`;
      barrel.STATUS.push(err);
    }
    next(err, barrel);
  });
};

const ImgToolSign = function (
  { filein, fileout, key, headerSize, align, version, size, barrel },
  next
) {
  let err = null;

  headerSize = headerSize || "0x200";
  align = align || "4";
  size = size || "0xd6000";
  fileout = fileout || filein + ".signed";

  const parameters = [
    "sign",
    "--key",
    key,
    "--header-size",
    headerSize,
    "--align",
    align,
    "--version",
    version,
    "--pad-header",
    "--slot-size",
    size,
    filein,
    fileout,
  ];
  console.log(parameters);

  const imgtoolProcess = spawn(`imgtool`, parameters);
  const stderr = [];
  const stdout = [];
  imgtoolProcess.stdout.setEncoding("utf8").on("data", (data) => {
    stdout.push(data);
  });

  imgtoolProcess.stderr.setEncoding("utf8").on("data", (data) => {
    stderr.push(data);
  });
  imgtoolProcess.on("close", (code) => {
    console.log(`imgtool process ends with code ${code}`);
    if (code == 0) {
      barrel.STATUS.push(`imgtool complete`);
    } else {
      console.log(stderr);
      err = `imgtool error ${stderr.join()}`;
      barrel.STATUS.push(err);
    }
    next(err, barrel);
  });
};

module.exports = {
  ResponseConstructor,
  Barrel,
  SanitizeBody,
  LoadParameter,
  Decrypt,
  LoadFiles,
  ObjCopy,
  SignSlot,
  ImgToolSign,
  LoadManifest,
  UploadFiles,
};
