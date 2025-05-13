#!/bin/bash
if command -v apk &> /dev/null; then
    # Alpine Linux
    apk add --no-cache openssh-client
elif command -v yum &> /dev/null; then
    # RHEL/CentOS
    yum install -y openssh-clients
elif command -v apt-get &> /dev/null; then
    # Debian/Ubuntu
    apt-get update && apt-get install -y openssh-client
else
    echo "No supported package manager found"
    exit 1
fi 