#!/bin/bash

##############################################################################
# 📱 Automated Android APK Build Script (NO Android Studio Required!)
# 
# This script will:
# 1. Check/install Java JDK
# 2. Download Android SDK command-line tools
# 3. Install required SDK components
# 4. Build your APK
# 5. Show you where to find it
##############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   📱  Android APK Builder (No Android Studio!)       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Check Java
echo -e "${YELLOW}[1/6] Checking Java JDK...${NC}"
if command -v java &> /dev/null; then
    JAVA_VERSION=$(java -version 2>&1 | head -n 1)
    echo -e "${GREEN}✓ Found: $JAVA_VERSION${NC}"
else
    echo -e "${RED}✗ Java not found. Installing OpenJDK 17...${NC}"
    echo "Please run: sudo apt install openjdk-17-jdk"
    echo "Then run this script again."
    exit 1
fi

# Check javac
if ! command -v javac &> /dev/null; then
    echo -e "${RED}✗ javac not found. Please install JDK development files:${NC}"
    echo "sudo apt install openjdk-17-jdk"
    exit 1
fi

# Step 2: Setup Android SDK
echo -e "\n${YELLOW}[2/6] Setting up Android SDK...${NC}"
ANDROID_SDK_ROOT="$HOME/Android/Sdk"

if [ -d "$ANDROID_SDK_ROOT" ] && [ -f "$ANDROID_SDK_ROOT/cmdline-tools/latest/bin/sdkmanager" ]; then
    echo -e "${GREEN}✓ Android SDK already installed${NC}"
else
    echo -e "${BLUE}Downloading Android SDK command-line tools...${NC}"
    mkdir -p "$ANDROID_SDK_ROOT"
    cd "$ANDROID_SDK_ROOT"
    
    # Download
    if [ ! -f "commandlinetools.zip" ]; then
        wget -q --show-progress https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -O commandlinetools.zip
    fi
    
    # Extract
    echo "Extracting..."
    unzip -q commandlinetools.zip
    mkdir -p cmdline-tools
    mv cmdline-tools latest 2>/dev/null || true
    mv latest cmdline-tools/ 2>/dev/null || true
    
    echo -e "${GREEN}✓ Android SDK downloaded${NC}"
fi

# Step 3: Set environment variables
echo -e "\n${YELLOW}[3/6] Configuring environment...${NC}"
export ANDROID_SDK_ROOT="$ANDROID_SDK_ROOT"
export ANDROID_HOME="$ANDROID_SDK_ROOT"
export PATH="$PATH:$ANDROID_SDK_ROOT/cmdline-tools/bin:$ANDROID_SDK_ROOT/platform-tools"

# Add to bashrc if not already there
if ! grep -q "ANDROID_SDK_ROOT" ~/.bashrc 2>/dev/null; then
    echo "" >> ~/.bashrc
    echo "export ANDROID_SDK_ROOT=\$HOME/Android/Sdk" >> ~/.bashrc
    echo "export ANDROID_HOME=\$HOME/Android/Sdk" >> ~/.bashrc
    echo "export PATH=\$PATH:\$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:\$ANDROID_SDK_ROOT/platform-tools" >> ~/.bashrc
    echo -e "${GREEN}✓ Added to ~/.bashrc${NC}"
fi

# Step 4: Install SDK components
echo -e "\n${YELLOW}[4/6] Installing Android SDK components...${NC}"
cd "$ANDROID_SDK_ROOT"

# Accept licenses
echo "Accepting licenses..."
yes | sdkmanager --licenses > /dev/null 2>&1 || true

# Install required components
echo "Installing platform-tools..."
sdkmanager "platform-tools" > /dev/null 2>&1 || echo "Already installed"

echo "Installing Android platform..."
sdkmanager "platforms;android-34" > /dev/null 2>&1 || echo "Already installed"

echo "Installing build tools..."
sdkmanager "build-tools;34.0.0" > /dev/null 2>&1 || echo "Already installed"

echo -e "${GREEN}✓ SDK components ready${NC}"

# Step 5: Build the app
echo -e "\n${YELLOW}[5/6] Building your app...${NC}"
cd /home/sud/Desktop/study-helper-ai-main

echo "Building web app..."
npm run build

echo "Preparing web assets for Capacitor..."
mkdir -p out
cp -r .next/server/app/* out/
cp -r .next/server/pages out/ 2>/dev/null || true
mkdir -p out/_next
cp -r .next/static/* out/_next/ 2>/dev/null || true
cp -r public/* out/ 2>/dev/null || true

echo "Syncing with Capacitor..."
npx cap sync android

echo "Building APK..."
cd android
chmod +x gradlew
export JAVA_HOME=/usr/lib/jvm/java-25-openjdk
./gradlew assembleDebug --no-daemon

# Step 6: Show results
echo -e "\n${YELLOW}[6/6] Build Complete! 🎉${NC}"
echo ""

APK_PATH="app/build/outputs/apk/debug/app-debug.apk"
if [ -f "$APK_PATH" ]; then
    APK_SIZE=$(du -h "$APK_PATH" | cut -f1)
    echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║              ✅ APK BUILD SUCCESSFUL!                ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}📦 APK Location:${NC} $APK_PATH"
    echo -e "${BLUE}📏 APK Size:${NC} $APK_SIZE"
    echo -e "${BLUE}📱 Package:${NC} com.studyhelper.ai"
    echo ""
    echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}📱 HOW TO INSTALL ON YOUR PHONE:${NC}"
    echo -e "${YELLOW}═══════════════════════════════════════════════════════${NC}"
    echo ""
    echo "Method 1: USB Cable"
    echo "  adb install $APK_PATH"
    echo ""
    echo "Method 2: Share to Phone"
    echo "  1. Copy APK to Google Drive/Dropbox"
    echo "  2. Open on your phone"
    echo "  3. Tap to install"
    echo ""
    echo "Method 3: Local Server"
    echo "  cd /home/sud/Desktop/study-helper-ai-main/android"
    echo "  python3 -m http.server 8080"
    echo "  # Then visit http://YOUR_IP:8080/app/$APK_PATH on phone"
    echo ""
    echo -e "${GREEN}✅ Your app is ready to use!${NC}"
else
    echo -e "${RED}❌ Build failed! APK not found.${NC}"
    echo "Check the error messages above."
    exit 1
fi
