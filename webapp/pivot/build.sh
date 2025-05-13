#!/bin/bash

# Install SSH client
apk add --no-cache openssh-client

# Create SSH directory
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Build the application
npm run build 