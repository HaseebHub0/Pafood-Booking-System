/**
 * Firebase Seed Script
 * Populates Firebase with initial data structure:
 * - 4 Regions (Peshawar, Sindh, Multan, Lahore)
 * - 7 Branches (2+2+2+1)
 * - 35 Users (7 KPOs, 14 Bookers, 14 Salesmen)
 * 
 * Usage: node scripts/seedFirebase.js
 */

const { initializeApp } = require('firebase/app');
const { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, collection, doc, setDoc, serverTimestamp } = require('firebase/firestore');
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

// Default password for all users (should be changed on first login)
const DEFAULT_PASSWORD = 'Password123!';

// Pakistani names for users
const PAKISTANI_NAMES = {
  kpo: [
    { first: 'Ahmed', last: 'Khan' },
    { first: 'Hassan', last: 'Ali' },
    { first: 'Usman', last: 'Malik' },
    { first: 'Bilal', last: 'Ahmed' },
    { first: 'Zain', last: 'Hussain' },
    { first: 'Faisal', last: 'Sheikh' },
    { first: 'Tariq', last: 'Iqbal' }
  ],
  booker: [
    { first: 'Rashid', last: 'Mehmood' },
    { first: 'Sajid', last: 'Butt' },
    { first: 'Nadeem', last: 'Rana' },
    { first: 'Shahid', last: 'Chaudhry' },
    { first: 'Imran', last: 'Khan' },
    { first: 'Kamran', last: 'Yousaf' },
    { first: 'Waseem', last: 'Akram' },
    { first: 'Asif', last: 'Nawaz' },
    { first: 'Javed', last: 'Qureshi' },
    { first: 'Naeem', last: 'Hashmi' },
    { first: 'Saeed', last: 'Abbasi' },
    { first: 'Khalid', last: 'Mirza' },
    { first: 'Tahir', last: 'Bhatti' },
    { first: 'Yasir', last: 'Siddiqui' }
  ],
  salesman: [
    { first: 'Aamir', last: 'Raza' },
    { first: 'Babar', last: 'Azam' },
    { first: 'Danish', last: 'Aziz' },
    { first: 'Ehsan', last: 'Rauf' },
    { first: 'Farhan', last: 'Saeed' },
    { first: 'Ghulam', last: 'Farooq' },
    { first: 'Haris', last: 'Sohail' },
    { first: 'Iqbal', last: 'Hassan' },
    { first: 'Junaid', last: 'Iqbal' },
    { first: 'Kashif', last: 'Mahmood' },
    { first: 'Liaquat', last: 'Ali' },
    { first: 'Mansoor', last: 'Ahmed' },
    { first: 'Noman', last: 'Ali' },
    { first: 'Omer', last: 'Khan' }
  ]
};

// Regions data
const REGIONS = [
  { name: 'Peshawar', code: 'PSH', branches: 2 },
  { name: 'Sindh', code: 'SND', branches: 2 },
  { name: 'Multan', code: 'MLT', branches: 2 },
  { name: 'Lahore', code: 'LHR', branches: 1 }
];

/**
 * Generate phone number
 */
function generatePhone(index) {
  // Format: +92 300 XXXXXXX (7 digits)
  const phoneNumber = String(1000000 + index).padStart(7, '0');
  return `+92 300 ${phoneNumber}`;
}

/**
 * Generate email address
 */
