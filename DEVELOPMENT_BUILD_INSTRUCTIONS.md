# Development Build Instructions for react-native-maps

## Problem
`react-native-maps` requires native code that is not available in Expo Go. You need to create a development build.

## Solution: Create a Development Build

### Option 1: Local Build (Recommended for Testing)

1. **Prebuild native code:**
   ```bash
   npx expo prebuild --clean
   ```

2. **Run on Android:**
   ```bash
   npx expo run:android
   ```

3. **Or run on iOS:**
   ```bash
   npx expo run:ios
   ```

### Option 2: EAS Build (Cloud Build)

1. **Install EAS CLI (if not already installed):**
   ```bash
   npm install -g eas-cli
   ```

2. **Login to Expo:**
   ```bash
   eas login
   ```

3. **Configure EAS:**
   ```bash
   eas build:configure
   ```

4. **Build for Android:**
   ```bash
   eas build --platform android --profile development
   ```

5. **Build for iOS:**
   ```bash
   eas build --platform ios --profile development
   ```

6. **Install the build on your device:**
   - Android: Download APK from the build link
   - iOS: Install via TestFlight or direct link

## After Building

Once you have the development build installed:

1. Start the development server:
   ```bash
   npx expo start --dev-client
   ```

2. Open the app on your device (the development build you just installed)

3. The app will connect to the dev server and `react-native-maps` will work!

## Notes

- Development builds include all native modules (like `react-native-maps`)
- You only need to rebuild when you add/remove native dependencies
- JavaScript changes work with hot reload (no rebuild needed)
- The development build is different from Expo Go - install it once and use it for development

## Current Status

✅ `react-native-maps` plugin added to `app.json`
✅ `expo-dev-client` installed
⏳ **Next Step:** Create development build using one of the options above

