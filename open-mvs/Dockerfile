# To build: docker build -t open-mvs .
# To run: docker run -it open-mvs

FROM ubuntu:20.04

# Set non-interactive mode
ENV DEBIAN_FRONTEND=noninteractive

# Install dependencies
RUN apt-get update && apt-get install -y \
    git build-essential wget \
    curl zip unzip tar \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# 

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

# Install Ninja build system version 1.12.1
RUN wget https://github.com/ninja-build/ninja/releases/download/v1.12.1/ninja-linux.zip -O /tmp/ninja-linux.zip && \
    unzip /tmp/ninja-linux.zip -d /usr/local/bin && \
    chmod +x /usr/local/bin/ninja && \
    rm /tmp/ninja-linux.zip

# Set up vcpkg
WORKDIR /opt
RUN git clone https://github.com/microsoft/vcpkg.git \
    && cd vcpkg \
    && ./bootstrap-vcpkg.sh

# Set environment variables
ENV VCPKG_ROOT=/opt/vcpkg
ENV PATH="/opt/vcpkg:$PATH"

# RUN echo "find_package(OpenMVS)\n\
#     if(OpenMVS_FOUND)\n\
#         include_directories(\${OpenMVS_INCLUDE_DIRS})\n\
#         add_definitions(\${OpenMVS_DEFINITIONS})\n\
#     endif()\n\
#     \n\
#     add_executable(your_project source_code.cpp)\n\
#     target_link_libraries(your_project PRIVATE OpenMVS::MVS)" >> $VCPKG_ROOT/scripts/buildsystems/vcpkg.cmake

WORKDIR /workspace
