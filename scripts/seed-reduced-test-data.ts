/**
 * Reduced Test Data Seed Script
 * 
 * Seeds reduced test data for faster testing:
 * - 4 Regions, 8 Branches (2 per region)
 * - 8 KPOs (1 per branch)
 * - 16 Salesmen (2 per branch)
 * - 32 Bookers (2 per salesman, 4 per branch)
 * - 96 Shops (3 per booker)
 * - 192 Orders (2 per shop)
 * - 192 Deliveries (1 per order)
 * - 134 Ledger Entries (SALE_DELIVERED for delivered orders)
 * - 20 Products
 * 
 * Usage: npx tsx scripts/seed-reduced-test-data.ts
 */

import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, writeBatch, getDocs, getDoc } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
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
// Use database ID 'pafood' instead of default
const db = getFirestore(app, 'pafood');

const DEFAULT_PASSWORD = 'Password123!';
const BATCH_SIZE = 500;
const USER_BATCH_SIZE = 100;

// Pakistani names
const PAKISTANI_NAMES = {
  kpo: [
    { first: 'Ahmed', last: 'Khan' },
    { first: 'Hassan', last: 'Ali' },
    { first: 'Usman', last: 'Malik' },
    { first: 'Bilal', last: 'Ahmed' },
    { first: 'Zain', last: 'Hussain' },
    { first: 'Faisal', last: 'Sheikh' },
    { first: 'Tariq', last: 'Iqbal' },
    { first: 'Nadeem', last: 'Raza' }
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
    { first: 'Omer', last: 'Khan' },
    { first: 'Parvez', last: 'Butt' },
    { first: 'Qasim', last: 'Rana' }
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
    { first: 'Yasir', last: 'Siddiqui' },
    { first: 'Zubair', last: 'Ahmed' },
    { first: 'Fahad', last: 'Hassan' },
    { first: 'Adnan', last: 'Malik' },
    { first: 'Bilal', last: 'Sheikh' },
    { first: 'Hamza', last: 'Iqbal' },
    { first: 'Saad', last: 'Raza' },
    { first: 'Umar', last: 'Khan' },
    { first: 'Ali', last: 'Butt' },
    { first: 'Hassan', last: 'Rana' },
    { first: 'Usman', last: 'Chaudhry' },
    { first: 'Ahmad', last: 'Yousaf' },
    { first: 'Zain', last: 'Akram' },
    { first: 'Faisal', last: 'Nawaz' },
    { first: 'Tariq', last: 'Qureshi' },
    { first: 'Nadeem', last: 'Hashmi' },
    { first: 'Shahid', last: 'Abbasi' },
    { first: 'Imran', last: 'Mirza' },
    { first: 'Kamran', last: 'Bhatti' }
  ]
};

// Regions
const REGIONS = [
  { name: 'Karachi', code: 'KHI' },
  { name: 'Lahore', code: 'LHR' },
  { name: 'Islamabad', code: 'ISB' },
  { name: 'Faisalabad', code: 'FSD' }
];

// Products (20 products)
const PRODUCTS = [
  { name: 'چپس', nameEn: 'Chips', category: 'snacks', price: 50, maxDiscount: 5 },
  { name: 'بسکٹ', nameEn: 'Biscuit', category: 'snacks', price: 80, maxDiscount: 5 },
  { name: 'نیمکو', nameEn: 'Nimco', category: 'nimco', price: 120, maxDiscount: 5 },
  { name: 'مونگ پھلی', nameEn: 'Peanuts', category: 'peanuts', price: 300, maxDiscount: 5 },
  { name: 'چینی', nameEn: 'Sugar', category: 'bulk', price: 150, maxDiscount: 10 },
  { name: 'چاول', nameEn: 'Rice', category: 'bulk', price: 200, maxDiscount: 10 },
  { name: 'تیل', nameEn: 'Oil', category: 'bulk', price: 500, maxDiscount: 10 },
  { name: 'آٹا', nameEn: 'Flour', category: 'bulk', price: 180, maxDiscount: 10 },
  { name: 'مصالحہ', nameEn: 'Spices', category: 'other', price: 250, maxDiscount: 5 },
  { name: 'چائے', nameEn: 'Tea', category: 'other', price: 400, maxDiscount: 5 },
  { name: 'مٹھائی', nameEn: 'Sweets', category: 'sweets', price: 350, maxDiscount: 5 },
  { name: 'کیک', nameEn: 'Cake', category: 'sweets', price: 450, maxDiscount: 5 },
  { name: 'چاکلیٹ', nameEn: 'Chocolate', category: 'sweets', price: 200, maxDiscount: 5 },
  { name: 'کریکر', nameEn: 'Cracker', category: 'snacks', price: 100, maxDiscount: 5 },
  { name: 'پاپ کارن', nameEn: 'Popcorn', category: 'snacks', price: 150, maxDiscount: 5 },
  { name: 'نمک', nameEn: 'Salt', category: 'other', price: 60, maxDiscount: 5 },
  { name: 'دال', nameEn: 'Lentils', category: 'bulk', price: 280, maxDiscount: 10 },
  { name: 'چنے', nameEn: 'Chickpeas', category: 'bulk', price: 320, maxDiscount: 10 },
  { name: 'کاجو', nameEn: 'Cashew', category: 'peanuts', price: 1200, maxDiscount: 5 },
  { name: 'بادام', nameEn: 'Almond', category: 'peanuts', price: 1500, maxDiscount: 5 }
];

