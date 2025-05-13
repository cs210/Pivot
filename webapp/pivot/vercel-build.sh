#!/bin/bash

# Install SSH client
apk add --no-cache openssh-client

# Build the application
npm run build 