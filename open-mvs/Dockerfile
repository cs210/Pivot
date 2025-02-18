# To build: docker build -t openmvs .
# To run: docker run -it --rm openmvs

# Use a lightweight Ubuntu base image
FROM ubuntu:22.04

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV VCPKG_ROOT=/opt/vcpkg
ENV LD_LIBRARY_PATH=/usr/local/lib
ENV CC=/usr/bin/gcc
ENV CXX=/usr/bin/g++

# Install required dependencies
RUN apt-get update && apt-get install -y \
    git cmake g++ make \
    build-essential \
    libopencv-dev \
    libboost-all-dev \
    libeigen3-dev \
    libcgal-dev \
    libglfw3-dev \
    curl zip unzip tar \
    bison \
    pkg-config \
    ninja-build \
    gettext \
    python3 \
    python3-pip \
    autoconf \
    automake \
    libtool \
    flex \
    && rm -rf /var/lib/apt/lists/*

# Install vcpkg for dependency management
WORKDIR /opt
RUN git clone https://github.com/microsoft/vcpkg.git && \
    cd vcpkg && ./bootstrap-vcpkg.sh

# Clone OpenMVS repository
WORKDIR /opt
RUN git clone --recurse-submodules https://github.com/cdcseacave/openMVS.git

# Create a build directory
WORKDIR /opt/openMVS
RUN mkdir -p make
WORKDIR /opt/openMVS/make

# Configure OpenMVS with CMake and vcpkg toolchain
RUN cmake .. \
    -DCMAKE_TOOLCHAIN_FILE=/opt/vcpkg/scripts/buildsystems/vcpkg.cmake \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_C_COMPILER=/usr/bin/gcc \
    -DCMAKE_CXX_COMPILER=/usr/bin/g++ \
    -G "Unix Makefiles"

# Build OpenMVS using all available CPU cores
RUN cmake --build . -j$(nproc)

# Install OpenMVS
RUN cmake --install .

# Default command to keep the container interactive
CMD ["/bin/bash"]