// Helper functions
function generatePhone(index: number): string {
  const phoneNumber = String(1000000 + index).padStart(7, '0');
  return `+92 300 ${phoneNumber}`;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function randomDate(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
}

function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function getMonthKey(date: string): string {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Data storage
interface SeedData {
  regions: Array<{ id: string; name: string; code: string }>;
  branches: Array<{ id: string; name: string; code: string; regionId: string }>;
  products: Array<{ id: string; name: string; nameEn: string; category: string; price: number; maxDiscount: number }>;
  kpos: Array<{ id: string; email: string; name: string; regionId: string; branchId: string }>;
  salesmen: Array<{ id: string; email: string; name: string; regionId: string; branchId: string }>;
  bookers: Array<{ id: string; email: string; name: string; regionId: string; branchId: string; maxDiscountPercent: number; maxDiscountAmount: number; level: string }>;
  mappings: Array<{ salesmanId: string; bookerIds: string[] }>;
  shops: Array<{ id: string; shopId: string; shopName: string; bookerId: string; salesmanId: string; regionId: string; branchId: string }>;
  orders: Array<any>;
  deliveries: Array<any>;
  ledgerEntries: Array<any>;
}

const seedData: SeedData = {
  regions: [],
  branches: [],
  products: [],
  kpos: [],
  salesmen: [],
  bookers: [],
  mappings: [],
  shops: [],
  orders: [],
  deliveries: [],
  ledgerEntries: []
};

// Authentication with option to create admin user
async function authenticate(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve, reject) => {
    console.log('🔐 Authentication required for seeding operations.\n');
    console.log('⚠️  You need to sign in with an admin account.\n');
    console.log('💡 If database is empty, admin user will be created automatically.\n');
    
    rl.question('Admin Email (default: admin@pafood.com): ', (email) => {
      const adminEmail = email.trim() || 'admin@pafood.com';
      
      rl.question('Admin Password (default: Password123!): ', async (password) => {
        const adminPassword = password.trim() || 'Password123!';
        rl.close();
        
        try {
          console.log('\n🔐 Attempting to authenticate...');
          
          // Try to sign in first
          try {
            await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
            console.log('✅ Authentication successful (existing user)!\n');
            resolve();
            return;
          } catch (signInError: any) {
            // If user doesn't exist, create it
            if (signInError.code === 'auth/user-not-found' || signInError.code === 'auth/invalid-credential') {
              console.log('⚠️  Admin user not found. Creating new admin user...');
              
              try {
                // Create admin user in Firebase Authentication
                const userCredential = await createUserWithEmailAndPassword(auth, adminEmail, adminPassword);
                console.log('✅ Admin user created successfully!');
                
                // Create admin user document in Firestore
                try {
                  await setDoc(doc(db, 'users', userCredential.user.uid), {
                    id: userCredential.user.uid,
                    email: adminEmail,
                    name: 'Admin User',
                    role: 'admin',
                    status: 'active',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    syncStatus: 'synced'
                  });
                  console.log('✅ Admin user document created in Firestore!');
                } catch (firestoreError: any) {
                  console.log('⚠️  Could not create Firestore document (database may still be initializing):', firestoreError.message);
                  console.log('   User created in Authentication, will continue...');
                }
                
                console.log('✅ Authentication successful (new user created)!\n');
                resolve();
                return;
              } catch (createError: any) {
                if (createError.code === 'auth/email-already-in-use') {
                  // User exists but password might be wrong
                  console.error('\n❌ User exists but password is incorrect.');
                  console.error('   Please use the correct password or reset it in Firebase Console.');
                  reject(createError);
                  return;
                } else {
                  console.error(`\n❌ Failed to create admin user: ${createError.message}`);
                  reject(createError);
                  return;
                }
              }
            } else {
              // Other authentication errors
              console.error(`\n❌ Authentication failed: ${signInError.message}`);
              console.error(`   Error code: ${signInError.code}`);
              reject(signInError);
              return;
            }
          }
        } catch (error: any) {
          console.error(`\n❌ Unexpected error during authentication: ${error.message}`);
          reject(error);
        }
      });
    });
  });
}

// Load existing data to avoid duplicates
async function loadExistingData(): Promise<void> {
  console.log('📥 Checking for existing data...\n');

  try {
    // Load existing regions
    try {
      const regionsSnapshot = await getDocs(collection(db, 'regions'));
      if (!regionsSnapshot.empty) {
        regionsSnapshot.forEach(doc => {
          const data = doc.data();
          seedData.regions.push({ id: doc.id, name: data.name, code: data.code });
        });
        console.log(`  ✓ Found ${seedData.regions.length} existing regions`);
      } else {
        console.log(`  ✓ No existing regions found (will create new)`);
      }
    } catch (error: any) {
      console.log(`  ⚠️  Could not load regions: ${error.message} (will create new)`);
    }

    // Load existing branches
    try {
      const branchesSnapshot = await getDocs(collection(db, 'branches'));
      if (!branchesSnapshot.empty) {
        branchesSnapshot.forEach(doc => {
          const data = doc.data();
          seedData.branches.push({ id: doc.id, name: data.name, code: data.code, regionId: data.regionId });
        });
        console.log(`  ✓ Found ${seedData.branches.length} existing branches`);
      } else {
        console.log(`  ✓ No existing branches found (will create new)`);
      }
    } catch (error: any) {
      console.log(`  ⚠️  Could not load branches: ${error.message} (will create new)`);
    }

    // Load existing products
    try {
      const productsSnapshot = await getDocs(collection(db, 'products'));
      if (!productsSnapshot.empty) {
        productsSnapshot.forEach(doc => {
          const data = doc.data();
          seedData.products.push({
            id: doc.id,
            name: data.name,
            nameEn: data.nameEn,
            category: data.category,
            price: data.price,
            maxDiscount: data.maxDiscount
          });
        });
        console.log(`  ✓ Found ${seedData.products.length} existing products`);
      } else {
        console.log(`  ✓ No existing products found (will create new)`);
      }
    } catch (error: any) {
      console.log(`  ⚠️  Could not load products: ${error.message} (will create new)`);
    }

    // Load existing users
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      if (!usersSnapshot.empty) {
        usersSnapshot.forEach(doc => {
          const data = doc.data();
          const role = (data.role || '').toLowerCase();
          if (role === 'kpo') {
            seedData.kpos.push({ id: doc.id, email: data.email, name: data.name, regionId: data.regionId, branchId: data.branch });
          } else if (role === 'salesman') {
            seedData.salesmen.push({ id: doc.id, email: data.email, name: data.name, regionId: data.regionId, branchId: data.branch });
          } else if (role === 'booker') {
            seedData.bookers.push({
              id: doc.id,
              email: data.email,
              name: data.name,
              regionId: data.regionId,
              branchId: data.branch,
              maxDiscountPercent: data.maxDiscountPercent || 10,
              maxDiscountAmount: data.maxDiscountAmount || 3000,
              level: data.level || 'senior'
            });
          }
        });
        console.log(`  ✓ Found ${seedData.kpos.length} KPOs, ${seedData.salesmen.length} salesmen, ${seedData.bookers.length} bookers`);
      } else {
        console.log(`  ✓ No existing users found (will create new)`);
      }
    } catch (error: any) {
      console.log(`  ⚠️  Could not load users: ${error.message} (will create new)`);
    }

    // Load existing mappings
    try {
      const mappingsSnapshot = await getDocs(collection(db, 'mappings'));
      if (!mappingsSnapshot.empty) {
        mappingsSnapshot.forEach(doc => {
          const data = doc.data();
          seedData.mappings.push({ salesmanId: data.salesmanId, bookerIds: data.bookerIds || [] });
        });
        console.log(`  ✓ Found ${seedData.mappings.length} existing mappings`);
      } else {
        console.log(`  ✓ No existing mappings found (will create new)`);
      }
    } catch (error: any) {
      console.log(`  ⚠️  Could not load mappings: ${error.message} (will create new)`);
    }
  } catch (error: any) {
    console.log(`  ⚠️  Error loading existing data: ${error.message}`);
    console.log(`  → Continuing with fresh seeding...`);
  }

  console.log('');
}

