# PAFood Order Booking App

A comprehensive mobile app for Order Bookers to manage shops, create orders with discount handling, and work offline.

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Expo Go app on your mobile device (for testing)

### Installation

1. Navigate to the project directory:
   ```bash
   cd pafood-booking-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

4. Scan the QR code with Expo Go (Android) or Camera app (iOS)

## 📱 Test Credentials

- **Email:** `booker@pafood.com`
- **Password:** `password123`

## 🏗️ Project Structure

```
pafood-booking-app/
├── app/                      # Expo Router screens
│   ├── (auth)/              # Auth screens (Login)
│   ├── (tabs)/              # Main tab screens
│   │   ├── index.tsx        # Dashboard
│   │   ├── shops/           # Shop management
│   │   ├── orders/          # Order management
│   │   └── profile.tsx      # User profile
│   └── _layout.tsx          # Root layout
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── common/          # Buttons, Inputs, Cards
│   │   ├── shops/           # Shop-specific components
│   │   ├── orders/          # Order-specific components
│   │   └── products/        # Product components
│   ├── stores/              # Zustand state management
│   ├── theme/               # Colors, typography, spacing
│   ├── types/               # TypeScript types
│   ├── data/                # Mock data
│   ├── utils/               # Helper functions
│   └── services/            # Storage & API services
├── assets/                  # Images and icons
└── app.json                 # Expo configuration
```

## ✨ Features

### 🏪 Shop Management
- View all shops
- Add new shops
- View shop details
- Search shops
- Create orders from shop

### 📦 Order Management
- Multi-step order creation
- Product selection with quantity
- Discount handling per product
- Unauthorized discount warning
- Save as draft
- Submit orders
- Request edit for submitted orders

### 💰 Discount Logic
- Per-product discount limits
- Category-based discount policies
- Unauthorized discount detection
- Salary deduction warning popup
- Discount acknowledgment flow

### 🔄 Offline Support
- Local data persistence
- Sync queue for offline changes
- Auto-sync when online
- Pending sync indicator

## 🎨 Tech Stack

- **Framework:** React Native + Expo
- **Navigation:** Expo Router (file-based routing)
- **State Management:** Zustand
- **Local Storage:** AsyncStorage
- **Forms:** React Hook Form + Zod
- **UI Components:** Custom components
- **Language:** TypeScript

## 📋 Available Scripts

- `npm start` - Start Expo development server
- `npm run android` - Start on Android
- `npm run ios` - Start on iOS
- `npm run web` - Start on web browser

## 🔐 Mock Data

The app includes mock data for:
- 5 sample shops
- 10 products across categories (Rice, Oil, Flour, Beverages, Spices)
- 3 sample orders (Draft, Submitted, Edit Requested)
- Discount policies per category

## 📄 License

This project is proprietary software developed for PAFood.

