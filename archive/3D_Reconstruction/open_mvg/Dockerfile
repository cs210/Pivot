# Use Ubuntu 22.04 (will be supported until April 2027)
FROM ubuntu:jammy

# Add openMVG binaries to path
ENV PATH $PATH:/opt/openMVG_Build/install/bin

# Get dependencies
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y tzdata; \
  apt-get install -y \
  cmake \
  build-essential \
  graphviz \
  git \
  coinor-libclp-dev \
  libceres-dev \
  libjpeg-dev \
  liblemon-dev \
  libpng-dev \
  libtiff-dev \
  python3; \
  apt-get autoclean && apt-get clean

# Clone the openvMVG repo
RUN git clone --recursive https://github.com/openMVG/openMVG.git /opt/openMVG

# Build
RUN mkdir /opt/openMVG_Build; \
  cd /opt/openMVG_Build; \
  cmake -DCMAKE_BUILD_TYPE=RELEASE \
    -DCMAKE_INSTALL_PREFIX="/opt/openMVG_Build/install" \
    -DOpenMVG_BUILD_TESTS=ON \
    -DOpenMVG_BUILD_EXAMPLES=OFF \
    -DCOINUTILS_INCLUDE_DIR_HINTS=/usr/include \
    -DLEMON_INCLUDE_DIR_HINTS=/usr/include/lemon \
    -DCLP_INCLUDE_DIR_HINTS=/usr/include \
    -DOSI_INCLUDE_DIR_HINTS=/usr/include \
    ../openMVG/src; \
    make -j 4;

RUN cd /opt/openMVG_Build && make test && make install;

RUN mkdir /working
RUN mkdir /working/images
RUN mkdir /working/output 
RUN mkdir /working/output/sfm
RUN mkdir /working/output/sfm/matches
RUN mkdir /working/output/mvs

COPY images /working/images
COPY mvg_script.py /working/