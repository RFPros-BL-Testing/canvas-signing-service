const lambda = require("../../root/sign");
const methods = require("../../root/methods");
const { LoadParameters } = require("../../root/methods");
const fs = require("fs");

process.env.tmpFolder = "./tmp/";
// process.env.signingKey =
//   "-----BEGIN EC PRIVATE KEY-----\nMHcCAQEEINeY1S+DASQ701QrflXtTHRhGQCw+VBagk/h6OwGO8/xoAoGCCqGSM49\nAwEHoUQDQgAEKstAPOj+7VukSZWhqR2u6Nu+GTfNFPsvJFc35ZU5iNmUudZa69fN\n1TCK1v5IskpqgQ7l8H2LaDTMOmr8U476wQ==\n-----END EC PRIVATE KEY-----\n";

try {
  fs.rmSync(process.env.tmpFolder, { recursive: true, force: true });
} catch (error) {}
fs.mkdirSync(process.env.tmpFolder);

/*
{
  "files": [{
    "url": "https://privatedomain/fs/obj/path/to/file.hex"
  }]
}
*/

describe("sign file", () => {
  let loadParametersSpy, mockEvent, mockContext, body;

  beforeEach(() => {
    // Input
    body = {
      manifest: {
        // url: "https://canvas-dev.salticidae.net/fs/obj/sign/manifest.json",
        location: "https://canvas-dev.salticidae.net/fs/obj/sign/",
        partNumber: "450-00011-K1",
        mcuboot: {
          signingKey: {
            path: "/canvas-ss-dev/laird/MG100/zephyrapp/2022-05-02/signingkey.pem", // root-ec-p256.pem
          },
          publicKeys: [
            {
              path: "/canvas-ss-dev/laird/MG100/zephyrapp/2022-05-31/publickey.pem",
            }, // "GENERATED_NON_SECURE_PUBLIC_0.pem",
            // "GENERATED_NON_SECURE_PUBLIC_1.pem",
          ],
          app: "app_update.hex",
          immutableBootHex: "b0_container.hex",
          slot0BootHex: "slot0.hex",
          slot1BootHex: "slot1.hex",
          slot0Addr: "0x9000",
          slot1Addr: "0x19000",
          provisionAddr: "0x8000",
          provisionSlotSize: "0x1000",

          appVersion: "0.1.0+1651685669",
          partitionSize: "0xd6000",
        },
      },
    };

    mockEvent = {
      httpMethod: "POST",
      body,
      requestContext: {
        identity: {
          apiKeyId: "mockApiKeyId",
        },
      },
      headers: {
        "x-api-key": "kX2t2hDC441xMrfbQ5uHn2Wz2m2rUM988mdXvpjc",
      },
    };

    mockContext = {
      invokedFunctionArn: "1:2:3:4:ACCOUNTID",
    };

    // loadParametersSpy = jest.spyOn(methods, "LoadParameter");
    // loadParametersSpy.mockImplementation((barrel, next) => next(null, barrel));
  });

  test("hex image", (done) => {
    lambda.handler(mockEvent, mockContext, (err, result) => {
      console.log(err, result);
      done();
    });
  });
});
