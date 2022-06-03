const async = require("async");
const { spawn } = require("child_process");
const methods = require("./methods");
const fs = require("fs");
const { PartNumbers } = require("./part-map");

const validate = require("jsonschema").validate;
const jsonSchemas = {
  MG100: JSON.parse(fs.readFileSync("./schemas/mg100-manifest.schema.json")),
};

let hexTest = new RegExp(/\.hex$/);

// run signing scripts
// read signed image
// upload signed image

exports.handler = (event, context, callback) => {
  console.log("event: ", JSON.stringify(event));
  console.log("context: ", JSON.stringify(context));

  const Top = function Top(next) {
    let barrel = new methods.Barrel(event, context);
    barrel.UPLOADED = [];
    // try {
    //   barrel.API_KEY_ID = event.requestContext.identity.apiKeyId;
    // } catch (error) {}
    next(barrel.ERROR, barrel);
  };

  // MG100 stack
  const methodStacks = {
    POST: [
      Top,
      // Get FileService credentials
      // else api key is included with the request
      // function (barrel, next) {},
      // Load the manifest files to get the build package information
      methods.LoadManifest,

      // Parse the manifest file per build type
      function (barrel, next) {
        let err = null;
        // set the root obj key
        let root = barrel.MANIFEST.location;
        if (!(barrel.MANIFEST.partNumber in PartNumbers)) {
          return next(
            {
              statusCode: 400,
              message: "Unknown Part Number",
            },
            barrel
          );
        }

        // validate manifest file
        let result = validate(
          barrel.BODY,
          jsonSchemas[PartNumbers[barrel.MANIFEST.partNumber]]
        );

        if (!result.valid) {
          console.log(result);
          return next(
            {
              statusCode: 500,
              body: "Error: Invalid JSON " + JSON.stringify(result.errors),
            },
            barrel
          );
        }

        if (!("files" in barrel.MANIFEST)) {
          barrel.MANIFEST.files = [];
        }

        if (PartNumbers[barrel.MANIFEST.partNumber] === "MG100") {
          barrel.MANIFEST.app.url = `${root}${barrel.MANIFEST.app.name}`;
          barrel.MANIFEST.files.push(barrel.MANIFEST.app);
          for (let k of barrel.MANIFEST.publicKeys) {
            barrel.MANIFEST.files.push(k);
          }
          // building the full image requires more
          if (barrel.MANIFEST.target !== "OTA") {
            barrel.MANIFEST.immutableBoot.url = `${root}${barrel.MANIFEST.immutableBoot.name}`;
            barrel.MANIFEST.mcuboot.slot0Boot.url = `${root}${barrel.MANIFEST.mcuboot.slot0Boot.name}`;
            barrel.MANIFEST.mcuboot.slot1Boot.url = `${root}${barrel.MANIFEST.mcuboot.slot1Boot.name}`;

            // populate list of files to download
            barrel.MANIFEST.files.push(
              barrel.MANIFEST.immutableBoot,
              barrel.MANIFEST.mcuboot.slot0Boot,
              barrel.MANIFEST.mcuboot.slot1Boot,
              barrel.MANIFEST.signingKey
            );

            barrel.MANIFEST.mcuboot.slot0Boot.id = "0";
            barrel.MANIFEST.mcuboot.slot1Boot.id = "1";
          }
        }
        next(err, barrel);
      },

      // load files from fileservice
      methods.LoadFiles,

      // convert the app to bin if it's hex
      function (barrel, next) {
        if (hexTest.test(barrel.MANIFEST.app.name)) {
          methods.ObjCopy(
            {
              barrel: barrel,
              filein: barrel.MANIFEST.app.name,
            },
            (err) => {
              next(err, barrel);
            }
          );
        } else {
          next(null, barrel);
        }
      },
      // Sign App
      function (barrel, next) {
        barrel.MANIFEST.app.nameSigned = barrel.MANIFEST.app.name.replace(
          /\.\w{3}$/,
          ""
        );
        barrel.MANIFEST.app.nameSigned = barrel.MANIFEST.app.nameSigned.replace(
          "unsigned",
          ""
        );
        barrel.MANIFEST.app.nameSigned =
          barrel.MANIFEST.app.nameSigned + "signed";

        // sign the hex
        // imgtool.py sign --key bootloader/mcuboot/root-ec-p256.pem
        // --header-size 0x200 --align 4 --version 0.1.0+1651685669
        // --pad-header --slot-size 0xd6000 zephyr/mcuboot_primary_app.hex
        // zephyr/app_signed.hex
        methods.ImgToolSign(
          {
            barrel: barrel,
            filein: barrel.MANIFEST.app.name,
            version: barrel.MANIFEST.app.version,
            fileout: `${barrel.MANIFEST.app.nameSigned}.hex`,
            key: barrel.MANIFEST.signingKey.name,
          },
          (err) => {
            if (!err) {
              barrel.STATUS.push(
                `App image signed as ${barrel.MANIFEST.app.nameSigned}.hex`
              );
            }
            next(err, barrel);
          }
        );
      },
      function (barrel, next) {
        // sign the bin
        methods.ImgToolSign(
          {
            barrel: barrel,
            version: barrel.MANIFEST.app.version,
            filein: barrel.MANIFEST.app.name.replace(/\.hex$/, ".bin"),
            fileout: `${barrel.MANIFEST.app.nameSigned}.bin`,
            key: barrel.MANIFEST.signingKey.name,
          },
          (err) => {
            if (!err) {
              barrel.STATUS.push(
                `App OTA image signed as ${barrel.MANIFEST.app.nameSigned}.bin`
              );
            }
            next(err, barrel);
          }
        );
      },
      // upload app_signed.bin
      function (barrel, next) {
        barrel.TO_UPLOAD = [`${barrel.MANIFEST.app.nameSigned}.bin`];
        methods.UploadFiles(barrel, next);
      },
      function (barrel, next) {
        if (barrel.MANIFEST.target === "OTA") {
          next("done", barrel);
        } else {
          next(null, barrel);
        }
      },
      // Create provision data
      function (barrel, next) {
        let err = null;

        // all our public keys should be in the temp folder after being loaded
        // the actual path should be in the files array from being loaded, but
        // are not set to the
        let keyPaths = barrel.MANIFEST.publicKeys
          .map((k) => {
            return `${process.env.tmpFolder}${k.path.split("/").pop()}`;
          })
          .join(",");

        let options = barrel.MANIFEST;
        // provision.py --output provision.hex --num-counter-slots-version 240 --max-size 0x1000
        const parameters = [
          "provision.py",
          "--s0-addr",
          options.mcuboot.slot0Boot.addr,
          "--s1-addr",
          options.mcuboot.slot0Boot.addr,
          "--provision-addr",
          options.immutableBoot.provisionAddr,
          "--public-key-files",
          keyPaths,
          "--output",
          `${process.env.tmpFolder}provision.hex`,
          "--num-counter-slots-version",
          options.immutableBoot.counterSlotsVersion || 240,
          "--max-size",
          options.immutableBoot.provisionSlotSize,
        ];
        console.log("calling provision.py", parameters);

        const provisionScript = spawn(`python3`, parameters);
        const stderr = [];
        const stdout = [];
        provisionScript.stdout.setEncoding("utf8").on("data", (data) => {
          stdout.push(data);
        });

        provisionScript.stderr.setEncoding("utf8").on("data", (data) => {
          stderr.push(data);
        });

        provisionScript.on("close", (code) => {
          console.log(`provision.py process ends with code ${code}`);
          // console.log(stdout);
          // console.log(stderr);
          if (code == 0) {
            barrel.STATUS.push("provision complete");
          } else {
            err = stderr.join();
            barrel.STATUS.push("provision failed: " + err);
          }
          next(err, barrel);
        });
      },
      // Sign mcuboot slots
      function (barrel, next) {
        barrel.SLOT = "slot0Boot";
        barrel.STATUS.push("signing slot 0");
        methods.SignSlot(barrel, next);
      },
      function (barrel, next) {
        if (barrel.MANIFEST.mcuboot.slot1Boot) {
          barrel.SLOT = "slot1Boot";
          barrel.STATUS.push("signing slot 1");
          methods.SignSlot(barrel, next);
        } else {
          next(null, barrel);
        }
      },
      // Package into full image
      function (barrel, next) {
        let err = null;
        let parameters = [
          "mergehex.py",
          "-o",
          `${barrel.MANIFEST.app.nameSigned}-merged.hex`,
          "--overlap",
          barrel.MANIFEST.mergeOverlap || "replace",
          barrel.MANIFEST.immutableBoot.name,
          `${process.env.tmpFolder}provision.hex`,
          `${process.env.tmpFolder}signed_by_mcuboot_and_b0_s0_image_signed.hex`,
        ];

        if (barrel.MANIFEST.slot1Boot) {
          parameters.push(
            `${process.env.tmpFolder}signed_by_mcuboot_and_b0_s1_image_signed.hex`
          );
        }
        parameters.push(`${barrel.MANIFEST.app.nameSigned}.hex`);

        console.log("calling mergehex", parameters);
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
          console.log(`mergehex process ends with code ${code}`);
          if (code == 0) {
            barrel.STATUS.push("mergehex complete");
          } else {
            err = stderr.join();
            barrel.STATUS.push("mergehex failed: " + err);
          }
          next(err, barrel);
        });
      },
      // additional files to upload
      function (barrel, next) {
        // signed_by_mcuboot_and_b0_s0_image_update.bin
        // signed_by_mcuboot_and_b0_s1_image_update.bin
        // merged.hex
        barrel.TO_UPLOAD = [
          `${barrel.MANIFEST.app.nameSigned}-merged.hex`,
          `${process.env.tmpFolder}signed_by_mcuboot_and_b0_s0_image_update.bin`,
        ];
        if (barrel.MANIFEST.mcuboot.slot1Boot) {
          barrel.TO_UPLOAD.push(
            `${process.env.tmpFolder}signed_by_mcuboot_and_b0_s1_image_update.bin`
          );
        }
        methods.UploadFiles(barrel, next);
      },
    ],
  };

  if (!(event.httpMethod in methodStacks)) {
    let response = {
      statusCode: 405,
      body: JSON.stringify({
        error: "Method Not Allowed",
      }),
    };
    return callback(null, response);
  }

  async.waterfall(methodStacks[event.httpMethod], (err, barrel) => {
    console.log(err, barrel);
    let _result = {
      result: barrel.UPLOADED,
    };
    let response = new methods.ResponseConstructor(err, event, barrel, _result);
    callback(null, response);
  });
};
