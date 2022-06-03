FROM public.ecr.aws/lambda/nodejs:12

# USER root
# WORKDIR /opt

RUN yum install git python3 wget python-pip tar -y \


&& wget -q https://github.com/zephyrproject-rtos/sdk-ng/releases/download/v0.14.0/toolchain_linux-x86_64_arm-zephyr-eabi.tar.gz \
&& tar -xf toolchain_linux-x86_64_arm-zephyr-eabi.tar.gz \
&& cp arm-zephyr-eabi/arm-zephyr-eabi/bin/objcopy ./objcopy \
&& rm -rf toolchain_linux-x86_64_arm-zephyr-eabi.tar.gz \
&& rm -rf arm-zephyr-eabi \

&& git clone https://github.com/zephyrproject-rtos/mcuboot.git \
&& cp -r mcuboot/scripts ./ \
# && cp -r mcuboot/*.pem ./ \
&& rm -rf mcuboot \
&& cd ./scripts \
&& python3 setup.py build \
&& python3 setup.py install \
&& cd .. \
&& rm -rf scripts \

&& git clone https://github.com/zephyrproject-rtos/zephyr.git \
&& cp -r zephyr/scripts/mergehex.py ./mergehex.py \
&& rm -rf zephyr \

# Required for NRF provision.py
&& git clone https://github.com/nrfconnect/sdk-nrf.git \
&& cp sdk-nrf/scripts/bootloader/*.py ./ \
&& pip3 install intelhex ecdsa imagesize>=1.2.0 pylint cddl-gen==0.3.0 \
&& rm -rf sdk-nrf \
&& yum clean all \
&& yum erase git wget python-pip tar -y

# WORKDIR /home
COPY ./root/ ./
COPY ./package.json ./
RUN npm install --production

# docker build --tag mcuboot:latest .
# docker run -it --entrypoint /bin/sh mcuboot

# ./objcopy --input-target=ihex --output-target=binary --gap-fill=0xff zephyr.hex app_to_sign.bin
# imgtool.py sign --key /Users/ryan/git/zephyr_workspace/bootloader/mcuboot/root-ec-p256.pem \
# --header-size 0x200 --align 4 --version 0.1.0+1648052719 --pad-header --slot-size 0xd6000 \
CMD [ "sign.handler" ]
