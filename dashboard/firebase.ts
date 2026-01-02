import { collection, enableNetwork } from 'firebase/firestore';
// Error handlers are set up in src/config/firebase.ts
// No need to duplicate here since we're using the unified Firebase instance

/**
 * FIRESTORE SECURITY RULES (IMPORTANT):
 * 
 * Current rules should allow authenticated users to read their own data.
 * For dashboard functionality, ensure rules allow:
 * 
 * 1. Admin users can read all collections
 * 2. KPO users can read data for their assigned branch
 * 3. All authenticated users can read their own user document
 * 
 * Recommended Security Rules (Production):
 * 
 * service cloud.firestore {
 *   match /databases/{database}/documents {
 *     // Helper function to get user role
 *     function getUserRole() {
 *       return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
 *     }
 *     
 *     // Helper function to get user branch
 *     function getUserBranch() {
 *       return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.branch;
 *     }
 *     
 *     // Users collection
 *     match /users/{userId} {
 *       allow read: if request.auth != null && (
 *         request.auth.uid == userId || 
 *         getUserRole() == 'Admin' || 
 *         getUserRole() == 'KPO'
 *       );
 *       allow write: if request.auth != null && request.auth.uid == userId;
 *     }
 *     
 *     // Regions collection - Admin and KPO can read
 *     match /regions/{regionId} {
 *       allow read: if request.auth != null && (
 *         getUserRole() == 'Admin' || 
 *         getUserRole() == 'KPO'
 *       );
 *       allow write: if request.auth != null && getUserRole() == 'Admin';
 *     }
 *     
 *     // Branches collection - Admin and KPO can read
 *     match /branches/{branchId} {
 *       allow read: if request.auth != null && (
 *         getUserRole() == 'Admin' || 
 *         (getUserRole() == 'KPO' && resource.data.name == getUserBranch())
 *       );
 *       allow write: if request.auth != null && getUserRole() == 'Admin';
 *     }
 *     
 *     // Shops collection - Admin can read all, KPO can read their branch
 *     match /shops/{shopId} {
 *       allow read: if request.auth != null && (
 *         getUserRole() == 'Admin' || 
 *         (getUserRole() == 'KPO' && (
 *           resource.data.branch == getUserBranch() || 
 *           resource.data.branchId == getUserBranch()
 *         ))
 *       );
 *       allow write: if request.auth != null && getUserRole() == 'Admin';
 *     }
 *     
 *     // Orders collection - Admin can read all, KPO can read their branch
 *     match /orders/{orderId} {
 *       allow read: if request.auth != null && (
 *         getUserRole() == 'Admin' || 
 *         (getUserRole() == 'KPO' && (
 *           resource.data.branch == getUserBranch() || 
 *           resource.data.branchId == getUserBranch()
 *         ))
 *       );
 *       allow write: if request.auth != null;
 *     }
 *     
 *     // Ledger transactions - Admin can read all, KPO can read their branch
 *     match /ledger_transactions/{transactionId} {
 *       allow read: if request.auth != null && (
 *         getUserRole() == 'Admin' || 
 *         (getUserRole() == 'KPO' && (
 *           resource.data.branch_id == getUserBranch() || 
 *           resource.data.branchId == getUserBranch()
 *         ))
 *       );
 *       allow write: if request.auth != null;
 *     }
 *     
 *     // Products collection - Admin and KPO can read
 *     match /products/{productId} {
 *       allow read: if request.auth != null && (
 *         getUserRole() == 'Admin' || 
 *         getUserRole() == 'KPO'
 *       );
 *       allow write: if request.auth != null && getUserRole() == 'Admin';
 *     }
 *     
 *     // Other collections - similar pattern
 *     match /{document=**} {
 *       allow read: if request.auth != null && (
 *         getUserRole() == 'Admin' || 
 *         getUserRole() == 'KPO'
 *       );
 *       allow write: if request.auth != null;
 *     }
 *   }
 * }
 * 
 * DEVELOPMENT RULES (Less Secure - Use Only for Testing):
 * 
 * service cloud.firestore {
 *   match /databases/{database}/documents {
 *     match /{document=**} {
 *       allow read, write: if request.auth != null;
 *     }
 *   }
 * }
 * 
 * VERIFICATION CHECKLIST:
 * 
 * 1. Go to Firebase Console > Firestore > Rules
 * 2. Verify rules allow read access for authenticated users
 * 3. Test queries in browser console - check for "permission-denied" errors
 * 4. If errors occur, check:
 *    - User is authenticated (request.auth != null)
 *    - User role is correctly set in Firestore
 *    - User branch matches data branch field
 *    - Rules are deployed (click "Publish" after editing)
 * 
 * COMMON ISSUES:
 * 
 * 1. "Permission Denied" errors:
 *    - Check if user is authenticated
 *    - Verify user role in Firestore users collection
 *    - Check if rules are deployed
 *    - Verify branch field matches between user and data
 * 
 * 2. Queries returning empty results:
 *    - May be due to security rules filtering results
 *    - Check browser console for permission errors
 *    - Verify user has correct role and branch assignment
 * 
 * 3. Silent failures:
 *    - Security rules may block queries without throwing errors
 *    - Check Firebase Console > Firestore > Usage for denied requests
 *    - Enable debug logging in browser console
 */
// Dashboard-specific Firebase initialization (web-only, no React Native dependencies)
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDga2U0A0hvwblpWCJyB8f-LP4Hp_vszAM",
  authDomain: "pakasianfood-field.firebaseapp.com",
  projectId: "pakasianfood-field",
  storageBucket: "pakasianfood-field.firebasestorage.app",
  messagingSenderId: "756905212386",
  appId: "1:756905212386:web:36a46686a78ce2f1a821bb",
  measurementId: "G-1BM5GLBEVS"
};

// Initialize Firebase (web-only, no React Native dependencies)
let app: FirebaseApp;
let db: Firestore;
let auth: Auth;

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  // Use database ID 'pafood' instead of default
  db = getFirestore(app, 'pafood');
  auth = getAuth(app);
} else {
  app = getApps()[0];
  db = getFirestore(app, 'pafood');
  auth = getAuth(app);
}

export { db, auth };

// Enable network immediately to prevent offline mode
(async () => {
  try {
    await enableNetwork(db);
    console.log('[Dashboard Firebase] Network enabled for database: pafood');
  } catch (error: any) {
    // If already enabled, that's fine
    if (error.code !== 'failed-precondition') {
      console.warn('[Dashboard Firebase] Network enable warning:', error.message);
    }
  }
})();

// Collection References for the 14 requested collections
export const collections = {
    regions: collection(db, 'regions'),
    branches: collection(db, 'branches'),
    users: collection(db, 'users'),
    shops: collection(db, 'shops'),
    products: collection(db, 'products'),
    orders: collection(db, 'orders'),
    orderItems: collection(db, 'order_items'),
    loadForms: collection(db, 'load_forms'),
    returns: collection(db, 'returns'),
    targets: collection(db, 'targets'),
    dailySummaries: collection(db, 'daily_summaries'),
    unauthorizedDiscounts: collection(db, 'unauthorized_discounts'),
    activityLogs: collection(db, 'activity_logs'),
    bills: collection(db, 'bills'),
    bookerLocations: collection(db, 'booker_locations')
};