function generateEmail(firstName, lastName, branchName, role) {
  const branchCode = branchName.toLowerCase().replace(/\s+/g, '');
  const namePart = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`;
  return `${namePart}@${branchCode}.pafood.com`;
}

/**
 * Create Firebase Auth user
 */
async function createAuthUser(email, password) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return userCredential.user.uid;
  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
      console.log(`  ⚠️  Auth user already exists: ${email}`);
      // Try to get existing user (would need to fetch from Firestore)
      throw new Error(`User ${email} already exists in Auth`);
    }
    throw error;
  }
}

/**
 * Create user document in Firestore
 */
async function createUserDocument(userId, userData) {
      const userDoc = {
        id: userId,
    ...userData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    syncStatus: 'synced'
      };
      
      await setDoc(doc(db, 'users', userId), userDoc);
  return userId;
}

/**
 * Create region
 */
async function createRegion(regionData, index) {
  const regionId = `region-${index + 1}`;
  const regionDoc = {
    id: regionId,
    name: regionData.name,
    code: regionData.code,
    createdAt: serverTimestamp()
  };

  await setDoc(doc(db, 'regions', regionId), regionDoc);
  console.log(`  ✓ Created region: ${regionData.name} (${regionData.code})`);
  return regionId;
}

/**
 * Create branch
 */
async function createBranch(branchData, regionId, index) {
  const branchId = `branch-${regionId}-${index + 1}`;
  const branchDoc = {
    id: branchId,
    regionId: regionId,
    name: branchData.name,
    code: branchData.code,
    managerId: branchData.managerId || null,
    createdAt: serverTimestamp()
  };

  await setDoc(doc(db, 'branches', branchId), branchDoc);
  console.log(`    ✓ Created branch: ${branchData.name} (${branchData.code})`);
  return branchId;
}

/**
 * Create user (Auth + Firestore)
 */
async function createUser(userInfo, regionId, branchId, regionName, branchName, phoneIndex) {
  try {
    // Create Auth user
    const userId = await createAuthUser(userInfo.email, DEFAULT_PASSWORD);
    
    // Prepare user data
    const userData = {
      name: `${userInfo.firstName} ${userInfo.lastName}`,
      email: userInfo.email,
      role: userInfo.role,
      regionId: regionId,
      branchId: branchId,
      region: regionName,
      branch: branchName,
      status: 'active',
      phone: generatePhone(phoneIndex),
      avatarUrl: `https://i.pravatar.cc/150?u=${userId}`
    };

    // Add role-specific fields
    if (userInfo.role === 'booker') {
      userData.maxDiscount = 10; // Default 10% discount
      userData.maxDiscountPercent = 10;
    }

    // Create Firestore document
    await createUserDocument(userId, userData);
    
    console.log(`      ✓ Created ${userInfo.role}: ${userData.name} (${userInfo.email})`);
    return { userId, userData };
    } catch (error) {
    console.error(`      ✗ Error creating user ${userInfo.email}:`, error.message);
    throw error;
    }
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
    console.log('🔐 Authentication required for seeding operations.\n');
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
          console.log('   (Remember to revert after seeding!)\n');
          reject(error);
    }
      });
    });
  });
}


 -----/**
 * Main seeding function
 */
