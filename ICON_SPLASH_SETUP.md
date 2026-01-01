# Icon & Splash Screen Setup Guide

## Current Situation

Aapko booker aur salesman ke liye **alag icons aur splash screens** chahiye. 

## Important Note: Native Apps mein Icon/Splash Runtime par Change Nahi Ho Sakte

Icons aur splash screens **build time** par set hoti hain, runtime par change nahi ho sakti. Iska matlab:

- ❌ Ek hi app mein user role ke basis par icon change nahi hoga
- ✅ Different icons ke liye separate builds chahiye

## Options:

### Option 1: Separate Apps (Recommended for Different Icons)

**Booker App:**
- Package: `com.pafood.booking.booker`
- Icon: `assets/icon-booker.png`
- Splash: `assets/splash-booker.png`
- Name: "PAFood Booker"

**Salesman App:**
- Package: `com.pafood.booking.salesman`  
- Icon: `assets/icon-salesman.png`
- Splash: `assets/splash-salesman.png`
- Name: "PAFood Salesman"

**Pros:**
- ✅ Different branding for each role
- ✅ Separate apps in device
- ✅ Role-specific icons

**Cons:**
- ⚠️ Two separate builds needed
- ⚠️ Two separate apps to maintain

### Option 2: Unified App (Current Setup)

**Single App:**
- Package: `com.pafood.booking`
- Icon: `assets/icon.png` (unified)
- Splash: `assets/splash-icon.png` (unified)
- Name: "PAFood Booking"

**Pros:**
- ✅ One build, one app
- ✅ Easier maintenance
- ✅ Single codebase

**Cons:**
- ❌ Same icon for all roles

## Current Assets Needed

Agar separate icons chahiye, to ye files prepare karein:

```
assets/
├── icon-booker.png (1024x1024)
├── icon-salesman.png (1024x1024)
├── adaptive-icon-booker.png (1024x1024, Android)
├── adaptive-icon-salesman.png (1024x1024, Android)
├── splash-booker.png (1284x2778 recommended)
└── splash-salesman.png (1284x2778 recommended)
```

## Recommendation

Agar **same functionality** hai aur sirf branding different chahiye:
- Use **Option 2** (unified app) for simplicity
- Ya **Option 1** agar branding bahut important hai

## Next Steps

1. Decide karein: Separate apps ya unified?
2. Agar separate: Assets prepare karein
3. Main setup kar dunga accordingly






