# 📱 Build Android APK on Fedora (No Android Studio!)

## Quick Steps for Fedora:

### 1. Install Java JDK

```bash
sudo dnf install -y java-17-openjdk java-17-openjdk-devel
```

### 2. Verify Installation

```bash
java -version
javac -version
```

### 3. Build Your APK

```bash
cd /home/sud/Desktop/study-helper-ai-main
./scripts/build-apk.sh
```

---

## Manual Build (If Script Doesn't Work):

```bash
# Install Java
sudo dnf install -y java-17-openjdk java-17-openjdk-devel

# Download Android SDK
mkdir -p ~/Android/Sdk
cd ~/Android/Sdk

# Download command-line tools
wget https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip commandlinetools-linux-11076708_latest.zip
mkdir -p cmdline-tools
mv cmdline-tools latest 2>/dev/null || true
mv latest cmdline-tools/

# Set environment variables
export ANDROID_HOME=~/Android/Sdk
export ANDROID_SDK_ROOT=~/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools

# Install SDK components
yes | sdkmanager --licenses
sdkmanager "platform-tools"
sdkmanager "platforms;android-34"
sdkmanager "build-tools;34.0.0"

# Build APK
cd /home/sud/Desktop/study-helper-ai-main
npm run build
npx cap sync android
cd android
./gradlew assembleDebug

# APK will be at:
# android/app/build/outputs/apk/debug/app-debug.apk
```

---

## Install on Phone:

```bash
# Install adb
sudo dnf install -y android-tools

# Connect phone via USB, then:
adb install android/app/build/outputs/apk/debug/app-debug.apk
```
