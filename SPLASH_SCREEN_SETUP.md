# Role-Based Splash Screen Setup

## ✅ Implementation Complete

Role-based splash screen ab implement ho chuki hai! Login ke baad user role ke basis par different splash screen show hogi.

## 📋 Current Status

- ✅ Code implementation complete
- ✅ Working with existing splash-icon.png (temporary)
- ⏳ Custom splash images add kar sakte hain (optional)

## 🎨 Current Behavior

1. **Booker Login:**
   - Red background (colors.primary[500])
   - Title: "PAFood Booker"
   - Subtitle: "Order Booking System"
   - Shows for 2 seconds
   - Uses existing `splash-icon.png` (temporary)

2. **Salesman Login:**
   - Green background (colors.secondary[500])
   - Title: "PAFood Salesman"
   - Subtitle: "Delivery Management"
   - Shows for 2 seconds
   - Uses existing `splash-icon.png` (temporary)

3. **Icon:** Ek hi icon rahega (unified) - jo `app.json` mein set hai

## 🖼️ Optional: Custom Splash Images

Agar aap booker aur salesman ke liye alag images chahte hain:

### Steps:

1. **Images create karein:**
   - `assets/splash-booker.png` (Recommended: 1284x2778)
   - `assets/splash-salesman.png` (Recommended: 1284x2778)

2. **Code update karein:**
   - File: `src/components/common/RoleBasedSplash.tsx`
   - Line 55: Change to `image: require('../../../assets/splash-booker.png'),`
   - Line 63: Change to `image: require('../../../assets/splash-salesman.png'),`

3. **Rebuild/restart:**
   - Development server restart karein
   - Ya production build banayein

## 📝 Notes

- Currently existing `splash-icon.png` use ho rahi hai - code abhi bhi kaam karega
- Background colors already different hain (red for booker, green for salesman)
- Images PNG format mein honi chahiye
- Transparent background images bhi chal sakti hain
