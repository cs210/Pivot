# To build: docker build -t openmvs .
# To run: docker run -it --rm openmvs

# The first build took me ~ .

# Use a lightweight Ubuntu base image
FROM ubuntu:22.04

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV VCPKG_ROOT=/opt/vcpkg

# Install required dependencies (including curl, zip, unzip, tar)
RUN apt-get update && apt-get install -y \
    git cmake g++ make \
    libopencv-dev \
    libboost-all-dev \
    libeigen3-dev \
    libcgal-dev \
    libglfw3-dev \
    curl zip unzip tar \
    && rm -rf /var/lib/apt/lists/*

# Install vcpkg for dependency management
WORKDIR /opt
RUN git clone https://github.com/microsoft/vcpkg.git && \
    cd vcpkg && ./bootstrap-vcpkg.sh

# Clone OpenMVS repository
WORKDIR /opt
RUN git clone --recurse-submodules https://github.com/cdcseacave/openMVS.git

# Create a build directory
WORKDIR /opt/openMVS/make

# Configure OpenMVS with CMake and vcpkg toolchain
RUN cmake .. -DCMAKE_TOOLCHAIN_FILE=/opt/vcpkg/scripts/buildsystems/vcpkg.cmake

# Build OpenMVS using all available CPU cores
RUN cmake --build . -j$(nproc)

# Install OpenMVS
RUN cmake --install .

# Set the OpenMVS library path
ENV LD_LIBRARY_PATH=/usr/local/lib:$LD_LIBRARY_PATH

# Default command to keep the container interactive
CMD ["/bin/bash"]