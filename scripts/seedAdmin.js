/**
 * Admin User Seed Script
 * Creates a single admin user in Firebase
 * 
 * Usage: node scripts/seedAdmin.js
 */

const { initializeApp } = require('firebase/app');
const { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, doc, setDoc, serverTimestamp, getDoc } = require('firebase/firestore');
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

// Default password for admin user
const DEFAULT_PASSWORD = 'Password123!';

// Admin user details
const ADMIN_EMAIL = 'admin@pafood.com';
const ADMIN_NAME = 'Super Admin';
const ADMIN_PHONE = '+92 300 0000000';

/**
 * Authenticate with Firebase
 */
async function authenticate() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve, reject) => {
    console.log('🔐 Authentication (Optional)\n');
    console.log('💡 You can authenticate with an existing admin account,');
    console.log('   or skip if Firestore rules allow writes.\n');
    console.log('💡 Alternative: Update Firestore security rules temporarily:');
    console.log('   Go to Firebase Console > Firestore > Rules');
    console.log('   Set rules to: allow read, write: if true;');
    console.log('   (Remember to revert after seeding!)\n');
    
    rl.question('Email (or press Enter to skip): ', (email) => {
      if (!email.trim()) {
        console.log('\n⚠️  Skipping authentication.');
        console.log('   Make sure Firestore rules allow writes, or authenticate next time.\n');
        rl.close();
        resolve();
        return;
      }
      
      rl.question('Password: ', async (password) => {
        rl.close();
        
        try {
          console.log('\n🔐 Authenticating...');
          await signInWithEmailAndPassword(auth, email.trim(), password);
          console.log('✅ Authentication successful!\n');
          resolve();
        } catch (error) {
          console.error(`\n❌ Authentication failed: ${error.message}`);
          console.log('\n⚠️  Continuing without authentication...');
          console.log('   Make sure Firestore rules allow writes.\n');
          resolve(); // Continue anyway
        }
      });
    });
  });
}

/**
 * Check if admin user already exists
 */
async function adminExists() {
  try {
    const { collection, query, where, getDocs } = require('firebase/firestore');
    
    // Check Firestore for admin user
    const usersQuery = query(
      collection(db, 'users'),
      where('email', '==', ADMIN_EMAIL),
      where('role', '==', 'Admin')
    );
    
    const usersSnapshot = await getDocs(usersQuery);
    
    if (!usersSnapshot.empty) {
      return { exists: true, userId: usersSnapshot.docs[0].id };
    }
    
    return { exists: false, userId: null };
  } catch (error) {
    // If query fails, assume user doesn't exist
    return { exists: false, userId: null };
  }
}

/**
 * Get Auth user UID by signing in
 */
async function getAuthUserUID(email, password) {
  try {
    const { signInWithEmailAndPassword } = require('firebase/auth');
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user.uid;
  } catch (error) {
    return null;
  }
}

/**
 * Create Admin user
 */
