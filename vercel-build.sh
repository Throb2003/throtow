#!/bin/bash

# Vercel Build Script
# This script is called by Vercel during the build process
# It ensures all environment variables are properly configured

set -e

echo "🔍 Vercel Build Script Started"
echo "================================"

# Print Node and npm versions
echo "📦 Node version: $(node --version)"
echo "📦 npm version: $(npm --version)"

# Install dependencies
echo ""
echo "📥 Installing dependencies..."
npm install

# Build the app
echo ""
echo "🏗️ Building application..."
npm run build

# Verify build output exists
if [ -d "app/dist" ]; then
    echo "✅ Build successful!"
    echo "📂 Output directory: app/dist"
    echo "📊 Build artifacts:"
    ls -lah app/dist/
else
    echo "❌ Build failed: app/dist not found"
    exit 1
fi

echo ""
echo "✅ Vercel deployment ready!"
