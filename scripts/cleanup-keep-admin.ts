/**
 * Cleanup Script - Delete All Data Except Admin Users
 * 
 * Deletes all documents from all collections except preserves users where
 * role === 'admin' OR role === 'owner'
 * 
 * Usage: npx tsx scripts/cleanup-keep-admin.ts
 */

import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, writeBatch, query, where } from 'firebase/firestore';
import * as readline from 'readline';

// Firebase config - From src/config/firebase.ts
const firebaseConfig = {
  apiKey: "AIzaSyDga2U0A0hvwblpWCJyB8f-LP4Hp_vszAM",
  authDomain: "pakasianfood-field.firebaseapp.com",
  projectId: "pakasianfood-field",
  storageBucket: "pakasianfood-field.firebasestorage.app",
  messagingSenderId: "756905212386",
  appId: "1:756905212386:web:36a46686a78ce2f1a821bb",
  measurementId: "G-1BM5GLBEVS"
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);

const BATCH_SIZE = 500;
const USER_BATCH_SIZE = 100;

// All collections to clean (except users - handled separately)
const COLLECTIONS_TO_CLEAN = [
  'regions',
  'branches',
  'shops',
  'products',
  'orders',
  'order_items',
  'deliveries',
  'ledger_transactions',
  'invoices',
  'bills',
  'routes',
  'visits',
  'returns',
  'stock_returns',
  'load_forms',
  'edit_requests',
  'daily_reports',
  'targets',
  'sync_queue',
  'daily_summaries',
  'unauthorized_discounts',
  'activity_logs',
  'mappings',
  'salary_deductions',
  'outstanding_payments',
  'commissions',
  'booker_locations',
];

/**
 * Authenticate with Firebase
 */
async function authenticate(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve, reject) => {
    console.log('🔐 Authentication required for cleanup operations.\n');
    console.log('⚠️  You need to sign in with an admin account.\n');
    
    rl.question('Admin Email: ', (email) => {
      rl.question('Admin Password: ', async (password) => {
        rl.close();
        
        try {
          console.log('\n🔐 Authenticating...');
          await signInWithEmailAndPassword(auth, email.trim(), password);
          console.log('✅ Authentication successful!\n');
          resolve();
        } catch (error: any) {
          console.error(`\n❌ Authentication failed: ${error.message}`);
          console.log('\n💡 Alternative: Update Firestore security rules temporarily:');
          console.log('   Go to Firebase Console > Firestore > Rules');
          console.log('   Set rules to: allow read, write: if true;');
          console.log('   (Remember to revert after cleanup!)\n');
          reject(error);
        }
      });
    });
  });
}

/**
 * Get confirmation from user
 */
async function getConfirmation(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('⚠️  This will delete ALL data except admin users. Continue? (yes/no): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

/**
 * Delete collection with batch processing
 */
async function deleteCollection(collectionName: string): Promise<number> {
  try {
    const collectionRef = collection(db, collectionName);
    const snapshot = await getDocs(collectionRef);
    
    if (snapshot.empty) {
      console.log(`  ✓ ${collectionName}: No documents`);
      return 0;
    }

    const docs = snapshot.docs;
    let deletedCount = 0;

    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const batchDocs = docs.slice(i, i + BATCH_SIZE);

      batchDocs.forEach((docSnapshot) => {
        batch.delete(doc(db, collectionName, docSnapshot.id));
      });

      await batch.commit();
      deletedCount += batchDocs.length;
      console.log(`  → ${collectionName}: Deleted ${deletedCount}/${docs.length}`);
    }

    console.log(`  ✓ ${collectionName}: Deleted ${deletedCount} documents`);
    return deletedCount;
  } catch (error: any) {
    console.error(`  ✗ ${collectionName}: Error - ${error.message}`);
    return 0;
  }
}

/**
 * Delete users except admin users
 */
async function deleteUsersExceptAdmin(): Promise<number> {
  try {
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);
    
    if (snapshot.empty) {
      console.log(`  ✓ users: No documents`);
      return 0;
    }

    // Find admin users
    const adminUsers: Array<{ id: string; email: string; role: string }> = [];
    const usersToDelete: Array<{ id: string; email: string }> = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      const role = (data.role || '').toLowerCase();
      
      if (role === 'admin' || role === 'owner') {
        adminUsers.push({
          id: doc.id,
          email: data.email || 'unknown',
          role: data.role || 'unknown'
        });
      } else {
        usersToDelete.push({
          id: doc.id,
          email: data.email || 'unknown'
        });
      }
    });

    if (adminUsers.length === 0) {
      console.log('  ⚠️  No admin user found - deleting all users');
    } else {
      console.log(`  ℹ️  Found ${adminUsers.length} admin user(s) - preserving them:`);
      adminUsers.forEach(admin => {
        console.log(`     - ${admin.email} (${admin.id}) - Role: ${admin.role}`);
      });
    }

    if (usersToDelete.length === 0) {
      console.log(`  ✓ users: No non-admin users to delete`);
      return 0;
    }

    let deletedCount = 0;
    for (let i = 0; i < usersToDelete.length; i += USER_BATCH_SIZE) {
      const batch = writeBatch(db);
      const batchUsers = usersToDelete.slice(i, i + USER_BATCH_SIZE);

      batchUsers.forEach((user) => {
        batch.delete(doc(db, 'users', user.id));
      });

      await batch.commit();
      deletedCount += batchUsers.length;
      console.log(`  → users: Deleted ${deletedCount}/${usersToDelete.length} non-admin users`);
    }

    console.log(`  ✓ users: Deleted ${deletedCount} non-admin users, preserved ${adminUsers.length} admin(s)`);
    return deletedCount;
  } catch (error: any) {
    console.error(`  ✗ users: Error - ${error.message}`);
    return 0;
  }
}

/**
 * Main cleanup function
 */
async function main() {
  console.log('='.repeat(60));
  console.log('🗑️  Cleanup: Delete All Data Except Admin User');
  console.log('='.repeat(60));
  console.log('');

  try {
    await authenticate();
  } catch (error) {
    console.log('\n❌ Cannot proceed without authentication.');
    process.exit(1);
  }

  const confirmed = await getConfirmation();
  if (!confirmed) {
    console.log('\n❌ Cleanup cancelled.');
    process.exit(0);
  }

  console.log('\n🚀 Starting cleanup...\n');

  let totalDeleted = 0;
  const startTime = Date.now();

  // Delete users except admin
  totalDeleted += await deleteUsersExceptAdmin();
  console.log('');

  // Delete all other collections
  for (const collectionName of COLLECTIONS_TO_CLEAN) {
    totalDeleted += await deleteCollection(collectionName);
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Cleanup completed!`);
  console.log(`📊 Total documents deleted: ${totalDeleted}`);
  console.log(`⏱️  Time taken: ${duration}s`);
  console.log('='.repeat(60));
  console.log('\n💡 Next step: Run seed-comprehensive-test-data.ts to populate test data');
  
  process.exit(0);
}

main().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});

