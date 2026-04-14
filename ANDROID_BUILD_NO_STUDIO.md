# 📱 Build Android APK WITHOUT Android Studio

You **DON'T need Android Studio** to build your app! Here are 3 easy options:

---

## 🚀 Option 1: Use Command-Line Tools (Recommended)

This installs only the minimum required tools (no heavy Android Studio).

### Step 1: Install Java JDK

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install openjdk-17-jdk

# Verify installation
java -version
javac -version
```

### Step 2: Download Android SDK Command-Line Tools

```bash
# Create Android SDK directory
mkdir -p ~/Android/Sdk
cd ~/Android/Sdk

# Download command-line tools
wget https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip

# Extract
unzip commandlinetools-linux-11076708_latest.zip
mv cmdline-tools latest
mkdir cmdline-tools
mv latest cmdline-tools/

# Set environment variables
echo 'export ANDROID_HOME=~/Android/Sdk' >> ~/.bashrc
echo 'export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools' >> ~/.bashrc
source ~/.bashrc
```

### Step 3: Install Required SDK Components

```bash
# Accept licenses
yes | sdkmanager --licenses

# Install required components
sdkmanager "platforms;android-34"
sdkmanager "build-tools;34.0.0"
sdkmanager "platform-tools"
```

### Step 4: Build Your App

```bash
cd /home/sud/Desktop/study-helper-ai-main

# Build web app
npm run build

# Sync with Capacitor
npx cap sync android

# Build APK (command line, NO Android Studio needed!)
cd android
./gradlew assembleDebug

# Your APK will be in:
# android/app/build/outputs/apk/debug/app-debug.apk
```

### Step 5: Install on Device

```bash
# Connect your Android phone via USB
# Enable USB debugging in Developer Options

# Install APK
adb install app/build/outputs/apk/debug/app-debug.apk
```

---

## ☁️ Option 2: Use Online Cloud Build Services (EASIEST!)

No installation needed! Upload your code and get an APK.

### A. **Expo Application Services (EAS) Alternative - Capacitor**

Use [**CapGo**](https://capgo.app/) - Free tier available!

```bash
# Install CapGo CLI
npm install -g @capgo/cli

# Login
capgo login

# Build in cloud
capgo upload
capgo build android
```

### B. **GitHub Actions (Free!)**

Build automatically every time you push to GitHub:

1. Push your code to GitHub
2. Go to: Actions → New workflow
3. Use this workflow:

```yaml
name: Build Android APK

on:
  push:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Build web app
      run: npm run build
      
    - name: Setup Java
      uses: actions/setup-java@v3
      with:
        distribution: 'temurin'
        java-version: '17'
        
    - name: Setup Android SDK
      uses: android-actions/setup-android@v2
      
    - name: Sync Capacitor
      run: npx cap sync android
      
    - name: Build APK
      run: |
        cd android
        ./gradlew assembleDebug
        
    - name: Upload APK
      uses: actions/upload-artifact@v3
      with:
        name: app-debug
        path: android/app/build/outputs/apk/debug/app-debug.apk
```

4. Commit and push
5. Download APK from Actions tab!

### C. **Appetize.io (Test Without Building)**

Test your app in browser instantly:
- Go to https://appetize.io
- Upload your APK
- Test in browser - no phone needed!

---

## 🐳 Option 3: Use Docker (Clean & Isolated)

If you have Docker installed:

```bash
# Pull Android build image
docker run -it --rm \
  -v "$(pwd)":/app \
  -w /app \
  node:18 bash

# Inside container
npm install
npm run build
npx cap sync android

# Install Java & Android SDK
apt update && apt install -y openjdk-17-jdk wget unzip
# ... follow Option 1 steps
```

---

## 📦 Option 4: Use Pre-built APK Service

### **Capacitor Cloud Build**

Services that build for you:
- [**Volt Builder**](https://volt.build/) - Ionic/Capacitor cloud builds
- [**AppFlow**](https://ionic.io/appflow) - Official Ionic/Capacitor service
- [**Codemagic**](https://codemagic.io/) - Free tier for mobile builds

---

## ✅ Quickest Path (My Recommendation)

**For testing on your phone RIGHT NOW:**

1. **Use GitHub Actions** (Option 2B)
   - Push code to GitHub
   - Wait 10 minutes
   - Download APK
   - Install on phone

**For local builds without Android Studio:**

1. **Install command-line tools** (Option 1)
   - Takes ~15 minutes
   - One-time setup
   - Full control

---

## 🔍 Verify Your Build

After building, check your APK:

```bash
# Check APK info
aapt dump badging android/app/build/outputs/apk/debug/app-debug.apk

# Should show:
# package: name='com.studyhelper.ai'
# application-label:'Study Helper AI'
# sdkVersion:'22'
# targetSdkVersion:'34'
```

---

## 📱 Install on Your Phone

### Method 1: USB Cable
```bash
# Enable USB debugging on phone
# Settings → About Phone → Tap "Build Number" 7 times
# Settings → Developer Options → USB Debugging

# Install
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

### Method 2: Share APK
```bash
# Copy APK to phone storage
adb push android/app/build/outputs/apk/debug/app-debug.apk /sdcard/Download/

# Or share via Google Drive, Dropbox, etc.
# Open on phone and install
```

### Method 3: QR Code
```bash
# Host APK temporarily
python3 -m http.server 8080

# Scan QR code with phone
# Download and install
```

---

## 🆘 Troubleshooting

### "SDK not found"
```bash
export ANDROID_HOME=~/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

### "Gradle build failed"
```bash
cd android
./gradlew clean
cd ..
npx cap sync android
cd android
./gradlew assembleDebug
```

### "ADB device not found"
```bash
# Check USB connection
lsusb

# Restart ADB
adb kill-server
adb start-server
adb devices
```

---

## 🎯 Summary

| Method | Time | Cost | Difficulty |
|--------|------|------|------------|
| GitHub Actions | 10 min | FREE | ⭐ Easy |
| Command-Line Tools | 15 min | FREE | ⭐⭐ Medium |
| Cloud Services | 5 min | Freemium | ⭐ Easy |
| Docker | 20 min | FREE | ⭐⭐⭐ Hard |

**Recommendation:** Start with **GitHub Actions** - no installation, completely free, automated!

---

## 📚 Next Steps

1. ✅ Choose a build method above
2. 📦 Build your APK
3. 📱 Install on your phone
4. 🧪 Test all features
5. 🚀 Ready to use!

Need help? Check:
- `MOBILE_SETUP.md` - Detailed setup guide
- `SECURITY.md` - Security features
- Capacitor docs: https://capacitorjs.com/docs/android
