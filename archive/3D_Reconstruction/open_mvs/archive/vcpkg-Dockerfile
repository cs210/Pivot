# To build: docker build -t open-mvs .
# To run: docker run -it open-mvs
# To clean up docker disk space: docker system prune -a
# Once in the container, run: vcpkg install openmvs

FROM ubuntu:22.04

# Set non-interactive mode
ENV DEBIAN_FRONTEND=noninteractive

# Install dependencies
RUN apt-get update && apt-get install -y \
    git build-essential wget \
    curl zip unzip tar \
    autoconf automake libtool pkg-config \
    python3 \
    libcap-dev \
    libmount-dev \
    libcap-dev \
    libmount-dev \
    python3-pip \
    python3-setuptools \
    python3-wheel \
    gperf \
    m4 \
    libpwquality-dev \
    libblkid-dev \
    python3-jinja2 \
    bison \
    libx11-dev libxft-dev libxext-dev \
    libxi-dev libxtst-dev \
    libxmu-dev libgl-dev \
    gfortran \
    libxinerama-dev libxcursor-dev xorg-dev libglu1-mesa-dev '^libxcb.*-dev' \
    libgles2-mesa-dev libx11-xcb-dev libgl1-mesa-dev libxrender-dev libxkbcommon-dev libxkbcommon-x11-dev \
    && rm -rf /var/lib/apt/lists/*

# Get CMake version 3.30.1
ENV CMAKE_VERSION=3.30.1
RUN wget https://github.com/Kitware/CMake/releases/download/v${CMAKE_VERSION}/cmake-${CMAKE_VERSION}-linux-x86_64.sh -O /tmp/cmake-install.sh \
    && chmod +x /tmp/cmake-install.sh \
    && mkdir /opt/cmake \
    && /tmp/cmake-install.sh --skip-license --prefix=/opt/cmake \
    && rm /tmp/cmake-install.sh
ENV PATH=/opt/cmake/bin:${PATH}
ENV CC=/usr/bin/gcc
ENV CXX=/usr/bin/g++

# # Install Ninja build system version 1.12.1
# RUN wget https://github.com/ninja-build/ninja/releases/download/v1.12.1/ninja-linux.zip -O /tmp/ninja-linux.zip && \
#     unzip /tmp/ninja-linux.zip -d /usr/local/bin && \
#     chmod +x /usr/local/bin/ninja && \
#     rm /tmp/ninja-linux.zip

# Set up vcpkg
WORKDIR /opt
RUN git clone https://github.com/microsoft/vcpkg.git \
    && cd vcpkg \
    && ./bootstrap-vcpkg.sh

# Set environment variables
ENV VCPKG_ROOT=/opt/vcpkg
ENV PATH="/opt/vcpkg:$PATH"

WORKDIR /workspace