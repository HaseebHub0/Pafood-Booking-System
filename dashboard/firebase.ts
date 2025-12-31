
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

/**
 * 
 * FIRESTORE SECURITY RULES (IMPORTANT):
 * To fix "Permission Denied" errors, go to Firebase Console > Firestore > Rules
 * and paste the following for development:
 * 
 * service cloud.firestore {
 *   match /databases/{database}/documents {
 *     match /{document=**} {
 *       allow read, write: if true;
 *     }
 *   }
 * }
 */

// Replace with your actual Firebase config from the Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyDga2U0A0hvwblpWCJyB8f-LP4Hp_vszAM",
  authDomain: "pakasianfood-field.firebaseapp.com",
  projectId: "pakasianfood-field",
  storageBucket: "pakasianfood-field.firebasestorage.app",
  messagingSenderId: "756905212386",
  appId: "1:756905212386:web:36a46686a78ce2f1a821bb",
  measurementId: "G-1BM5GLBEVS"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

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
