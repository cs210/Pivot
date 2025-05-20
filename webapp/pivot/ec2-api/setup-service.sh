#!/bin/bash

# Update package lists
sudo apt-get update

# Install Node.js and npm if not already installed
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Install PM2 globally
sudo npm install -g pm2

# Copy the service file to systemd directory
sudo cp panorama-api.service /etc/systemd/system/

# Reload systemd to recognize the new service
sudo systemctl daemon-reload

# Enable the service to start on boot
sudo systemctl enable panorama-api

# Start the service
sudo systemctl start panorama-api

# Check the status
sudo systemctl status panorama-api

echo "Panorama API service has been installed and started!" 