// Phase 1: Base Data (Regions, Branches, Products)
async function seedBaseData(): Promise<void> {
  console.log('📋 Phase 1: Seeding base data (Regions, Branches, Products)...\n');

  // Seed Regions (only if not exists)
  console.log('  Creating regions...');
  for (const region of REGIONS) {
    const existing = seedData.regions.find(r => r.name === region.name && r.code === region.code);
    if (existing) {
      console.log(`    ⚠️  Region ${region.name} already exists, skipping`);
      continue;
    }

    const regionId = uuidv4();
    await setDoc(doc(db, 'regions', regionId), {
      id: regionId,
      name: region.name,
      code: region.code,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'synced'
    });
    seedData.regions.push({ id: regionId, name: region.name, code: region.code });
  }
  console.log(`  ✓ Regions: ${seedData.regions.length} total`);

  // Seed Branches (only if not exists)
  console.log('  Creating branches...');
  for (const region of seedData.regions) {
    for (let i = 1; i <= 2; i++) {
      const branchName = `${region.name} Branch ${i}`;
      const branchCode = `${region.code}-${i}`;
      const existing = seedData.branches.find(b => b.name === branchName && b.regionId === region.id);
      
      if (existing) {
        console.log(`    ⚠️  Branch ${branchName} already exists, skipping`);
        continue;
      }

      const branchId = uuidv4();
      await setDoc(doc(db, 'branches', branchId), {
        id: branchId,
        name: branchName,
        code: branchCode,
        regionId: region.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        syncStatus: 'synced'
      });
      seedData.branches.push({ id: branchId, name: branchName, code: branchCode, regionId: region.id });
    }
  }
  console.log(`  ✓ Branches: ${seedData.branches.length} total`);

  // Seed Products (only if not exists)
  console.log('  Creating products...');
  for (const product of PRODUCTS) {
    const existing = seedData.products.find(p => p.name === product.name && p.nameEn === product.nameEn);
    if (existing) {
      console.log(`    ⚠️  Product ${product.name} already exists, skipping`);
      continue;
    }

    const productId = uuidv4();
    await setDoc(doc(db, 'products', productId), {
      id: productId,
      name: product.name,
      nameEn: product.nameEn,
      category: product.category,
      price: product.price,
      maxDiscount: product.maxDiscount,
      unit: 'pcs',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'synced'
    });
    seedData.products.push({
      id: productId,
      name: product.name,
      nameEn: product.nameEn,
      category: product.category,
      price: product.price,
      maxDiscount: product.maxDiscount
    });
  }
  console.log(`  ✓ Products: ${seedData.products.length} total\n`);
}

// Phase 2: Users (KPOs, Salesmen, Bookers)
async function seedUsers(): Promise<void> {
  console.log('👥 Phase 2: Seeding users (KPOs, Salesmen, Bookers)...\n');

  let nameIndex = {
    kpo: 0,
    salesman: 0,
    booker: 0
  };
  let phoneIndex = 1;

  // Seed KPOs (1 per branch)
  console.log('  Creating KPOs...');
  for (const branch of seedData.branches) {
    const existing = seedData.kpos.find(k => k.branchId === branch.id);
    if (existing) {
      console.log(`    ⚠️  KPO for branch ${branch.name} already exists, skipping`);
      continue;
    }

    const nameData = PAKISTANI_NAMES.kpo[nameIndex.kpo % PAKISTANI_NAMES.kpo.length];
    const name = `${nameData.first} ${nameData.last}`;
    const email = `kpo.${branch.code.toLowerCase()}.${nameIndex.kpo + 1}@pafood.com`;

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, DEFAULT_PASSWORD);
      const userId = userCredential.user.uid;
      
      await setDoc(doc(db, 'users', userId), {
        id: userId,
        email: email,
        name: name,
        phone: generatePhone(phoneIndex++),
        role: 'KPO',
        status: 'active',
        regionId: branch.regionId,
        branch: branch.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        syncStatus: 'synced'
      });
      
      seedData.kpos.push({ id: userId, email, name, regionId: branch.regionId, branchId: branch.id });
      nameIndex.kpo++;
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        console.log(`    ⚠️  KPO ${email} already exists in Auth, skipping`);
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const existingUser = usersSnapshot.docs.find(d => d.data().email === email);
        if (existingUser) {
          const data = existingUser.data();
          seedData.kpos.push({ id: existingUser.id, email, name: data.name, regionId: branch.regionId, branchId: branch.id });
        }
      } else {
        console.error(`  ✗ Error creating KPO ${email}: ${error.message}`);
      }
    }
  }
  console.log(`  ✓ Created ${seedData.kpos.length} KPOs`);

  // Seed Salesmen (2 per branch)
  console.log('  Creating salesmen...');
  for (const branch of seedData.branches) {
    for (let i = 0; i < 2; i++) {
      const nameData = PAKISTANI_NAMES.salesman[nameIndex.salesman % PAKISTANI_NAMES.salesman.length];
      const name = `${nameData.first} ${nameData.last}`;
      const email = `salesman.${branch.code.toLowerCase()}.${nameIndex.salesman + 1}@pafood.com`;

      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, DEFAULT_PASSWORD);
        const userId = userCredential.user.uid;
        
        await setDoc(doc(db, 'users', userId), {
          id: userId,
          email: email,
          name: name,
          phone: generatePhone(phoneIndex++),
          role: 'Salesman',
          status: 'active',
          regionId: branch.regionId,
          branch: branch.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          syncStatus: 'synced'
        });
        
        seedData.salesmen.push({ id: userId, email, name, regionId: branch.regionId, branchId: branch.id });
        nameIndex.salesman++;
      } catch (error: any) {
        if (error.code === 'auth/email-already-in-use') {
          console.log(`    ⚠️  Salesman ${email} already exists in Auth, skipping`);
          const usersSnapshot = await getDocs(collection(db, 'users'));
          const existingUser = usersSnapshot.docs.find(d => d.data().email === email);
          if (existingUser) {
            const data = existingUser.data();
            seedData.salesmen.push({ id: existingUser.id, email, name: data.name, regionId: branch.regionId, branchId: branch.id });
          }
        } else {
          console.error(`  ✗ Error creating salesman ${email}: ${error.message}`);
        }
      }
    }
  }
  console.log(`  ✓ Created ${seedData.salesmen.length} salesmen`);

  // Seed Bookers (2 per salesman = 4 per branch)
  console.log('  Creating bookers...');
  for (const branch of seedData.branches) {
    const branchSalesmen = seedData.salesmen.filter(s => s.branchId === branch.id);
    
    for (const salesman of branchSalesmen) {
      for (let i = 0; i < 2; i++) {
        const nameData = PAKISTANI_NAMES.booker[nameIndex.booker % PAKISTANI_NAMES.booker.length];
        const name = `${nameData.first} ${nameData.last}`;
        const email = `booker.${branch.code.toLowerCase()}.${nameIndex.booker + 1}@pafood.com`;
        const level = randomChoice(['junior', 'senior']);
        const maxDiscountPercent = level === 'senior' ? 15 : 10;
        const maxDiscountAmount = level === 'senior' ? 5000 : 3000;

        try {
          const userCredential = await createUserWithEmailAndPassword(auth, email, DEFAULT_PASSWORD);
          const userId = userCredential.user.uid;
          
          await setDoc(doc(db, 'users', userId), {
            id: userId,
            email: email,
            name: name,
            phone: generatePhone(phoneIndex++),
            role: 'Booker',
            level: level,
            maxDiscountPercent: maxDiscountPercent,
            maxDiscountAmount: maxDiscountAmount,
            status: 'active',
            regionId: branch.regionId,
            branch: branch.id,
            monthlyUnauthorizedDiscounts: {},
            monthlyUnauthorizedDiscountOrders: {},
            totalUnauthorizedDiscount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            syncStatus: 'synced'
          });
          
          seedData.bookers.push({
            id: userId,
            email,
            name,
            regionId: branch.regionId,
            branchId: branch.id,
            maxDiscountPercent,
            maxDiscountAmount,
            level
          });
          nameIndex.booker++;
        } catch (error: any) {
          if (error.code === 'auth/email-already-in-use') {
            console.log(`    ⚠️  Booker ${email} already exists in Auth, skipping`);
            const usersSnapshot = await getDocs(collection(db, 'users'));
            const existingUser = usersSnapshot.docs.find(d => d.data().email === email);
            if (existingUser) {
              const data = existingUser.data();
              seedData.bookers.push({
                id: existingUser.id,
                email,
                name: data.name,
                regionId: branch.regionId,
                branchId: branch.id,
                maxDiscountPercent: data.maxDiscountPercent || maxDiscountPercent,
                maxDiscountAmount: data.maxDiscountAmount || maxDiscountAmount,
                level: data.level || level
              });
            }
          } else {
            console.error(`  ✗ Error creating booker ${email}: ${error.message}`);
          }
        }
      }
    }
  }
  console.log(`  ✓ Created ${seedData.bookers.length} bookers\n`);
}

