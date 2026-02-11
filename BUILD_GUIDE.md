# Bulletproof Journal - APK Build Guide

## Overview
This guide explains how to build an installable APK for the Bulletproof Journal Android app.

## Prerequisites
- Node.js installed
- Expo account (free)
- EAS CLI installed globally

## Step-by-Step Build Process

### 1. Install EAS CLI (One-time setup)
```powershell
npm install -g eas-cli
```

### 2. Navigate to the mobile app directory
```powershell
cd "d:\FULL STACK DEVELOPMENT\Self-done projects\Medium projects\Bulletproof journal\mobile-app"
```

### 3. Login to your Expo account
```powershell
eas login
```
Enter your Expo credentials when prompted.

### 4. Configure EAS Build (Already done)
The project is already configured with `eas.json` containing the APK build profile.

### 5. Build the APK
```powershell
eas build -p android --profile apk
```

This command will:
- Upload your project to Expo's build servers
- Build the APK in the cloud
- Provide a download link when complete

### 6. Download Your APK
Once the build completes (10-20 minutes), you'll receive:
- A download link in the terminal
- An email with the APK download link
- Access via the Expo dashboard: https://expo.dev

### 7. Install on Android Device

#### Method 1: Direct Download
1. Open the download link on your Android device
2. Download the APK file
3. Enable "Install from Unknown Sources" in Settings
4. Tap the APK file to install

#### Method 2: Transfer via USB
1. Download the APK to your computer
2. Connect your Android device via USB
3. Copy the APK to your device
4. Use a file manager to locate and install the APK

## Build Profiles

### APK Profile (Recommended for personal use)
```powershell
eas build -p android --profile apk
```
- Creates a single APK file
- Easy to distribute and install
- Perfect for testing and personal use

### Production Profile (For Play Store)
```powershell
eas build -p android --profile production
```
- Creates an AAB (Android App Bundle)
- Required for Google Play Store submission
- Optimized for different device configurations

## Troubleshooting

### Build Fails
- Check the build logs at the provided URL
- Ensure all dependencies are installed
- Verify app.json configuration is correct

### APK Won't Install
- Enable "Install from Unknown Sources"
- Check if you have enough storage space
- Try uninstalling any previous version first

### App Crashes on Launch
- Ensure the backend server is running
- Update the IP address in `api-config.js` to match your network
- Check device logs using `adb logcat`

## Important Notes

### Backend Connection
The app connects to your backend server at the IP address configured in:
`mobile-app/src/config/api-config.js`

**For the APK to work properly:**
1. Keep your backend server running
2. Your Android device must be on the same Wi-Fi network as your computer
3. If your computer's IP changes, you'll need to:
   - Update `api-config.js`
   - Rebuild the APK

### Production Deployment
For a production app that doesn't require a local backend:
1. Deploy your backend to a cloud service (e.g., Heroku, Railway, Render)
2. Update the API_BASE_URL to use the production URL
3. Rebuild the APK

## Build Commands Reference

```powershell
# Check build status
eas build:list

# View specific build details
eas build:view [BUILD_ID]

# Cancel a running build
eas build:cancel

# Configure/reconfigure EAS
eas build:configure
```

## Resources
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [Expo Dashboard](https://expo.dev)
- [Android APK Installation Guide](https://www.wikihow.com/Install-APK-Files-on-Android)

## Version Information
- App Name: Bulletproof Journal
- Version: 1.0.0
- Package: com.bulletproofjournal.app
- SDK: Expo 54.0.0