async function seedFirebase() {
  console.log('🚀 Starting Firebase seed...\n');
  
  // Authenticate first
  try {
    await authenticate();
  } catch (error) {
    console.log('\n❌ Cannot proceed without authentication.');
    process.exit(1);
  }

  console.log('📋 Will create:');
  console.log(`   - ${REGIONS.length} Regions`);
  console.log(`   - ${REGIONS.reduce((sum, r) => sum + r.branches, 0)} Branches`);
  console.log(`   - ${REGIONS.reduce((sum, r) => sum + r.branches * 5, 0)} Users (${REGIONS.reduce((sum, r) => sum + r.branches, 0)} KPOs, ${REGIONS.reduce((sum, r) => sum + r.branches * 2, 0)} Bookers, ${REGIONS.reduce((sum, r) => sum + r.branches * 2, 0)} Salesmen)\n`);
  console.log('💡 Note: To add admin user, use: node scripts/seedAdmin.js');
  console.log('💡 Note: To add products, use: node scripts/seedProducts.js\n');
  
  const startTime = Date.now();
  let phoneIndex = 1;
  let nameIndices = {
    kpo: 0,
    booker: 0,
    salesman: 0
  };

  // Create regions and branches
  for (let regionIndex = 0; regionIndex < REGIONS.length; regionIndex++) {
    const regionData = REGIONS[regionIndex];
    console.log(`\n📍 Creating region: ${regionData.name}`);

    // Create region
    const regionId = await createRegion(regionData, regionIndex);

    // Create branches for this region
    for (let branchIndex = 0; branchIndex < regionData.branches; branchIndex++) {
      const branchName = `${regionData.name} Branch ${branchIndex + 1}`;
      const branchCode = `${regionData.code}-${branchIndex + 1}`;
      
      console.log(`\n  🏢 Creating branch: ${branchName}`);

      // Create branch first (without managerId initially)
      const branchId = await createBranch(
        { name: branchName, code: branchCode },
        regionId,
        branchIndex
      );

      // Create KPO (will be set as manager)
      const kpoName = PAKISTANI_NAMES.kpo[nameIndices.kpo];
      const kpoEmail = generateEmail(kpoName.first, kpoName.last, branchName, 'kpo');
      const kpoUser = await createUser(
        {
          firstName: kpoName.first,
          lastName: kpoName.last,
          email: kpoEmail,
          role: 'kpo'
        },
        regionId,
        branchId,
        regionData.name,
        branchName,
        phoneIndex++
      );
      nameIndices.kpo++;

      // Update branch with manager ID
      await setDoc(doc(db, 'branches', branchId), {
        managerId: kpoUser.userId
      }, { merge: true });

      // Create 2 Bookers
      console.log(`\n    👥 Creating Bookers:`);
      for (let i = 0; i < 2; i++) {
        const bookerName = PAKISTANI_NAMES.booker[nameIndices.booker];
        const bookerEmail = generateEmail(bookerName.first, bookerName.last, branchName, 'booker');
        await createUser(
          {
            firstName: bookerName.first,
            lastName: bookerName.last,
            email: bookerEmail,
            role: 'booker'
          },
          regionId,
          branchId,
          regionData.name,
          branchName,
          phoneIndex++
        );
        nameIndices.booker++;
      }

      // Create 2 Salesmen
      console.log(`\n    🚚 Creating Salesmen:`);
      for (let i = 0; i < 2; i++) {
        const salesmanName = PAKISTANI_NAMES.salesman[nameIndices.salesman];
        const salesmanEmail = generateEmail(salesmanName.first, salesmanName.last, branchName, 'salesman');
        await createUser(
          {
            firstName: salesmanName.first,
            lastName: salesmanName.last,
            email: salesmanEmail,
            role: 'salesman'
          },
          regionId,
          branchId,
          regionData.name,
          branchName,
          phoneIndex++
        );
        nameIndices.salesman++;
      }
    }
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  console.log('\n' + '='.repeat(50));
  console.log('✅ Seeding completed!');
  console.log(`⏱️  Time taken: ${duration}s`);
  console.log('\n📋 Summary:');
  console.log(`   - ${REGIONS.length} Regions created`);
  console.log(`   - ${REGIONS.reduce((sum, r) => sum + r.branches, 0)} Branches created`);
  console.log(`   - ${REGIONS.reduce((sum, r) => sum + r.branches, 0)} KPOs created`);
  console.log(`   - ${REGIONS.reduce((sum, r) => sum + r.branches * 2, 0)} Bookers created`);
  console.log(`   - ${REGIONS.reduce((sum, r) => sum + r.branches * 2, 0)} Salesmen created`);
  console.log(`\n💡 To add admin user, run: node scripts/seedAdmin.js`);
  console.log(`\n💡 To add products, run: node scripts/seedProducts.js`);
  console.log(`\n🔑 Default password for all users: ${DEFAULT_PASSWORD}`);
  console.log('⚠️  Users should change their password on first login!');
  console.log('='.repeat(50));
}

// Run seed
seedFirebase()
  .then(() => {
    console.log('\n✅ All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
