#!/bin/bash

# Install SSH client for both build and runtime
apt-get update && apt-get install -y openssh-client

# Create SSH directory
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Build the application
npm run build 