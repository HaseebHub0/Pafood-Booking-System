# Firestore Security Rules for Booker Location Tracking

## Important: Manual Configuration Required

The following Firestore security rules must be added manually in the Firebase Console.

## Steps to Add Rules

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `pakasianfood-field`
3. Navigate to **Firestore Database** > **Rules**
4. Add the following rules to your existing rules file

## Security Rules

```javascript
match /booker_locations/{bookerId} {
  // Bookers can create their own location document
  allow create: if request.auth != null 
    && request.auth.uid == bookerId
    && request.resource.data.bookerId == bookerId;
  
  // Bookers can update their own location (setDoc with merge uses this)
  allow update: if request.auth != null 
    && request.auth.uid == bookerId
    && request.resource.data.bookerId == bookerId;
  
  // Bookers can read their own location
  allow read: if request.auth != null 
    && request.auth.uid == bookerId;
  
  // KPO/Admin can read all locations
  allow read: if request.auth != null 
    && (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['KPO', 'Admin']);
}
```

**Important:** `setDoc` with `merge: true` requires both `create` and `update` permissions. The above rules allow bookers to both create and update their own location documents.

## Notes

- These rules ensure bookers can only create/update their own location document
- KPO and Admin roles can view all booker locations
- Bookers can only view their own location
- The rules verify that the document ID matches the authenticated user's ID

## Testing

After adding the rules:
1. Test with a booker account - should be able to update own location
2. Test with KPO account - should be able to read all locations
3. Test with another booker - should NOT be able to update other booker's location




