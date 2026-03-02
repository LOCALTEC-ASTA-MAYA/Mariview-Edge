#!/bin/bash

# Mariview UI - Dependency Installation Script
# This script installs Node.js and project dependencies on a Linux server.

echo "🚀 Starting dependency installation..."

# 1. Update system
echo "📦 Updating system packages..."
sudo apt-get update -y

# 2. Install Node.js (v20) using NodeSource
if ! command -v node &> /dev/null; then
    echo "🟢 Installing Node.js v20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "✅ Node.js is already installed ($(node -v))"
fi

# 3. Verify Node and NPM
node -v
npm -v

# 4. Install Project Dependencies
if [ -f "package.json" ]; then
    echo "📦 Installing project dependencies..."
    npm install
    echo "✅ Dependencies installed successfully!"
else
    echo "❌ Error: package.json not found in the current directory."
    exit 1
fi

echo "🎉 Setup complete! You can now build the project with 'npm run build' or run in dev with 'npm run dev'."
