FROM public.ecr.aws/lambda/nodejs:12

# USER root
# WORKDIR /opt

# RUN yum install git python3 wget python-pip tar -y \
# # && pacman -Syu nodejs --noconfirm \
# # && pacman -Syu npm --noconfirm \
# # && pacman -S python3 wget python-pip which unzip git nodejs npm --noconfirm \

# && wget -q https://github.com/zephyrproject-rtos/sdk-ng/releases/download/v0.14.0/toolchain_linux-x86_64_arm-zephyr-eabi.tar.gz \
# && tar -xf toolchain_linux-x86_64_arm-zephyr-eabi.tar.gz \
# && cp arm-zephyr-eabi/arm-zephyr-eabi/bin/objcopy ./objcopy \
# && rm -rf toolchain_linux-x86_64_arm-zephyr-eabi.tar.gz \
# && rm -rf arm-zephyr-eabi \
# && git clone https://github.com/zephyrproject-rtos/mcuboot.git \
# && ls \
# && cp -r mcuboot/scripts /home \
# && cp -r mcuboot/*.pem /home \
# && rm -rf mcuboot \
# && cd /home/scripts \
# && python3 setup.py build \
# && python3 setup.py install \
# && cd .. \
# && rm -rf scripts \
# && yum erase git wget python-pip tar -y

# WORKDIR /home
COPY ./root/ ./
COPY ./package.json ./
RUN npm install --production

# docker build --tag mcuboot:latest .
# docker run -it mcuboot /bin/sh

# ./objcopy --input-target=ihex --output-target=binary --gap-fill=0xff zephyr.hex app_to_sign.bin
# imgtool.py sign --key /Users/ryan/git/zephyr_workspace/bootloader/mcuboot/root-ec-p256.pem \
# --header-size 0x200 --align 4 --version 0.1.0+1648052719 --pad-header --slot-size 0xd6000 \
CMD [ "sign.handler" ]
