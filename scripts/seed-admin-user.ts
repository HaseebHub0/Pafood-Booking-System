/**
 * Admin User Seed Script
 * 
 * Creates admin user in Firestore if it doesn't exist.
 * Uses existing Firebase Authentication user.
 * 
 * Usage: npx tsx scripts/seed-admin-user.ts
 */

import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import * as readline from 'readline';

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDga2U0A0hvwblpWCJyB8f-LP4Hp_vszAM",
  authDomain: "pakasianfood-field.firebaseapp.com",
  projectId: "pakasianfood-field",
  storageBucket: "pakasianfood-field.firebasestorage.app",
  messagingSenderId: "756905212386",
  appId: "1:756905212386:web:36a46686a78ce2f1a821bb",
  measurementId: "G-1BM5GLBEVS"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app, 'pafood'); // Use database ID 'pafood'

const ADMIN_EMAIL = 'admin@pafood.com';
const ADMIN_PASSWORD = 'Password123!';

// Authentication helper
async function authenticate(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve, reject) => {
    console.log('🔐 Authentication required...\n');
    console.log(`   Email: ${ADMIN_EMAIL}`);
    console.log(`   Password: ${ADMIN_PASSWORD}\n`);
    
    rl.question('Press Enter to continue with default credentials, or type "custom" for custom login: ', async (answer) => {
      if (answer.toLowerCase() === 'custom') {
        rl.question('Email: ', (email) => {
          rl.question('Password: ', async (password) => {
            rl.close();
            try {
              console.log('\n🔐 Authenticating...');
              await signInWithEmailAndPassword(auth, email.trim(), password.trim());
              console.log('✅ Authentication successful!\n');
              resolve();
            } catch (error: any) {
              console.error(`\n❌ Authentication failed: ${error.message}`);
              reject(error);
            }
          });
        });
      } else {
        rl.close();
        try {
          console.log('\n🔐 Authenticating with default credentials...');
          
          // Try to sign in first
          try {
            await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
            console.log('✅ Authentication successful (existing user)!\n');
            resolve();
            return;
          } catch (signInError: any) {
            // If user doesn't exist, create it
            if (signInError.code === 'auth/user-not-found' || signInError.code === 'auth/invalid-credential') {
              console.log('⚠️  Admin user not found in Authentication. Creating new admin user...');
              
              try {
                const userCredential = await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
                console.log('✅ Admin user created in Firebase Authentication!');
                console.log('   User ID:', userCredential.user.uid);
                resolve();
                return;
              } catch (createError: any) {
                if (createError.code === 'auth/email-already-in-use') {
                  console.log('⚠️  User exists but password might be wrong.');
                  console.log('   Please use correct password or reset in Firebase Console.');
                  reject(createError);
                  return;
                } else {
                  console.error(`\n❌ Failed to create admin user: ${createError.message}`);
                  reject(createError);
                  return;
                }
              }
            } else {
              console.error(`\n❌ Authentication failed: ${signInError.message}`);
              reject(signInError);
              return;
            }
          }
        } catch (error: any) {
          console.error(`\n❌ Unexpected error: ${error.message}`);
          reject(error);
        }
      }
    });
  });
}

// Check if admin user exists in Firestore
async function checkAdminInFirestore(userId: string): Promise<boolean> {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    return userSnap.exists();
  } catch (error: any) {
    console.error('Error checking Firestore:', error.message);
    return false;
  }
}

// Create admin user in Firestore
async function createAdminInFirestore(userId: string, email: string): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    
    const adminData = {
      id: userId,
      email: email,
      name: 'Admin User',
      role: 'admin',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'synced'
    };
    
    await setDoc(userRef, adminData);
    console.log('✅ Admin user document created in Firestore!');
    console.log('   Document ID:', userId);
    console.log('   Email:', email);
    console.log('   Role: admin');
  } catch (error: any) {
    console.error('❌ Error creating Firestore document:', error.message);
    throw error;
  }
}

// Main function
async function main(): Promise<void> {
  try {
    console.log('👤 Admin User Seed Script\n');
    console.log('='.repeat(50));
    console.log('This script will:');
    console.log('  1. Authenticate with admin credentials');
    console.log('  2. Check if admin user exists in Firestore');
    console.log('  3. Create admin user document if missing');
    console.log('='.repeat(50));
    console.log('');

    // Authenticate
    await authenticate();

    // Get current user
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('No authenticated user found');
    }

    console.log('📋 Checking Firestore for admin user...');
    console.log('   User ID:', currentUser.uid);
    console.log('   Email:', currentUser.email);
    console.log('');

    // Check if admin exists in Firestore
    const exists = await checkAdminInFirestore(currentUser.uid);
    
    if (exists) {
      console.log('✅ Admin user already exists in Firestore!');
      console.log('   No action needed.\n');
      
      // Show current data
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          console.log('📄 Current user data:');
          console.log('   Name:', userData.name || 'N/A');
          console.log('   Role:', userData.role || 'N/A');
          console.log('   Status:', userData.status || 'N/A');
          console.log('');
        }
      } catch (error: any) {
        console.log('⚠️  Could not fetch user data:', error.message);
      }
    } else {
      console.log('⚠️  Admin user NOT found in Firestore!');
      console.log('   Creating admin user document...\n');
      
      await createAdminInFirestore(currentUser.uid, currentUser.email || ADMIN_EMAIL);
      console.log('');
    }

    console.log('🎉 Admin user setup completed!\n');
    console.log('✅ You can now login to the app with:');
    console.log('   Email:', ADMIN_EMAIL);
    console.log('   Password:', ADMIN_PASSWORD);
    console.log('');

  } catch (error: any) {
    console.error('\n❌ Script failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main();