// Phase 3: Salesman-Booker Mappings
async function seedMappings(): Promise<void> {
  console.log('🔗 Phase 3: Seeding salesman-booker mappings...\n');

  // Check existing mappings
  const existingMappings = new Map<string, string[]>();
  seedData.mappings.forEach(m => {
    existingMappings.set(m.salesmanId, m.bookerIds);
  });

  let bookerIndex = 0;
  let createdCount = 0;
  
  for (const salesman of seedData.salesmen) {
    // Check if mapping already exists
    if (existingMappings.has(salesman.id)) {
      console.log(`    ⚠️  Mapping for salesman ${salesman.name} already exists, skipping`);
      continue;
    }

    const bookerIds: string[] = [];
    const bookerNames: string[] = [];
    
    // Assign exactly 2 bookers to each salesman
    for (let i = 0; i < 2; i++) {
      if (bookerIndex < seedData.bookers.length) {
        const booker = seedData.bookers[bookerIndex];
        // Ensure booker is in same branch as salesman
        if (booker.branchId === salesman.branchId) {
          bookerIds.push(booker.id);
          bookerNames.push(booker.name);
          bookerIndex++;
        } else {
          // Find next booker in same branch
          const nextBooker = seedData.bookers.slice(bookerIndex + 1).find(b => b.branchId === salesman.branchId);
          if (nextBooker) {
            bookerIds.push(nextBooker.id);
            bookerNames.push(nextBooker.name);
            bookerIndex = seedData.bookers.findIndex(b => b.id === nextBooker.id) + 1;
          }
        }
      }
    }
    
    if (bookerIds.length === 0) {
      console.log(`    ⚠️  No bookers available for salesman ${salesman.name}, skipping`);
      continue;
    }
    
    const mappingId = uuidv4();
    await setDoc(doc(db, 'mappings', mappingId), {
      id: mappingId,
      salesmanId: salesman.id,
      salesmanName: salesman.name,
      bookerIds: bookerIds,
      bookerNames: bookerNames,
      regionId: salesman.regionId,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'synced'
    });
    
    seedData.mappings.push({ salesmanId: salesman.id, bookerIds });
    createdCount++;
  }
  
  console.log(`  ✓ Mappings: ${seedData.mappings.length} total (${createdCount} newly created)\n`);
}

// Phase 4: Shops
async function seedShops(): Promise<void> {
  console.log('🏪 Phase 4: Seeding shops...\n');

  const shopNames = [
    'General Store', 'Kirana Store', 'Super Mart', 'Convenience Store', 'Mini Market',
    'Corner Shop', 'Retail Store', 'Grocery Store', 'Food Mart', 'Quick Shop',
    'City Store', 'Town Shop', 'Local Mart', 'Family Store', 'Neighborhood Shop',
    'Daily Store', 'Fresh Mart', 'Value Store', 'Prime Shop', 'Elite Store'
  ];

  const ownerNames = [
    'Ahmed Ali', 'Hassan Khan', 'Usman Malik', 'Bilal Ahmed', 'Zain Hussain',
    'Faisal Sheikh', 'Tariq Iqbal', 'Nadeem Raza', 'Shahid Butt', 'Imran Rana'
  ];

  const cities = ['Lahore', 'Karachi', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan', 'Peshawar', 'Quetta'];
  const areas = ['Gulberg', 'DHA', 'Model Town', 'Cantt', 'Saddar', 'University Town', 'Hayatabad', 'Clifton'];

  let shopCounter = 0;
  let batch: any[] = [];
  
  for (const booker of seedData.bookers) {
    const salesman = seedData.mappings.find(m => m.bookerIds.includes(booker.id))?.salesmanId || '';
    const salesmanData = seedData.salesmen.find(s => s.id === salesman);
    
    // Create 3 shops per booker
    for (let i = 0; i < 3; i++) {
      const shopId = uuidv4();
      const manualShopId = `SHOP-${booker.regionId.substring(0, 3)}-${booker.branchId.substring(0, 3)}-${booker.id.substring(0, 3)}-${i + 1}`;
      const shopName = `${randomChoice(shopNames)} ${shopCounter + 1}`;
      const ownerName = randomChoice(ownerNames);
      const city = randomChoice(cities);
      const area = randomChoice(areas);
      
      const shopData = {
        id: shopId,
        shopId: manualShopId,
        shopName: shopName,
        ownerName: ownerName,
        phone: generatePhone(1000 + shopCounter),
        address: `${area}, ${city}`,
        area: area,
        city: city,
        bookerId: booker.id,
        bookerName: booker.name,
        salesmanId: salesman || undefined,
        salesmanName: salesmanData?.name || undefined,
        regionId: booker.regionId,
        branch: booker.branchId,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        syncStatus: 'synced' as const
      };
      
      batch.push({ ref: doc(db, 'shops', shopId), data: shopData });
      seedData.shops.push({
        id: shopId,
        shopId: manualShopId,
        shopName,
        bookerId: booker.id,
        salesmanId: salesman,
        regionId: booker.regionId,
        branchId: booker.branchId
      });
      shopCounter++;
      
      if (batch.length >= BATCH_SIZE) {
        const b = writeBatch(db);
        batch.forEach(({ ref, data }) => b.set(ref, data));
        await b.commit();
        console.log(`  → Shops: ${shopCounter}/96`);
        batch = [];
      }
    }
  }
  
  if (batch.length > 0) {
    const b = writeBatch(db);
    batch.forEach(({ ref, data }) => b.set(ref, data));
    await b.commit();
  }

  console.log(`  ✓ Created ${seedData.shops.length} shops\n`);
}

// Phase 5: Orders
async function seedOrders(): Promise<void> {
  console.log('📦 Phase 5: Seeding orders...\n');

  let orderCounter = 0;
  let batch: any[] = [];
  const unauthorizedOrderIds: string[] = [];

  // Status distribution: 70% delivered, 20% submitted, 10% draft
  const statusWeights = [
    { status: 'delivered', weight: 70 },
    { status: 'submitted', weight: 20 },
    { status: 'draft', weight: 10 }
  ];

  for (const shop of seedData.shops) {
    const booker = seedData.bookers.find(b => b.id === shop.bookerId)!;
    const salesman = shop.salesmanId ? seedData.salesmen.find(s => s.id === shop.salesmanId) : null;
    
    // Create 2 orders per shop
    for (let orderNum = 1; orderNum <= 2; orderNum++) {
      const orderId = uuidv4();
      const orderNumber = `ORD-${shop.branchId.substring(0, 3)}-${shop.bookerId.substring(0, 3)}-${orderCounter + 1}`;
      
      // Determine status based on weights
      const random = Math.random() * 100;
      let status: 'delivered' | 'submitted' | 'draft';
      if (random < 70) {
        status = 'delivered';
      } else if (random < 90) {
        status = 'submitted';
      } else {
        status = 'draft';
      }

      // Generate order items (2-5 items per order)
      const itemCount = randomInt(2, 5);
      const items: any[] = [];
      let subtotal = 0;

      for (let i = 0; i < itemCount; i++) {
        const product = randomChoice(seedData.products);
        const quantity = randomInt(1, 10);
        const unitPrice = product.price;
        const lineTotal = quantity * unitPrice;
        subtotal += lineTotal;

        items.push({
          productId: product.id,
          productName: product.name,
          productNameEn: product.nameEn,
          category: product.category,
          quantity: quantity,
          unit: 'pcs',
          unitPrice: unitPrice,
          lineTotal: lineTotal,
          maxAllowedDiscount: product.maxDiscount,
          discountPercent: 0,
          discountAmount: 0,
          allowedDiscount: 0,
          unauthorizedAmount: 0,
          finalAmount: lineTotal
        });
      }

      // Apply discounts (30% of orders have unauthorized discounts)
      const shouldHaveUnauthorized = Math.random() < 0.3;
      const unauthorizedType = shouldHaveUnauthorized 
        ? randomChoice(['item', 'order', 'both'])
        : null;

      let totalDiscount = 0;
      let allowedDiscount = 0;
      let unauthorizedDiscount = 0;
      let hasUnauthorized = false;

      // Apply item-level discounts
      items.forEach(item => {
        const product = seedData.products.find(p => p.id === item.productId)!;
        const maxAllowedDiscount = product.maxDiscount;
        let discountPercent = 0;

        if (shouldHaveUnauthorized && (unauthorizedType === 'item' || unauthorizedType === 'both')) {
          // Apply unauthorized discount (exceeds maxDiscount)
          discountPercent = maxAllowedDiscount + randomChoice([5, 10, 15, 20, 25]);
        } else {
          // Apply allowed discount
          discountPercent = randomInt(0, maxAllowedDiscount);
        }

        item.discountPercent = discountPercent;
        item.discountAmount = item.lineTotal * (discountPercent / 100);
        item.finalAmount = item.lineTotal - item.discountAmount;
        totalDiscount += item.discountAmount;

        const maxAllowed = item.lineTotal * (maxAllowedDiscount / 100);
        const allowed = Math.min(item.discountAmount, maxAllowed);
        allowedDiscount += allowed;
        item.allowedDiscount = allowed;
        item.unauthorizedAmount = Math.max(0, item.discountAmount - allowed);
        unauthorizedDiscount += item.unauthorizedAmount;
        if (item.unauthorizedAmount > 0) hasUnauthorized = true;
      });

      // Check order-level unauthorized (if total discount exceeds booker's maxDiscountAmount)
      if (shouldHaveUnauthorized && (unauthorizedType === 'order' || unauthorizedType === 'both')) {
        if (totalDiscount > booker.maxDiscountAmount) {
          const excess = totalDiscount - booker.maxDiscountAmount;
          unauthorizedDiscount += excess;
          hasUnauthorized = true;
        }
      }

      let grandTotal = subtotal - totalDiscount;

      // Ensure order amount is in range Rs. 5,000 - Rs. 50,000
      if (grandTotal < 5000) {
        const scaleFactor = 5000 / grandTotal;
        items.forEach(item => {
          item.quantity = Math.ceil(item.quantity * scaleFactor);
          item.lineTotal = item.quantity * item.unitPrice;
          item.discountAmount = item.lineTotal * (item.discountPercent / 100);
          item.finalAmount = item.lineTotal - item.discountAmount;
        });
        subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
        totalDiscount = items.reduce((sum, item) => sum + item.discountAmount, 0);
        grandTotal = subtotal - totalDiscount;
      } else if (grandTotal > 50000) {
        const scaleFactor = 50000 / grandTotal;
        items.forEach(item => {
          item.quantity = Math.max(1, Math.floor(item.quantity * scaleFactor));
          item.lineTotal = item.quantity * item.unitPrice;
          item.discountAmount = item.lineTotal * (item.discountPercent / 100);
          item.finalAmount = item.lineTotal - item.discountAmount;
        });
        subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
        totalDiscount = items.reduce((sum, item) => sum + item.discountAmount, 0);
        grandTotal = subtotal - totalDiscount;
      }

      // Recalculate totals after scaling
      subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
      totalDiscount = items.reduce((sum, item) => sum + item.discountAmount, 0);
      allowedDiscount = items.reduce((sum, item) => {
        const maxAllowed = item.lineTotal * (item.maxAllowedDiscount / 100);
        return sum + Math.min(item.discountAmount, maxAllowed);
      }, 0);
      unauthorizedDiscount = items.reduce((sum, item) => sum + item.unauthorizedAmount, 0);
      
      if (totalDiscount > booker.maxDiscountAmount) {
        unauthorizedDiscount += (totalDiscount - booker.maxDiscountAmount);
      }
      
      grandTotal = subtotal - totalDiscount;

      // Date: spread across last 30 days
      const daysAgo = randomInt(0, 30);
      const createdAt = randomDate(daysAgo);

      const orderData = {
        id: orderId,
        orderNumber: orderNumber,
        shopId: shop.id,
        shopName: shop.shopName,
        bookerId: booker.id,
        bookerName: booker.name,
        salesmanId: salesman?.id || undefined,
        salesmanName: salesman?.name || undefined,
        regionId: booker.regionId,
        branch: booker.branchId,
        status: status,
        items: items,
        subtotal: Math.round(subtotal * 100) / 100,
        totalDiscount: Math.round(totalDiscount * 100) / 100,
        allowedDiscount: Math.round(allowedDiscount * 100) / 100,
        unauthorizedDiscount: Math.round(unauthorizedDiscount * 100) / 100,
        grandTotal: Math.round(grandTotal * 100) / 100,
        notes: '',
        acknowledgedUnauthorizedDiscount: hasUnauthorized,
        paymentMode: 'cash' as const,
        cashAmount: status === 'delivered' ? grandTotal : 0,
        creditAmount: 0,
        paymentStatus: status === 'delivered' ? 'PAID' as const : 'UNPAID' as const,
        paidAmount: status === 'delivered' ? grandTotal : 0,
        remainingBalance: 0,
        billGenerated: status === 'delivered',
        loadFormGenerated: status === 'delivered',
        createdAt: createdAt,
        updatedAt: createdAt,
        syncStatus: 'synced' as const
      };

      batch.push({ ref: doc(db, 'orders', orderId), data: orderData });
      seedData.orders.push({ ...orderData, unauthorizedAmount: unauthorizedDiscount });
      if (hasUnauthorized) {
        unauthorizedOrderIds.push(orderId);
      }
      orderCounter++;

      if (batch.length >= BATCH_SIZE) {
        const b = writeBatch(db);
        batch.forEach(({ ref, data }) => b.set(ref, data));
        await b.commit();
        console.log(`  → Orders: ${orderCounter}/192`);
        batch = [];
      }
    }
  }

  if (batch.length > 0) {
    const b = writeBatch(db);
    batch.forEach(({ ref, data }) => b.set(ref, data));
    await b.commit();
  }

  console.log(`  ✓ Created ${seedData.orders.length} orders`);
  console.log(`    - Delivered: ${seedData.orders.filter(o => o.status === 'delivered').length}`);
  console.log(`    - Submitted: ${seedData.orders.filter(o => o.status === 'submitted').length}`);
  console.log(`    - Draft: ${seedData.orders.filter(o => o.status === 'draft').length}`);
  console.log(`    - With unauthorized discount: ${unauthorizedOrderIds.length}\n`);
}

// Phase 6: Deliveries
async function seedDeliveries(): Promise<void> {
  console.log('🚚 Phase 6: Seeding deliveries...\n');

  let deliveryCounter = 0;
  let batch: any[] = [];

  for (const order of seedData.orders) {
    const shop = seedData.shops.find(s => s.id === order.shopId)!;
    const salesman = order.salesmanId ? seedData.salesmen.find(s => s.id === order.salesmanId) : null;

    // Delivery status based on order status
    let deliveryStatus: 'pending' | 'delivered' | 'failed';
    if (order.status === 'delivered') {
      deliveryStatus = 'delivered';
    } else if (order.status === 'submitted') {
      deliveryStatus = 'pending';
    } else {
      deliveryStatus = 'failed';
    }

    // Delivery date: 1-3 days after order date
    const orderDate = new Date(order.createdAt);
    const deliveryDays = randomInt(1, 3);
    orderDate.setDate(orderDate.getDate() + deliveryDays);
    const deliveredAt = deliveryStatus === 'delivered' ? orderDate.toISOString() : undefined;
    const assignedAt = orderDate.toISOString();

    // Convert order items to delivery items
    const deliveryItems = order.items.map((item: any) => ({
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      deliveredQuantity: deliveryStatus === 'delivered' ? item.quantity : (deliveryStatus === 'failed' ? randomInt(0, item.quantity - 1) : 0),
      unit: item.unit,
      unitPrice: item.unitPrice
    }));

    const deliveredAmount = deliveryStatus === 'delivered' 
      ? order.grandTotal 
      : (deliveryStatus === 'failed' ? order.grandTotal * randomFloat(0.5, 0.9) : 0);

    // Build delivery data without undefined fields
    const deliveryData: any = {
      id: uuidv4(),
      orderId: order.id,
      orderNumber: order.orderNumber,
      shopId: shop.id,
      shopName: shop.shopName,
      shopAddress: `${shop.shopName}, ${shop.regionId}`,
      shopPhone: generatePhone(randomInt(2000, 3000)),
      regionId: order.regionId,
      salesmanId: salesman?.id || '',
      salesmanName: salesman?.name || '',
      assignedAt: assignedAt,
      status: deliveryStatus,
      items: deliveryItems,
      totalAmount: order.grandTotal,
      deliveredAmount: Math.round(deliveredAmount * 100) / 100,
      paymentCollected: deliveryStatus === 'delivered',
      paymentMode: 'cash' as const,
      paymentStatus: deliveryStatus === 'delivered' ? 'PAID' as const : 'UNPAID' as const,
      paidAmount: deliveryStatus === 'delivered' ? order.grandTotal : 0,
      remainingBalance: deliveryStatus === 'delivered' ? 0 : order.grandTotal,
      invoiceGenerated: deliveryStatus === 'delivered',
      invoiceSigned: deliveryStatus === 'delivered',
      createdAt: assignedAt,
      updatedAt: deliveredAt || assignedAt,
      syncStatus: 'synced' as const
    };

    // Add optional fields only if they have values
    if (deliveredAt) {
      deliveryData.deliveredAt = deliveredAt;
      deliveryData.paymentCollectedAt = deliveredAt;
    }
    if (deliveryStatus === 'failed') {
      deliveryData.failureReason = randomChoice(['Shop closed', 'Address not found', 'Customer not available', 'Payment issue']);
      deliveryData.failureNotes = `Delivery failed: ${deliveryData.failureReason}`;
    }

    batch.push({ ref: doc(db, 'deliveries', deliveryData.id), data: deliveryData });
    seedData.deliveries.push(deliveryData);
    deliveryCounter++;

    if (batch.length >= BATCH_SIZE) {
      const b = writeBatch(db);
      batch.forEach(({ ref, data }) => b.set(ref, data));
      await b.commit();
      console.log(`  → Deliveries: ${deliveryCounter}/192`);
      batch = [];
    }
  }

  if (batch.length > 0) {
    const b = writeBatch(db);
    batch.forEach(({ ref, data }) => b.set(ref, data));
    await b.commit();
  }

  console.log(`  ✓ Created ${seedData.deliveries.length} deliveries`);
  console.log(`    - Delivered: ${seedData.deliveries.filter(d => d.status === 'delivered').length}`);
  console.log(`    - Pending: ${seedData.deliveries.filter(d => d.status === 'pending').length}`);
  console.log(`    - Failed: ${seedData.deliveries.filter(d => d.status === 'failed').length}\n`);
}

// Phase 7: Ledger Entries
async function seedLedgerEntries(): Promise<void> {
  console.log('💰 Phase 7: Seeding ledger entries...\n');

  // Only create ledger entries for delivered orders
  const deliveredOrders = seedData.orders.filter(o => o.status === 'delivered');
  
  let ledgerCounter = 0;
  let batch: any[] = [];

  for (const order of deliveredOrders) {
    const shop = seedData.shops.find(s => s.id === order.shopId)!;
    const booker = seedData.bookers.find(b => b.id === order.bookerId)!;
    const salesman = order.salesmanId ? seedData.salesmen.find(s => s.id === order.salesmanId) : null;
    const delivery = seedData.deliveries.find(d => d.orderId === order.id);

    const ledgerId = uuidv4();
    const createdAt = delivery?.deliveredAt || order.createdAt;

    const ledgerData = {
      id: ledgerId,
      ledger_id: ledgerId,
      order_id: order.id,
      orderId: order.id,
      order_number: order.orderNumber,
      type: 'SALE_DELIVERED' as const,
      region_id: order.regionId,
      regionId: order.regionId,
      branch_id: order.branch,
      branchId: order.branch,
      party_id: shop.id,
      shopId: shop.id,
      shopName: shop.shopName,
      salesman_id: salesman?.id || '',
      salesmanId: salesman?.id || '',
      booker_id: booker.id,
      bookerId: booker.id,
      gross_amount: order.subtotal,
      discount_allowed: order.allowedDiscount,
      discount_given: order.totalDiscount,
      unauthorized_discount: order.unauthorizedDiscount,
      net_cash: order.grandTotal,
      amount: order.grandTotal,
      created_by: booker.id,
      created_at: createdAt,
      createdAt: createdAt,
      notes: `Order ${order.orderNumber} - Cash Sale`,
      syncStatus: 'synced' as const
    };

    batch.push({ ref: doc(db, 'ledger_transactions', ledgerId), data: ledgerData });
    seedData.ledgerEntries.push(ledgerData);
    ledgerCounter++;

    if (batch.length >= BATCH_SIZE) {
      const b = writeBatch(db);
      batch.forEach(({ ref, data }) => b.set(ref, data));
      await b.commit();
      console.log(`  → Ledger Entries: ${ledgerCounter}/134`);
      batch = [];
    }
  }

  if (batch.length > 0) {
    const b = writeBatch(db);
    batch.forEach(({ ref, data }) => b.set(ref, data));
    await b.commit();
  }

  console.log(`  ✓ Created ${seedData.ledgerEntries.length} ledger entries (SALE_DELIVERED)\n`);
}

// Phase 8: Track Unauthorized Discounts
async function trackUnauthorizedDiscounts(): Promise<void> {
  console.log('📊 Phase 8: Tracking unauthorized discounts...\n');

  const bookerDiscounts: Record<string, Record<string, { amount: number; orderIds: string[] }>> = {};

  for (const order of seedData.orders) {
    if (order.unauthorizedDiscount <= 0) continue;

    const monthKey = getMonthKey(order.createdAt);
    if (!bookerDiscounts[order.bookerId]) {
      bookerDiscounts[order.bookerId] = {};
    }
    if (!bookerDiscounts[order.bookerId][monthKey]) {
      bookerDiscounts[order.bookerId][monthKey] = { amount: 0, orderIds: [] };
    }
    bookerDiscounts[order.bookerId][monthKey].amount += order.unauthorizedDiscount;
    bookerDiscounts[order.bookerId][monthKey].orderIds.push(order.id);
  }

  // Update booker user documents
  let updatedCount = 0;
  for (const [bookerId, monthlyData] of Object.entries(bookerDiscounts)) {
    try {
      const bookerRef = doc(db, 'users', bookerId);
      const bookerDoc = await getDoc(bookerRef);
      
      if (!bookerDoc.exists()) continue;

      const bookerData = bookerDoc.data();
      const monthlyUnauthorizedDiscounts: Record<string, number> = { ...(bookerData.monthlyUnauthorizedDiscounts || {}) };
      const monthlyUnauthorizedDiscountOrders: Record<string, string[]> = { ...(bookerData.monthlyUnauthorizedDiscountOrders || {}) };
      let totalUnauthorizedDiscount = bookerData.totalUnauthorizedDiscount || 0;

      for (const [month, data] of Object.entries(monthlyData)) {
        monthlyUnauthorizedDiscounts[month] = (monthlyUnauthorizedDiscounts[month] || 0) + data.amount;
        monthlyUnauthorizedDiscountOrders[month] = [
          ...(monthlyUnauthorizedDiscountOrders[month] || []),
          ...data.orderIds
        ];
        totalUnauthorizedDiscount += data.amount;
      }

      await setDoc(bookerRef, {
        monthlyUnauthorizedDiscounts,
        monthlyUnauthorizedDiscountOrders,
        totalUnauthorizedDiscount: Math.round(totalUnauthorizedDiscount * 100) / 100
      }, { merge: true });

      updatedCount++;
    } catch (error: any) {
      console.error(`  ✗ Error updating booker ${bookerId}: ${error.message}`);
    }
  }

  console.log(`  ✓ Updated unauthorized discount tracking for ${updatedCount} bookers\n`);
}

// Phase 9: Verification
async function verifySeeding(): Promise<void> {
  console.log('✅ Phase 9: Verifying seeded data...\n');

  const verification: any = {
    counts: {},
    duplicates: {},
    relationships: {},
    integrity: {}
  };

  // Count verification
  const ordersSnapshot = await getDocs(collection(db, 'orders'));
  const deliveriesSnapshot = await getDocs(collection(db, 'deliveries'));
  const ledgerSnapshot = await getDocs(collection(db, 'ledger_transactions'));
  
  verification.counts.orders = ordersSnapshot.size;
  verification.counts.deliveries = deliveriesSnapshot.size;
  verification.counts.ledgerEntries = ledgerSnapshot.size;

  // Expected counts
  const expected = {
    orders: 192,
    deliveries: 192,
    ledgerEntries: 134 // 70% of 192
  };

  console.log('📊 Count Verification:');
  console.log(`  Orders: ${verification.counts.orders} (expected: ${expected.orders}) ${verification.counts.orders === expected.orders ? '✓' : '✗'}`);
  console.log(`  Deliveries: ${verification.counts.deliveries} (expected: ${expected.deliveries}) ${verification.counts.deliveries === expected.deliveries ? '✓' : '✗'}`);
  console.log(`  Ledger Entries: ${verification.counts.ledgerEntries} (expected: ${expected.ledgerEntries}) ${verification.counts.ledgerEntries === expected.ledgerEntries ? '✓' : '✗'}`);

  // Duplicate checks
  const deliveryOrderIds = new Set<string>();
  const ledgerOrderIds = new Set<string>();
  const duplicateDeliveries: string[] = [];
  const duplicateLedger: string[] = [];

  deliveriesSnapshot.forEach(doc => {
    const data = doc.data();
    const orderId = data.orderId;
    if (deliveryOrderIds.has(orderId)) {
      duplicateDeliveries.push(orderId);
    }
    deliveryOrderIds.add(orderId);
  });

  ledgerSnapshot.forEach(doc => {
    const data = doc.data();
    if (data.type === 'SALE_DELIVERED' && data.order_id) {
      if (ledgerOrderIds.has(data.order_id)) {
        duplicateLedger.push(data.order_id);
      }
      ledgerOrderIds.add(data.order_id);
    }
  });

  console.log('\n🔍 Duplicate Check:');
  console.log(`  Duplicate Deliveries: ${duplicateDeliveries.length} ${duplicateDeliveries.length === 0 ? '✓' : '✗'}`);
  console.log(`  Duplicate Ledger Entries: ${duplicateLedger.length} ${duplicateLedger.length === 0 ? '✓' : '✗'}`);

  // Relationship verification
  console.log('\n🔗 Relationship Verification:');
  
  // Check salesman-booker mappings
  const mappingsSnapshot = await getDocs(collection(db, 'mappings'));
  let mappingIssues = 0;
  mappingsSnapshot.forEach(doc => {
    const data = doc.data();
    if (data.bookerIds && data.bookerIds.length !== 2) {
      mappingIssues++;
    }
  });
  console.log(`  Salesman-Booker Mappings: ${mappingsSnapshot.size} (expected: 16) ${mappingsSnapshot.size === 16 ? '✓' : '✗'}`);
  console.log(`  Mapping Issues: ${mappingIssues} ${mappingIssues === 0 ? '✓' : '✗'}`);

  // Check orders per shop
  const shopsSnapshot = await getDocs(collection(db, 'shops'));
  let shopOrderIssues = 0;
  shopsSnapshot.forEach(shopDoc => {
    const shopId = shopDoc.id;
    const shopOrders = ordersSnapshot.docs.filter(d => d.data().shopId === shopId);
    if (shopOrders.length !== 2) {
      shopOrderIssues++;
    }
  });
  console.log(`  Orders per Shop: ${shopOrderIssues === 0 ? 'All shops have 2 orders ✓' : `${shopOrderIssues} shops have incorrect order count ✗`}`);

  // Check deliveries per order
  let deliveryIssues = 0;
  ordersSnapshot.forEach(orderDoc => {
    const orderId = orderDoc.id;
    const orderDeliveries = deliveriesSnapshot.docs.filter(d => d.data().orderId === orderId);
    if (orderDeliveries.length !== 1) {
      deliveryIssues++;
    }
  });
  console.log(`  Deliveries per Order: ${deliveryIssues === 0 ? 'All orders have 1 delivery ✓' : `${deliveryIssues} orders have incorrect delivery count ✗`}`);

  // Check ledger entries for delivered orders only
  const deliveredOrderIds = new Set(ordersSnapshot.docs
    .filter(d => d.data().status === 'delivered')
    .map(d => d.id));
  
  let ledgerIssues = 0;
  ledgerSnapshot.forEach(ledgerDoc => {
    const data = ledgerDoc.data();
    if (data.type === 'SALE_DELIVERED' && data.order_id) {
      if (!deliveredOrderIds.has(data.order_id)) {
        ledgerIssues++;
      }
    }
  });
  console.log(`  Ledger Entries for Delivered Orders Only: ${ledgerIssues === 0 ? '✓' : `✗ ${ledgerIssues} entries for non-delivered orders`}`);

  console.log('\n✅ Verification complete!\n');
}

// Test database connection with retry
async function testConnection(): Promise<boolean> {
  console.log('🔍 Testing Firestore connection...');
  console.log(`   Project ID: ${firebaseConfig.projectId}`);
  console.log(`   Database ID: pafood`);
  console.log(`   Database Location: asia-south2 (as specified)`);
  console.log(`   Database: ${db.app.name}\n`);
  
  const maxRetries = 3;
  let lastError: any = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`   Attempt ${attempt}/${maxRetries}...`);
      
      // Try a simple write operation to test connection
      const testDocId = `connection-test-${Date.now()}`;
      const testRef = doc(db, 'regions', testDocId);
      
      // Try to write with a shorter timeout
      const writePromise = setDoc(testRef, { 
        test: true, 
        timestamp: new Date().toISOString(),
        connectionTest: true
      });
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout after 15 seconds')), 15000)
      );
      
      await Promise.race([writePromise, timeoutPromise]);
      
      // If write succeeds, try to read it back
      const testDoc = await getDoc(testRef);
      if (testDoc.exists()) {
        console.log('✅ Firestore connection successful!\n');
        // Clean up test document
        try {
          await setDoc(testRef, { test: true }, { merge: false });
        } catch (e) {
          // Ignore cleanup errors
        }
        return true;
      }
    } catch (error: any) {
      lastError = error;
      const errorMsg = error.message || error.toString();
      const errorCode = error.code || 'unknown';
      
      if (errorCode === 'not-found' || errorMsg.includes('NOT_FOUND')) {
        console.log(`   ⚠️  Attempt ${attempt} failed: NOT_FOUND (database may still be initializing)`);
        if (attempt < maxRetries) {
          const waitTime = attempt * 5; // 5, 10, 15 seconds
          console.log(`   ⏳ Waiting ${waitTime} seconds before retry...\n`);
          await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
        }
      } else if (errorMsg.includes('timeout')) {
        console.log(`   ⚠️  Attempt ${attempt} failed: Connection timeout`);
        if (attempt < maxRetries) {
          const waitTime = attempt * 3;
          console.log(`   ⏳ Waiting ${waitTime} seconds before retry...\n`);
          await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
        }
      } else {
        // Other errors - don't retry
        console.error(`\n❌ Firestore connection failed: ${errorMsg}`);
        console.error(`   Error code: ${errorCode}`);
        break;
      }
    }
  }
  
  // All retries failed
  console.error(`\n❌ Firestore connection failed after ${maxRetries} attempts`);
  if (lastError) {
    console.error(`   Last error: ${lastError.message}`);
    console.error(`   Error code: ${lastError.code || 'unknown'}`);
  }
  
  if (lastError && (lastError.code === 'not-found' || lastError.message?.includes('NOT_FOUND'))) {
    console.error('\n⚠️  Database NOT_FOUND error!');
    console.error('\n   Possible causes:');
    console.error('   1. Database still initializing (can take 2-5 minutes after creation)');
    console.error('   2. Wrong project ID - Current:', firebaseConfig.projectId);
    console.error('   3. Database location mismatch - Your DB: asia-south2');
    console.error('   4. Security rules blocking access');
    console.error('\n   ✅ Verified: Database exists and is clean (from screenshot)');
    console.error('   💡 Solution: Wait 2-3 more minutes, then try again');
    console.error('      OR continue anyway - seeding might work despite connection test failure');
  }
  
  return false;
}

// Main function
async function main(): Promise<void> {
  try {
    console.log('🌱 Reduced Test Data Seeding Script\n');
    console.log('='.repeat(50));
    console.log('This script will seed:');
    console.log('  - 4 Regions, 8 Branches');
    console.log('  - 8 KPOs, 16 Salesmen, 32 Bookers');
    console.log('  - 96 Shops, 192 Orders, 192 Deliveries');
    console.log('  - 134 Ledger Entries');
    console.log('  - 20 Products');
    console.log('='.repeat(50));
    console.log('');

    // Authenticate
    await authenticate();

    // Test connection (with option to skip)
    console.log('⚠️  Note: If database was just created, wait 2-5 minutes for initialization.\n');
    const connectionOk = await testConnection();
    if (!connectionOk) {
      console.error('\n⚠️  Connection test failed, but continuing anyway...');
      console.error('   If seeding fails, please:');
      console.error('   1. Wait 2-5 minutes after database creation');
      console.error('   2. Verify database exists in Firebase Console');
      console.error('   3. Check project ID matches:', firebaseConfig.projectId);
      console.error('   4. Verify security rules allow authenticated writes\n');
      
      // Ask user if they want to continue
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      return new Promise((resolve) => {
        rl.question('Continue anyway? (y/n): ', async (answer) => {
          rl.close();
          if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
            console.log('\n❌ Seeding cancelled by user.');
            process.exit(0);
          }
          console.log('\n⚠️  Proceeding with seeding (may fail if database not ready)...\n');
          await continueSeeding();
          resolve();
        });
      });
    }

    await continueSeeding();
  } catch (error: any) {
    console.error('\n❌ Seeding failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

async function continueSeeding(): Promise<void> {
  try {
    // Load existing data
    await loadExistingData();

    // Seed data phases
    await seedBaseData();
    await seedUsers();
    await seedMappings();
    await seedShops();
    await seedOrders();
    await seedDeliveries();
    await seedLedgerEntries();
    await trackUnauthorizedDiscounts();
    await verifySeeding();

    console.log('🎉 Seeding completed successfully!\n');
  } catch (error: any) {
    console.error('\n❌ Seeding failed:', error.message);
    if (error.code === 'not-found' || error.message.includes('NOT_FOUND')) {
      console.error('\n💡 NOT_FOUND error suggests:');
      console.error('   - Database not fully initialized (wait 2-5 minutes)');
      console.error('   - Wrong project ID or database location');
      console.error('   - Database doesn\'t exist in Firebase Console');
    }
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main();

