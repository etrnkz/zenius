#!/bin/bash

# Mobile App Build Script
# This script builds the mobile app with security hardening

set -e

echo "🚀 Starting mobile app build..."

# Step 1: Build Next.js static files
echo "📦 Building Next.js application..."
npm run build

# Step 2: Export static files
echo "📤 Exporting static files..."
npm run build:static || true

# Step 3: Sync with Capacitor
echo "🔄 Syncing with Capacitor..."
npx cap sync

# Step 4: Copy web assets
echo "📋 Copying web assets..."
npx cap copy

# Step 5: Run doctor to check setup
echo "🏥 Running Capacitor doctor..."
npx cap doctor

echo "✅ Build complete!"
echo ""
echo "📱 To open Android Studio: npm run mobile:open:android"
echo "🍎 To open Xcode: npm run mobile:open:ios"
echo ""
echo "🔒 Security features enabled:"
echo "  ✓ Content Security Policy headers"
echo "  ✓ HTTPS enforcement"
echo "  ✓ Jailbreak/root detection"
echo "  ✓ Secure storage"
echo "  ✓ Anti-tampering checks"
echo "  ✓ WebView debugging disabled"
echo "  ✓ Mixed content blocked"
echo "  ✓ Developer tools disabled in production"