async function createAdminUser() {
  try {
    console.log('👑 Creating Admin user...\n');
    
    // Check if admin already exists in Firestore
    const existing = await adminExists();
    if (existing.exists) {
      console.log(`✅ Admin user already exists in Firestore!`);
      console.log(`   Email: ${ADMIN_EMAIL}`);
      console.log(`   User ID: ${existing.userId}`);
      console.log(`\n💡 Admin is ready to use.`);
      console.log(`💡 To reset password, use Firebase Console > Authentication`);
      return { created: false, userId: existing.userId, exists: true };
    }
    
    // Try to create Auth user
    console.log('   Step 1: Creating Firebase Auth user...');
    let adminUserId = null;
    let authUserExists = false;
    let needsSignIn = false;
    
    try {
      const adminUserCredential = await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, DEFAULT_PASSWORD);
      adminUserId = adminUserCredential.user.uid;
      console.log(`   ✓ Auth user created: ${adminUserId}`);
      needsSignIn = true; // Need to sign in to get authenticated context
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        authUserExists = true;
        console.log(`   ⚠️  Email already exists in Firebase Auth.`);
        console.log(`   💡 Attempting to sign in to get User ID and authenticate...`);
        
        // Try to sign in with default password to get UID
        adminUserId = await getAuthUserUID(ADMIN_EMAIL, DEFAULT_PASSWORD);
        
        if (adminUserId) {
          console.log(`   ✓ Found Auth user ID: ${adminUserId}`);
          needsSignIn = false; // Already signed in
        } else {
          console.log(`   ⚠️  Could not sign in with default password.`);
          console.log(`   💡 Please sign in manually or reset password in Firebase Console.`);
          console.log(`\n📋 Manual Steps:`);
          console.log(`   1. Go to Firebase Console > Authentication`);
          console.log(`   2. Find user: ${ADMIN_EMAIL}`);
          console.log(`   3. Copy the User UID`);
          console.log(`   4. Run this script again with authentication`);
          console.log(`   OR update Firestore rules to allow writes temporarily`);
          throw new Error('Cannot proceed without User ID. Please authenticate or update Firestore rules.');
        }
      } else {
        throw error;
      }
    }
    
    if (!adminUserId) {
      throw new Error('Could not get Admin User ID');
    }
    
    // Sign in with the newly created user to get authenticated context
    if (needsSignIn) {
      console.log(`\n   Step 2: Authenticating with newly created user...`);
      try {
        await signInWithEmailAndPassword(auth, ADMIN_EMAIL, DEFAULT_PASSWORD);
        console.log(`   ✓ Authenticated successfully`);
      } catch (error) {
        console.log(`   ⚠️  Could not auto-authenticate: ${error.message}`);
        console.log(`   💡 Will try to create Firestore document anyway...`);
      }
    }
    
    // Create Firestore document
    console.log(`\n   Step ${needsSignIn ? '3' : '2'}: Creating Firestore document...`);
    const adminUserData = {
      id: adminUserId,
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      phone: ADMIN_PHONE,
      role: 'Admin',
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      syncStatus: 'synced'
    };
    
    try {
      await setDoc(doc(db, 'users', adminUserId), adminUserData);
      console.log(`   ✓ Firestore document created`);
    } catch (error) {
      if (error.code === 'permission-denied') {
        console.log(`\n❌ Permission denied! Firestore security rules are blocking writes.`);
        console.log(`\n📋 Solutions:`);
        console.log(`   1. Temporarily update Firestore rules (RECOMMENDED):`);
        console.log(`      - Go to Firebase Console > Firestore > Rules`);
        console.log(`      - Set rules to: allow read, write: if true;`);
        console.log(`      - Run script again`);
        console.log(`      - Revert rules after seeding!`);
        console.log(`\n   2. Authenticate with an existing admin account:`);
        console.log(`      - Run script and provide admin email/password when prompted`);
        console.log(`      - This will use the authenticated user's permissions`);
        console.log(`\n   3. Use Firebase Admin SDK (for server-side scripts)`);
        console.log(`\n💡 Note: Auth user was created successfully (UID: ${adminUserId})`);
        console.log(`   You can manually create the Firestore document in Firebase Console.`);
        throw error;
      }
      throw error;
    }
    
    console.log(`\n✅ Admin user created successfully!`);
    console.log(`\n📋 Admin Credentials:`);
    console.log(`   Email: ${ADMIN_EMAIL}`);
    if (!authUserExists) {
      console.log(`   Password: ${DEFAULT_PASSWORD}`);
    } else {
      console.log(`   Password: (already set - use existing password or reset in Firebase Console)`);
    }
    console.log(`   Name: ${ADMIN_NAME}`);
    console.log(`   User ID: ${adminUserId}`);
    if (!authUserExists) {
      console.log(`\n⚠️  Please change the password on first login!`);
    }
    
    return { created: true, userId: adminUserId, authCreated: !authUserExists };
  } catch (error) {
    console.error(`\n❌ Error creating admin user:`, error.message);
    if (error.code === 'permission-denied') {
      console.log(`\n💡 This is a Firestore security rules issue.`);
      console.log(`   See solutions above.`);
    }
    throw error;
  }
}

/**
 * Main function
 */
async function seedAdmin() {
  console.log('🚀 Starting Admin User Creation...\n');
  console.log('📋 Will create:');
  console.log(`   - Email: ${ADMIN_EMAIL}`);
  console.log(`   - Name: ${ADMIN_NAME}`);
  console.log(`   - Role: Admin`);
  console.log(`   - Password: ${DEFAULT_PASSWORD}\n`);
  
  // Try to authenticate (optional)
  try {
    await authenticate();
  } catch (error) {
    console.log('\n⚠️  Continuing without authentication...');
    console.log('   Make sure Firestore security rules allow writes.\n');
  }

  try {
    const result = await createAdminUser();
    
    if (result.created) {
      console.log('\n' + '='.repeat(50));
      console.log('✅ Admin user creation completed!');
      console.log('='.repeat(50));
    } else {
      console.log('\n' + '='.repeat(50));
      console.log('ℹ️  Admin user already exists.');
      console.log('='.repeat(50));
    }
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run script
seedAdmin()
  .then(() => {
    console.log('\n✅ All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });

