# EAS Updates Troubleshooting Guide

## ✅ Configuration Fixed

### Issues Found & Fixed:

1. **Missing `updates.enabled`** - Added `"enabled": true`
2. **Missing `updates.checkAutomatically`** - Added `"checkAutomatically": "ON_LOAD"`
3. **Manual update check interfering** - Removed manual check (expo-updates handles automatically)
4. **Fallback timeout** - Added `"fallbackToCacheTimeout": 0` for immediate updates

## Current Configuration

### app.json
```json
"updates": {
  "url": "https://u.expo.dev/fea648b8-04c9-4a91-aeb4-a3fcd5a6b55b",
  "enabled": true,
  "checkAutomatically": "ON_LOAD",
  "fallbackToCacheTimeout": 0
},
"runtimeVersion": {
  "policy": "appVersion"
}
```

### eas.json
```json
"production": {
  "developmentClient": false,
  "distribution": "internal",
  "channel": "production",
  ...
}
```

## How to Verify Updates Work

### 1. Check Build Configuration

Verify your production build has updates enabled:
```bash
eas build:list --platform android --limit 5
```

Look for:
- ✅ `developmentClient: false` (not a dev build)
- ✅ `channel: production`

### 2. Publish Update

```bash
eas update --branch production --message "Test update"
```

### 3. Check Update Status

```bash
eas update:list --branch production --limit 5
```

Verify:
- ✅ Update appears in list
- ✅ Runtime version matches (should be "1.0.0" with current config)
- ✅ Channel is "production"

### 4. Test in Installed App

**IMPORTANT:** The installed app must:
- ✅ Be a **production build** (not development/preview)
- ✅ Have been built **AFTER** adding updates configuration
- ✅ Have matching `runtimeVersion` (currently "1.0.0")
- ✅ Not be installed via Expo Go (must be standalone APK)

### 5. Update Behavior

With `checkAutomatically: "ON_LOAD"`:
- App checks for updates **every time it starts**
- Updates download automatically in background
- Update applies **on next app restart** (close and reopen)

## Common Issues

### Updates Not Applying?

1. **Build was created before updates config was added**
   - Solution: Create a new production build
   - ```bash
     eas build --platform android --profile production
     ```

2. **Runtime version mismatch**
   - Check: `app.json` version must match
   - If you change `version`, you need a new build

3. **Wrong channel**
   - Build channel must match update channel
   - Verify: `eas update:list --branch production`

4. **Development build installed**
   - Development builds don't receive OTA updates
   - Solution: Build with `developmentClient: false`

5. **Update not published to correct channel**
   - Verify: `eas update:list --branch production`
   - Republish: `eas update --branch production --message "update"`

## Required Steps for Updates to Work

### Step 1: Ensure Configuration (✅ DONE)
- ✅ `updates.enabled: true` in app.json
- ✅ `updates.checkAutomatically: "ON_LOAD"` in app.json
- ✅ `channel: "production"` in eas.json production profile
- ✅ `developmentClient: false` for production builds

### Step 2: Build Production App (⚠️ REQUIRED)
If your current build was created BEFORE these fixes, rebuild:

```bash
# Increment version if needed (optional, but recommended)
# Edit app.json: "version": "1.0.1"

# Build production app
eas build --platform android --profile production

# Install the new APK
```

### Step 3: Publish Updates
```bash
# After making code changes
eas update --branch production --message "Your update message"
```

### Step 4: Test
1. Open the installed production app
2. Close the app completely (not just background)
3. Reopen the app
4. Update should download and apply automatically

## Debugging

### Check if Updates Module is Working

Add this temporary code to see update status:

```typescript
import * as Updates from 'expo-updates';

// In your component
useEffect(() => {
  if (Updates.isEnabled) {
    console.log('Updates enabled');
    console.log('Update ID:', Updates.updateId);
    console.log('Channel:', Updates.channel);
    console.log('Runtime Version:', Updates.runtimeVersion);
  } else {
    console.log('Updates disabled');
  }
}, []);
```

### Verify Update Download

Check logs for:
- `[Updates] Checking for updates...`
- `[Updates] Update available`
- `[Updates] Downloading update...`
- `[Updates] Update downloaded`

## Next Steps

1. **Rebuild production app** (if current build is old)
2. **Publish an update**: `eas update --branch production --message "test"`
3. **Test**: Close and reopen app
4. **Verify**: Check if update applied




