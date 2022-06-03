# Firmware signing process

## Create provision data

### Inputs

- secure keys and certs (from user)
- mcuboot slot 0 and slot 1 start address
- provision slot start address
- provision slot size

### Outputs

- provision hex file for making production image

### Steps

public.pem|cert1, cert2, cert3 ... up to 5 or 6

```
provision.py --s0-addr 0x9000 --s1-addr 0x19000 --provision-addr 0x8000 --public-key-files public.pem,GENERATED_NON_SECURE_PUBLIC_0.pem,GENERATED_NON_SECURE_PUBLIC_1.pem --output provision.hex --num-counter-slots-version 240 --max-size 0x1000
```

## Sign mcuboot slot 0 and 1

### Inputs

- unsigned hex files
- - s0_image.hex (slot0 bootloader) (from user)
- - zephyr.hex (slot1 bootloader) (from user)
- app version
- mcuboot partition size
- secure keys
- public.pem (cert1)

### Outputs

- signed binaries for OTA
- signed hex files for making production image

### Steps

S0 image validation generates signature file, and s0_image.bin

```
nrf/scripts/bootloader/validation_data.py --input zephyr/s0_image.hex --output-hex zephyr/signed_by_b0_s0_image.hex --output-bin /zephyr/signed_by_b0_s0_image.bin --offset 0 --signature zephyr/nrf/subsys/bootloader/generated/s0_image_firmware.signature --public-key zephyr/nrf/subsys/bootloader/generated/public.pem --magic-value 0x281ee6de,0x86518483,78850
```

S0 image signed hex

```
bootloader/mcuboot/scripts/imgtool.py sign --key bootloader/mcuboot/root-ec-p256.pem --header-size 0x200 --align 4 --version 0.1.0+1651685669 --pad-header --slot-size 0xd6000 zephyr/signed_by_b0_s0_image.hex zephyr/signed_by_mcuboot_and_b0_s0_image_signed.hex
```

S0 image signed binary

```
arm-zephyr-eabi-objcopy --input-target=ihex --output-target=binary --gap-fill=0xff zephyr/signed_by_b0_s0_image.hex zephyr/signed_by_mcuboot_and_b0_s0_image_to_sign.bin && imgtool.py sign --key bootloader/mcuboot/root-ec-p256.pem --header-size 0x200 --align 4 --version 0.1.0+1651685669 --pad-header --slot-size 0xd6000 zephyr/signed_by_mcuboot_and_b0_s0_image_to_sign.bin zephyr/signed_by_mcuboot_and_b0_s0_image_update.bin
```

S1 image validation

```
nrf/scripts/bootloader/validation_data.py --input s1_image/zephyr/zephyr.hex --output-hex zephyr/signed_by_b0_s1_image.hex --output-bin zephyr/signed_by_b0_s1_image.bin --offset 0 --signature zephyr/nrf/subsys/bootloader/generated/s1_image_firmware.signature --public-key zephyr/nrf/subsys/bootloader/generated/public.pem --magic-value 0x281ee6de,0x86518483,78850
```

S1 image signed hex

```
bootloader/mcuboot/scripts/imgtool.py sign --key bootloader/mcuboot/root-ec-p256.pem --header-size 0x200 --align 4 --version 0.1.0+1651685669 --pad-header --slot-size 0xd6000 zephyr/signed_by_b0_s1_image.hex zephyr/signed_by_mcuboot_and_b0_s1_image_signed.hex
```

S1 image signed binary

```
arm-zephyr-eabi-objcopy --input-target=ihex --output-target=binary --gap-fill=0xff zephyr/signed_by_b0_s1_image.hex zephyr/signed_by_mcuboot_and_b0_s1_image_to_sign.bin && imgtool.py sign --key bootloader/mcuboot/root-ec-p256.pem --header-size 0x200 --align 4 --version 0.1.0+1651685669 --pad-header --slot-size 0xd6000 zephyr/signed_by_mcuboot_and_b0_s1_image_to_sign.bin zephyr/signed_by_mcuboot_and_b0_s1_image_update.bin
```

## Sign app

### Inputs

- unsigned app hex file (from user)
- app version
- app partition size

### Outputs

- signed app binary
- signed app hex for production image

### Steps

Signed hex

```
bootloader/mcuboot/scripts/imgtool.py sign --key bootloader/mcuboot/root-ec-p256.pem --header-size 0x200 --align 4 --version 0.1.0+1651685669 --pad-header --slot-size 0xd6000 zephyr/mcuboot_primary_app.hex zephyr/app_signed.hex
```

NOTE: mcuboot_primary_app.hex == zephyr.hex

Signed Binary

```
arm-zephyr-eabi-objcopy --input-target=ihex --output-target=binary --gap-fill=0xff build/pinnacle_100_dvk/zephyr/mcuboot_primary_app.hex build/pinnacle_100_dvk/zephyr/app_to_sign.bin

imgtool.py sign --key root-ec-p256.pem --header-size 0x200 --align 4 --version 0.1.0+1648052719 --pad-header --slot-size 0xd6000 build/pinnacle_100_dvk/zephyr/app_to_sign.bin build/pinnacle_100_dvk/zephyr/app_update.bin
```

## Package into full image

### Inputs

- immutable bootloader hex file (from user)
- provision hex file
- mcuboot slot 0 & 1 signed hex files
- signed app hex file

### Outputs

- full production image hex file

### Steps

```
mergehex.py -o merged.hex --overlap=replace
b0/zephyr/zephyr.hex
zephyr/provision.hex
zephyr/signed_by_mcuboot_and_b0_s0_image_signed.hex
zephyr/signed_by_mcuboot_and_b0_s1_image_signed.hex
zephyr/app_signed.hex
```

NOTE: Original command that has duplicate data

```
mergehex.py -o merged.hex --overlap=replace
b0/zephyr/zephyr.hex
zephyr/b0_container.hex (immutable bootloader + provision)
mcuboot/zephyr/zephyr.hex (unsigned mcuboot s0)
zephyr/spm_app.hex (same as unsigned app)
zephyr/mcuboot_primary.hex (same as unsigned app)
zephyr/provision.hex
zephyr/signed_by_b0_s1_image.hex (validation image s1 mcuboot)
zephyr/signed_by_b0_s0_image.hex (validation image s0 mcuboot)
zephyr/signed_by_mcuboot_and_b0_s0_image_signed.hex
zephyr/signed_by_mcuboot_and_b0_s1_image_signed.hex
zephyr/zephyr.hex (unsigned app)
zephyr/app_signed.hex
```

https://github.com/nrfconnect/sdk-nrf/tree/v1.9.0/scripts/bootloader
provision.py
public.pem,
GENERATED_NON_SECURE_PUBLIC_0.pem,
GENERATED_NON_SECURE_PUBLIC_1.pem

validation_data.py
zephyr/s0_image.hex
zephyr/nrf/subsys/bootloader/generated/s0_image_firmware.signature
zephyr/nrf/subsys/bootloader/generated/public.pem
s1_image/zephyr/zephyr.hex
