/**
 * Firebase Cleanup Script
 * Deletes all documents from all Firestore collections
 * WARNING: This will delete ALL data. Use only in development/testing environment.
 * 
 * Usage: node scripts/cleanupFirebase.js
 */

const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, collection, getDocs, doc, deleteDoc, writeBatch } = require('firebase/firestore');
const readline = require('readline');

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
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// All collections to clean
const COLLECTIONS_TO_CLEAN = [
  'regions',
  'branches',
  'users',
  'shops',
  'products',
  'orders',
  'order_items',
  'deliveries',
  'ledger_transactions',
  'invoices',
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
  'target_completions'
];

// Batch size for deletions (Firestore limit is 500)
const BATCH_SIZE = 500;

/**
 * Delete all documents from a collection
 */
async function deleteCollection(collectionName) {
  try {
    const collectionRef = collection(db, collectionName);
    const snapshot = await getDocs(collectionRef);
    
    if (snapshot.empty) {
      console.log(`  ✓ ${collectionName}: No documents to delete`);
      return 0;
    }

    const docs = snapshot.docs;
    let deletedCount = 0;

    // Delete in batches
    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const batchDocs = docs.slice(i, i + BATCH_SIZE);

      batchDocs.forEach((docSnapshot) => {
        batch.delete(doc(db, collectionName, docSnapshot.id));
      });

      await batch.commit();
      deletedCount += batchDocs.length;
      console.log(`  → ${collectionName}: Deleted ${deletedCount}/${docs.length} documents`);
    }

    console.log(`  ✓ ${collectionName}: Deleted ${deletedCount} documents`);
    return deletedCount;
  } catch (error) {
    console.error(`  ✗ ${collectionName}: Error - ${error.message}`);
    return 0;
  }
}

/**
 * Confirm action from user
 */
function confirmAction(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

/**
 * Authenticate with Firebase
 */
async function authenticate() {
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
        } catch (error) {
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
 * Main cleanup function
 */
async function cleanupFirebase() {
  console.log('⚠️  WARNING: This will delete ALL documents from all collections!');
  console.log('⚠️  Collections will remain, but all data will be lost.\n');

  // Authenticate first
  try {
    await authenticate();
  } catch (error) {
    console.log('\n❌ Cannot proceed without authentication.');
    process.exit(1);
  }

  const confirmed = await confirmAction('Are you sure you want to proceed? (yes/no): ');
  
  if (!confirmed) {
    console.log('\n❌ Cleanup cancelled by user.');
    process.exit(0);
  }

  console.log('\n🚀 Starting Firebase cleanup...\n');
  console.log(`📋 Will clean ${COLLECTIONS_TO_CLEAN.length} collections\n`);

  let totalDeleted = 0;
  const startTime = Date.now();

  for (const collectionName of COLLECTIONS_TO_CLEAN) {
    const deleted = await deleteCollection(collectionName);
    totalDeleted += deleted;
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Cleanup completed!`);
  console.log(`📊 Total documents deleted: ${totalDeleted}`);
  console.log(`⏱️  Time taken: ${duration}s`);
  console.log('='.repeat(50));
}

// Run cleanup
cleanupFirebase()
  .then(() => {
    console.log('\n✅ All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });

