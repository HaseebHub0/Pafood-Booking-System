# Firebase Cleanup Script - Setup Instructions

## Permission Issues

If you're getting "Missing or insufficient permissions" errors, you have two options:

### Option 1: Authenticate with Admin Account (Recommended)

The script will prompt you for admin credentials. Use an admin account email and password.

### Option 2: Temporarily Update Firestore Security Rules

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `pakasianfood-field`
3. Navigate to **Firestore Database** > **Rules**
4. Temporarily update rules to:

```javascript
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

5. Click **Publish**
6. Run the cleanup script
7. **IMPORTANT**: Revert the rules back to your production rules after cleanup!

### Option 3: Use Firebase Admin SDK (Advanced)

If you have a service account key:

1. Install Firebase Admin SDK:
   ```bash
   npm install firebase-admin
   ```

2. Download service account key from Firebase Console:
   - Project Settings > Service Accounts > Generate New Private Key

3. Update the script to use Admin SDK (bypasses security rules)

## Running the Script

```bash
node scripts/cleanupFirebase.js
```

The script will:
1. Ask for authentication (if using Option 1)
2. Confirm deletion
3. Delete all documents from all collections
4. Preserve collections (only documents are deleted)

## Safety

- Always run in development/testing environment
- Backup important data before running
- The script asks for confirmation before proceeding

