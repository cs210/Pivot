FROM ubuntu:20.04

# Set non-interactive mode
ENV DEBIAN_FRONTEND=noninteractive

# Install dependencies
RUN apt-get update && apt-get install -y \
    curl git unzip zip tar build-essential cmake ninja-build \
    pkg-config libx11-dev libgl1-mesa-dev tzdata \
    && rm -rf /var/lib/apt/lists/*

# Set up vcpkg
WORKDIR /opt
RUN git clone https://github.com/microsoft/vcpkg.git \
    && cd vcpkg \
    && ./bootstrap-vcpkg.sh

# Set environment variables
ENV VCPKG_ROOT=/opt/vcpkg
ENV PATH="/opt/vcpkg:$PATH"

WORKDIR /workspace
