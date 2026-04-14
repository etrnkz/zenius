# 📱 Mobile App Setup Guide

This guide will help you convert your Study Helper AI web app into a secure mobile application using Capacitor.

## 📋 Prerequisites

### For Android:
- Android Studio (latest version)
- Java JDK 17 or higher
- Android SDK (API 22+)
- Gradle 8+

### For iOS:
- macOS (required)
- Xcode (latest version)
- CocoaPods (`sudo gem install cocoapods`)

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Build the App

```bash
# Option A: Use the automated build script
./scripts/build-mobile.sh

# Option B: Manual build
npm run build
npm run mobile:prepare
```

### 3. Open in IDE

```bash
# For Android
npm run mobile:open:android

# For iOS
npm run mobile:open:ios
```

### 4. Build and Run

In Android Studio or Xcode:
- Connect your device or start an emulator
- Click "Run" or press Shift+F10

## 🔒 Security Features Implemented

### ✅ Already Implemented:

1. **Content Security Policy (CSP)**
   - Prevents XSS attacks
   - Blocks unauthorized script execution
   - See `middleware.ts`

2. **WebView Hardening**
   - Debugging disabled in production
   - Mixed content blocked
   - Input capture enabled

3. **Jailbreak/Root Detection**
   - Automatic detection on app start
   - Logs security warnings
   - See `lib/security.ts`

4. **Secure Storage**
   - Encrypted preferences for sensitive data
   - Automatic cleanup on app start

5. **Anti-Tampering**
   - Developer tools disabled in production
   - Right-click disabled
   - Keyboard shortcuts blocked

6. **HTTPS Enforcement**
   - HSTS headers
   - Mixed content prevention

### ⚠️ Recommended Before Production:

1. **Certificate Pinning**
   ```bash
   npm install @capacitor/certificate-transparency
   ```
   Prevents man-in-the-middle attacks

2. **Code Obfuscation (Android)**
   Add to `android/app/build.gradle`:
   ```gradle
   buildTypes {
       release {
           minifyEnabled true
           proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
       }
   }
   ```

3. **App Signing**
   - Generate keystore: `keytool -genkey -v -keystore app-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias app`
   - Configure in `android/app/build.gradle`

4. **iOS App Transport Security**
   - Already configured by default
   - Only HTTPS allowed

## 📂 Project Structure

```
study-helper-ai-main/
├── android/                 # Generated Android project
├── ios/                     # Generated iOS project
├── components/
│   └── security-provider.tsx   # Security initialization
├── lib/
│   └── security.ts            # Security utilities
├── scripts/
│   └── build-mobile.sh        # Build automation
├── capacitor.config.ts      # Capacitor configuration
├── middleware.ts            # Security headers
├── next.config.mjs          # Static export config
├── SECURITY.md              # Security documentation
└── MOBILE_SETUP.md          # This file
```

## 🔧 Configuration

### capacitor.config.ts
```typescript
{
  appId: 'com.studyhelper.ai',
  appName: 'Study Helper AI',
  webDir: 'out',              // Static build output
  plugins: {
    CapacitorHttp: { enabled: true },
    CapacitorCookies: { enabled: true }
  },
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: false
  }
}
```

### Environment Variables

Create `.env.production`:
```env
# API Keys (use server-side only)
CEREBRAS_API_KEY=your_key_here
# Add other API keys as needed
```

## 🐛 Troubleshooting

### Build Fails

**Error: Cannot find module 'out'**
```bash
npm run build
npx cap sync
```

**Error: WebView not found**
```bash
npx cap doctor
npx cap update
```

### App Crashes on Start

1. Check console logs in Android Studio/Xcode
2. Verify `out/` directory exists and has files
3. Run `npx cap sync --force`

### Hot Reload Not Working

For development with live reload:
```bash
CAP_SERVER_URL=http://localhost:3000 npx cap run android
```

### Security Errors

**CSP Violations:**
- Check browser console for blocked resources
- Update `middleware.ts` CSP rules if needed

**Mixed Content Blocked:**
- Ensure all APIs use HTTPS
- Check for HTTP resources in your code

## 📊 Performance Optimization

### Android
```gradle
// android/app/build.gradle
android {
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
}
```

### iOS
- Enable bitcode in Xcode build settings
- Use release configuration for App Store

### General
- Minimize bundle size
- Lazy load components
- Optimize images
- Use service worker for caching

## 🧪 Testing

### Manual Testing Checklist

- [ ] App launches without crashes
- [ ] All features work (notes, flashcards, quizzes, podcast)
- [ ] Voice playback works
- [ ] Quiz generation works
- [ ] No console errors
- [ ] Security headers present
- [ ] HTTPS enforced
- [ ] Right-click disabled (production)
- [ ] Developer tools blocked

### Security Testing

```bash
# Check for vulnerabilities
npm audit

# Verify CSP headers
curl -I http://localhost:3000

# Test jailbreak detection
# Run on jailbroken/rooted device
```

## 📦 Publishing

### Android (Google Play)

1. Build release APK:
   ```bash
   npm run mobile:build:android
   ```

2. Open in Android Studio
3. Build > Generate Signed Bundle/APK
4. Upload to Google Play Console

### iOS (App Store)

1. Build in Xcode
2. Product > Archive
3. Distribute to App Store Connect
4. Submit for review

## 🔐 App Store Security Checklist

Before submission:

- [ ] All API endpoints use HTTPS
- [ ] No hardcoded secrets in source code
- [ ] ProGuard/R8 enabled (Android)
- [ ] App signing configured
- [ ] Certificate pinning (recommended)
- [ ] Jailbreak detection active
- [ ] CSP headers working
- [ ] No debug logs in production
- [ ] Permissions minimized
- [ ] Privacy policy included

## 📚 Additional Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Android Security Best Practices](https://developer.android.com/topic/security/best-practices)
- [iOS Security Guide](https://support.apple.com/guide/security/welcome/ios)
- [OWASP Mobile Security](https://owasp.org/www-project-mobile-top-10/)

## 🆘 Support

If you encounter issues:

1. Check this guide's troubleshooting section
2. Run `npx cap doctor` for diagnostics
3. Check `SECURITY.md` for security-related questions
4. Review console logs in Android Studio/Xcode

## 🎯 Next Steps

1. ✅ Capacitor configuration complete
2. ✅ Security features implemented
3. ✅ Build scripts created
4. ⏳ Run `npm run mobile:prepare`
5. ⏳ Open in Android Studio/Xcode
6. ⏳ Test on real device
7. ⏳ Submit to app stores
