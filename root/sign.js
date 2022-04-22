const crypto = require("crypto");
const async = require("async");
const { spawn } = require("child_process");
const axios = require("axios");
const methods = require("./methods");

// run signing scripts
// read signed image
// upload signed image

exports.handler = (event, context, callback) => {
  console.log("event: ", JSON.stringify(event));
  console.log("context: ", JSON.stringify(context));

  const Top = function Top(next) {
    let barrel = new methods.Barrel(event, context);
    barrel.API_KEY_ID = event.requestContext.identity.apiKeyId;
    next(barrel.ERROR, barrel);
  };

  const methodStacks = {
    POST: [
      Top,
      // Get FileService credentials
      methods.LoadParameters,
      function (barrel, next) {
        // Pull image(s) to sign
        async.eachSeries(
          barrel.BODY.files,
          (file) => {
            axios(file.url).then((result) => {
              file.data = result;
              file.name = url.split("/").pop();
            });
          },
          (err) => {
            next(err, barrel);
          }
        );
      },
      function (barrel, next) {
        // write image(s) to tmp
        async.eachSeries(
          barrel.BODY.files,
          (file, _next) => {
            let error = fs.writefileSync(`/tmp/${file.name}`, file.data);
            _next(error);
          },
          (err) => {
            next(err, barrel);
          }
        );
      },
      function (barrel, next) {
        async.eachSeries(
          barrel.BODY.files,
          (file, _next) => {
            let hexTest = new RegExp("/\\.hex$/");
            if (hexTest.test(file.name)) {
              let parameters = [
                "--input-target=ihex",
                "--output-target=binary",
                "--gap-fill=0xff",
                `/tmp/${file.name}`,
                `/tmp/${file.name}`.replace(hexTest, ".bin"),
              ];
              const imgcopyProcess = spawn(`${__dirname}/imgcopy`, parameters);
              const stderr = [];
              const stdout = [];
              imgcopyProcess.stdout.on("data", (data) => {
                stdout.push(data);
              });

              imgcopyProcess.stderr.on("data", (data) => {
                stderr.push(data);
              });

              imgcopyProcess.on("close", (code) => {
                console.log(`imgcopy process ends with code ${code}`);
                file.name = `/tmp/${file.name}`.replace(hexTest, ".bin");
                _next(null, barrel);
              });
            } else {
              _next(null, barrel);
            }
          },
          (err) => {
            next(err, barrel);
          }
        );
      },
      function (barrel, next) {
        const parameters = [
          "sign",
          "--key /tmp/root-ec-p256.pem",
          "--header-size 0x200",
          "--align 4",
          "--version 0.1.0+1648052719",
          "--pad-header",
          "--slot-size 0xd6000",
          `/tmp/${file.name}`,
          `/tmp/${file.name}.signed`,
        ];
        const imgtoolProcess = spawn(`${__dirname}/imgtool`, parameters);
        const stderr = [];
        const stdout = [];
        imgtoolProcess.stdout.on("data", (data) => {
          stdout.push(data);
        });

        imgtoolProcess.stderr.on("data", (data) => {
          stderr.push(data);
        });

        imgtoolProcess.on("close", (code) => {
          console.log(`imgtool process ends with code ${code}`);
          next(null, barrel);
        });
      },
      function (barrel, next) {
        // read file from
        let signedFile = fs.readfileSync(`/tmp/${file.name}.signed`);
        // write back to fileservice
        axios({
          method: "post",
          url: `${file.url}.signed`,
          data: signedFile,
          headers: { "Content-Type": "application/octet-stream" },
        })
          .then((result) => {
            console.log(result);
            next(null, barrel);
          })
          .catch((error) => {
            console.log(error);
            next(error, barrel);
          });
      },
    ],
    // PUT: [
    //   Top,
    //   methods.LoadCredentials,
    //   methodsApiGateway.GetApiKey,
    //   methodsEdgeIq.PutEscrowDevice,
    // ],
    // DELETE: [
    //   Top,
    //   methods.LoadCredentials,
    //   methodsApiGateway.GetApiKey,
    //   methodsEdgeIq.DeleteEscrowDevice,
    // ],
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
    let _result = {
      result: barrel.BODY,
    };
    let response = new methods.ResponseConstructor(err, event, barrel, _result);
    callback(null, response);
  });
};
