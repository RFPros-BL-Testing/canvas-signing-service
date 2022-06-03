process.env.tmpFolder = "/tmp/";
process.env.AWS_ACCESS_KEY_ID = "AKIAUBVW63FTYKG6PEVV";
process.env.AWS_SECRET_ACCESS_KEY = "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";
process.env.AWS_REGION = "us-east-1";

const lambda = require("./sign");
const fs = require("fs");

try {
  fs.rmSync(process.env.tmpFolder, { recursive: true, force: true });
} catch (error) {}

// let body = {
//   manifest: {
//     url: "https://canvas-dev.salticidae.net/fs/obj/sign/manifest.json",
//   },
// };

let body = {
  manifest: {
    location: "https://canvas-dev.salticidae.net/fs/obj/sign/",
    partNumber: "450-00011-K1",
    // target: "OTA", // just sign the image, no need for bootloaders,
    // mergeOverlap: "replace",
    signingKey: {
      path: "/canvas-ss-dev/laird/MG100/zephyrapp/2022-05-02/signingkey.pem", // root-ec-p256.pem
    },
    publicKeys: [
      {
        path: "/canvas-ss-dev/laird/MG100/zephyrapp/2022-05-31/publickey.pem",
      },
    ],
    app: {
      name: "release_2.1.0_app_unsigned.hex",
      version: "0.1.0+1651685669",
    },
    immutableBoot: {
      name: "b0.hex",
      provisionAddr: "0x8000",
      provisionSlotSize: "0x1000",
      // counterSlotsVersion: 240
    },
    mcuboot: {
      partitionSize: "0xd6000",
      slot0Boot: {
        addr: "0x9000",
        name: "mcuboot_slot0_unsigned.hex",
        // magicValue: "0x281ee6de,0x86518483,78850"
        // offset: 0,
        // headerSize: "0x200",
        // align: "4",
        version: "0.1.0+1648052719",
        // size: "0xd6000"
      },
      slot1Boot: {
        addr: "0x19000",
        name: "mcuboot_slot1_unsigned.hex",
        // magicValue: "0x281ee6de,0x86518483,78850",
        // offset: 0,
        // offset: 0,
        // headerSize: "0x200",
        // align: "4",
        version: "0.1.0+1648052719",
        // size: "0xd6000"
      },
    },
  },
};

let mockEvent = {
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

let mockContext = {
  invokedFunctionArn: "1:2:3:4:ACCOUNTID",
};

lambda.handler(mockEvent, mockContext, (err, result) => {
  console.log(err, result);
});
