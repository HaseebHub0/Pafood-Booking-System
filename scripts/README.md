# Firebase Seed Script

Ye script Firebase me initial data seed karega (users aur products).

## Setup

1. **Firebase Config Update Karein:**
   - `scripts/seedFirebase.js` file me apna Firebase config paste karein
   - Ya `.env` file me environment variables set karein

2. **Dependencies Install Karein:**
   ```bash
   npm install firebase uuid
   ```

## Usage

### Option 1: Direct Run (Recommended)
```bash
node scripts/seedFirebase.js
```

### Option 2: NPM Script
`package.json` me add karein:
```json
{
  "scripts": {
    "seed:firebase": "node scripts/seedFirebase.js"
  }
}
```

Phir run karein:
```bash
npm run seed:firebase
```

## Kya Create Hoga

### Users:
1. **Booker User**
   - Email: `booker@pafood.com`
   - Password: `password123`
   - Role: `booker`

2. **Salesman User**
   - Email: `salesman@pafood.com`
   - Password: `password123`
   - Role: `salesman`

### Products:
- 8 sample products (Rice, Oil, Flour, Sugar, Spices, etc.)

## Important Notes

1. **Firebase Config**: Script me Firebase config update karna zaroori hai
2. **Auth Enabled**: Firebase Authentication me Email/Password enable hona chahiye
3. **Firestore Rules**: Firestore rules allow karni chahiye (temporarily permissive for seeding)
4. **Duplicate Users**: Agar user already exist karta hai, script skip kar degi

## Troubleshooting

### "Firebase config error"
- `scripts/seedFirebase.js` me Firebase config check karein
- Ya `src/config/firebase.ts` se copy karein

### "Permission denied"
- Firestore security rules temporarily permissive karein
- Ya admin credentials use karein

### "User already exists"
- Normal hai, script automatically skip kar degi
- Agar user update karna hai, Firebase Console se manually karein

