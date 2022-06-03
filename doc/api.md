# Canvas Signing Service

## Base URLs

- Public Test API: https://canvas.salticidae.net/ss/
- Public Dev API: https://canvas-dev.salticidae.net/ss/
- Private Test API: https://canvas-internal.salticidae.net/ss/
- Private Dev API: https://canvas-dev-internal.salticidae.net/ss/

---

# Uploading Files

## Upload a binary file

### POST /sign

#### Headers

- x-api-key: xxxxxxxxxxxxxxxxx
- Content-Type: application/json
- Accept: application/json

```
curl --header "Content-Type:application/octet-stream" --header "x-api-key:kX2t2hDC441xMrfbQ5uHn2Wz2m2rUM988mdXvpjc" --header "Accept:application/json" --trace-ascii debugdump.txt --data-binary @resources/test.bin https://canvas-test.salticidae.net/fs/obj/testfiles/test.bin
```

#### Request

##### Full Production Image

```
{
  manifest: {
    location: "https://canvas-dev.salticidae.net/fs/obj/sign/",
    partNumber: "450-00011-K1",
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
    },
    mcuboot: {
      partitionSize: "0xd6000",
      slot0Boot: {
        addr: "0x9000",
        name: "mcuboot_slot0_unsigned.hex",
        version: "0.1.0+1648052719",
      },
      slot1Boot: {
        addr: "0x19000",
        name: "mcuboot_slot1_unsigned.hex",
        version: "0.1.0+1648052719",
      },
    },
  },
}
```

##### OTA Image only

```
{
  manifest: {
    location: "https://canvas-dev.salticidae.net/fs/obj/sign/",
    partNumber: "450-00011-K1",
    target: "OTA",
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
    }
  },
}
```

##### Manifest File located in fileservice

```
{
  "enqueue": false,
  "manifest": {
    "url": "https://canvas-dev.salticidae.net/fs/obj/benl/my-firmware-package/manifest.json"
  }
}
```

#### Response

##### Full Production Image

```
{
  "result": [
    "https://canvas-dev.salticidae.net/fs/obj/sign/signed/release_2.1.0_app_signed.bin",
    "https://canvas-dev.salticidae.net/fs/obj/sign/signed/release_2.1.0_app_signed-merged.hex",
    "https://canvas-dev.salticidae.net/fs/obj/sign/signed/signed_by_mcuboot_and_b0_s0_image_update.bin",
    "https://canvas-dev.salticidae.net/fs/obj/sign/signed/signed_by_mcuboot_and_b0_s1_image_update.bin"
  ],
  "status": [
    "Manifest File Loaded: /tmp/manifest.json",
    "File Loaded: https://canvas-dev.salticidae.net/fs/obj/sign/release_2.1.0_app_unsigned.hex as /tmp/release_2.1.0_app_unsigned.hex",
    "Key Loaded: /canvas-ss-dev/laird/MG100/zephyrapp/2022-05-31/publickey.pem as /tmp/publickey.pem",
    "File Loaded: https://canvas-dev.salticidae.net/fs/obj/sign/b0.hex as /tmp/b0.hex",
    "File Loaded: https://canvas-dev.salticidae.net/fs/obj/sign/mcuboot_slot0_unsigned.hex as /tmp/mcuboot_slot0_unsigned.hex",
    "File Loaded: https://canvas-dev.salticidae.net/fs/obj/sign/mcuboot_slot1_unsigned.hex as /tmp/mcuboot_slot1_unsigned.hex",
    "Key Loaded: /canvas-ss-dev/laird/MG100/zephyrapp/2022-05-02/signingkey.pem as /tmp/signingkey.pem",
    "objcopy complete",
    "imgtool complete",
    "App image signed as /tmp/release_2.1.0_app_signed.hex",
    "imgtool complete",
    "App OTA image signed as /tmp/release_2.1.0_app_signed.bin",
    "provision complete",
    "signing slot 0",
    "hash.py, slot 0 complete",
    "do_sign.py, slot 0 complete",
    "validation_data.py, slot 0 complete",
    "imgtool complete",
    "objcopy complete",
    "imgtool complete",
    "signing slot 1",
    "hash.py, slot 1 complete",
    "do_sign.py, slot 1 complete",
    "validation_data.py, slot 1 complete",
    "imgtool complete",
    "objcopy complete",
    "imgtool complete",
    "mergehex complete"
  ]
}

```
