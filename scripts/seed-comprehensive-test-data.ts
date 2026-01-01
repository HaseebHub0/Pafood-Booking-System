/**
 * Comprehensive Test Data Seed Script
 * 
 * Seeds complete test data for stress-testing:
 * - 4 Regions, 8 Branches
 * - 8 KPOs, 24 Salesmen, 72 Bookers
 * - 720 Shops, 2160 Orders, 2160 Deliveries
 * - 1512 Ledger Entries (SALE_DELIVERED)
 * - Unauthorized discount scenarios
 * 
 * Usage: npx tsx scripts/seed-comprehensive-test-data.ts
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
const db = getFirestore(app);

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
    { first: 'Kamran', last: 'Bhatti' },
    { first: 'Waseem', last: 'Siddiqui' },
    { first: 'Asif', last: 'Ahmed' },
    { first: 'Javed', last: 'Hassan' },
    { first: 'Naeem', last: 'Malik' },
    { first: 'Saeed', last: 'Sheikh' },
    { first: 'Khalid', last: 'Iqbal' },
    { first: 'Tahir', last: 'Raza' },
    { first: 'Yasir', last: 'Khan' },
    { first: 'Zubair', last: 'Butt' },
    { first: 'Fahad', last: 'Rana' },
    { first: 'Adnan', last: 'Chaudhry' },
    { first: 'Bilal', last: 'Khan' },
    { first: 'Hamza', last: 'Yousaf' },
    { first: 'Saad', last: 'Akram' },
    { first: 'Umar', last: 'Nawaz' },
    { first: 'Ali', last: 'Qureshi' },
    { first: 'Hassan', last: 'Hashmi' },
    { first: 'Usman', last: 'Abbasi' },
    { first: 'Ahmad', last: 'Mirza' },
    { first: 'Zain', last: 'Bhatti' },
    { first: 'Faisal', last: 'Siddiqui' },
    { first: 'Tariq', last: 'Ahmed' },
    { first: 'Nadeem', last: 'Hassan' },
    { first: 'Shahid', last: 'Malik' },
    { first: 'Imran', last: 'Sheikh' },
    { first: 'Kamran', last: 'Iqbal' },
    { first: 'Waseem', last: 'Raza' },
    { first: 'Asif', last: 'Khan' },
    { first: 'Javed', last: 'Butt' },
    { first: 'Naeem', last: 'Rana' },
    { first: 'Saeed', last: 'Chaudhry' },
    { first: 'Khalid', last: 'Yousaf' },
    { first: 'Tahir', last: 'Akram' },
    { first: 'Yasir', last: 'Nawaz' },
    { first: 'Zubair', last: 'Qureshi' },
    { first: 'Fahad', last: 'Hashmi' }
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
    { first: 'Qasim', last: 'Rana' },
    { first: 'Rashid', last: 'Chaudhry' },
    { first: 'Sajjad', last: 'Yousaf' },
    { first: 'Tahir', last: 'Akram' },
    { first: 'Umar', last: 'Nawaz' },
    { first: 'Vaqar', last: 'Qureshi' },
    { first: 'Waqas', last: 'Hashmi' },
    { first: 'Yasir', last: 'Abbasi' },
    { first: 'Zahid', last: 'Mirza' }
  ]
};

// Regions
const REGIONS = [
  { name: 'Peshawar', code: 'PSH' },
  { name: 'Sindh', code: 'SND' },
  { name: 'Multan', code: 'MLT' },
  { name: 'Lahore', code: 'LHR' }
];

// Pakistani product names
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
  { name: 'بادام', nameEn: 'Almond', category: 'peanuts', price: 1500, maxDiscount: 5 },
  { name: 'کشمش', nameEn: 'Raisins', category: 'sweets', price: 600, maxDiscount: 5 },
  { name: 'خشک میوہ', nameEn: 'Dry Fruits', category: 'other', price: 2000, maxDiscount: 10 },
  { name: 'سوپ', nameEn: 'Soup', category: 'other', price: 180, maxDiscount: 5 },
  { name: 'نوڈلز', nameEn: 'Noodles', category: 'snacks', price: 90, maxDiscount: 5 },
  { name: 'مکئی', nameEn: 'Corn', category: 'bulk', price: 220, maxDiscount: 10 },
  { name: 'گندم', nameEn: 'Wheat', category: 'bulk', price: 300, maxDiscount: 10 },
  { name: 'جو', nameEn: 'Barley', category: 'bulk', price: 250, maxDiscount: 10 },
  { name: 'جوار', nameEn: 'Sorghum', category: 'bulk', price: 200, maxDiscount: 10 },
  { name: 'باجرہ', nameEn: 'Millet', category: 'bulk', price: 180, maxDiscount: 10 }
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

// Authentication
async function authenticate(): Promise<void> {
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
        } catch (error: any) {
          console.error(`\n❌ Authentication failed: ${error.message}`);
          reject(error);
        }
      });
    });
  });
}

// Load existing data to avoid duplicates
async function loadExistingData(): Promise<void> {
  console.log('📥 Checking for existing data...\n');

  // Load existing regions
  const regionsSnapshot = await getDocs(collection(db, 'regions'));
  if (!regionsSnapshot.empty) {
    regionsSnapshot.forEach(doc => {
      const data = doc.data();
      seedData.regions.push({ id: doc.id, name: data.name, code: data.code });
    });
    console.log(`  ✓ Found ${seedData.regions.length} existing regions`);
  }

  // Load existing branches
  const branchesSnapshot = await getDocs(collection(db, 'branches'));
  if (!branchesSnapshot.empty) {
    branchesSnapshot.forEach(doc => {
      const data = doc.data();
      seedData.branches.push({ id: doc.id, name: data.name, code: data.code, regionId: data.regionId });
    });
    console.log(`  ✓ Found ${seedData.branches.length} existing branches`);
  }

  // Load existing products
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
  }

  // Load existing users
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
  }

  // Load existing mappings
  const mappingsSnapshot = await getDocs(collection(db, 'mappings'));
  if (!mappingsSnapshot.empty) {
    mappingsSnapshot.forEach(doc => {
      const data = doc.data();
      seedData.mappings.push({ salesmanId: data.salesmanId, bookerIds: data.bookerIds || [] });
    });
    console.log(`  ✓ Found ${seedData.mappings.length} existing mappings`);
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
  let branchIndex = 0;
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
      branchIndex++;
    }
  }
  console.log(`  ✓ Branches: ${seedData.branches.length} total`);

  // Seed Products (only if not exists)
  console.log('  Creating products...');
  for (let i = 0; i < PRODUCTS.length; i++) {
    const product = PRODUCTS[i];
    const existing = seedData.products.find(p => p.nameEn === product.nameEn);
    
    if (existing) {
      console.log(`    ⚠️  Product ${product.nameEn} already exists, skipping`);
      continue;
    }

    const productId = uuidv4();
    const sku = `SKU-${String(i + 1).padStart(4, '0')}`;
    
    await setDoc(doc(db, 'products', productId), {
      id: productId,
      name: product.name,
      nameEn: product.nameEn,
      sku: sku,
      category: product.category,
      unit: 'Pcs',
      price: product.price,
      maxDiscount: product.maxDiscount,
      image: '',
      isActive: true
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

// Phase 2: Users (KPOs, Bookers, Salesmen)
async function seedUsers(): Promise<void> {
  console.log('👥 Phase 2: Seeding users (KPOs, Bookers, Salesmen)...\n');

  let nameIndex = { kpo: 0, booker: 0, salesman: 0 };
  let phoneIndex = 1;

  // Seed KPOs (1 per branch)
  console.log('  Creating KPOs...');
  for (const branch of seedData.branches) {
    const region = seedData.regions.find(r => r.id === branch.regionId)!;
    const nameData = PAKISTANI_NAMES.kpo[nameIndex.kpo % PAKISTANI_NAMES.kpo.length];
    const name = `${nameData.first} ${nameData.last}`;
    const email = `kpo.${branch.code.toLowerCase()}@pafood.test`;
    
    // Check if user already exists
    const existingKPO = seedData.kpos.find(k => k.email === email);
    if (existingKPO) {
      console.log(`    ⚠️  KPO ${email} already exists, skipping`);
      nameIndex.kpo++;
      continue;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, DEFAULT_PASSWORD);
      const userId = userCredential.user.uid;
      
      await setDoc(doc(db, 'users', userId), {
        id: userId,
        email: email,
        name: name,
        phone: generatePhone(phoneIndex++),
        role: 'kpo',
        level: 'manager',
        maxDiscountPercent: 15,
        maxDiscountAmount: 10000,
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
      
      seedData.kpos.push({ id: userId, email, name, regionId: branch.regionId, branchId: branch.id });
      nameIndex.kpo++;
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        console.log(`    ⚠️  KPO ${email} already exists in Auth, skipping`);
        // Try to find existing user in Firestore
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

  // Seed Salesmen (3 per branch)
  console.log('  Creating salesmen...');
  for (const branch of seedData.branches) {
    for (let i = 0; i < 3; i++) {
      const nameData = PAKISTANI_NAMES.salesman[nameIndex.salesman % PAKISTANI_NAMES.salesman.length];
      const name = `${nameData.first} ${nameData.last}`;
      const email = `salesman.${branch.code.toLowerCase()}.${i + 1}@pafood.test`;
      
      // Check if user already exists
      const existingSalesman = seedData.salesmen.find(s => s.email === email);
      if (existingSalesman) {
        console.log(`    ⚠️  Salesman ${email} already exists, skipping`);
        nameIndex.salesman++;
        continue;
      }

      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, DEFAULT_PASSWORD);
        const userId = userCredential.user.uid;
        
        await setDoc(doc(db, 'users', userId), {
          id: userId,
          email: email,
          name: name,
          phone: generatePhone(phoneIndex++),
          role: 'salesman',
          level: 'senior',
          maxDiscountPercent: 10,
          maxDiscountAmount: 5000,
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
          // Try to find existing user in Firestore
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

  // Seed Bookers (9 per branch)
  console.log('  Creating bookers...');
  for (const branch of seedData.branches) {
    for (let i = 0; i < 9; i++) {
      const nameData = PAKISTANI_NAMES.booker[nameIndex.booker % PAKISTANI_NAMES.booker.length];
      const name = `${nameData.first} ${nameData.last}`;
      const email = `booker.${branch.code.toLowerCase()}.${i + 1}@pafood.test`;
      const maxDiscountPercent = randomChoice([5, 10, 15]);
      const maxDiscountAmount = randomInt(1000, 5000);
      const level = randomChoice(['junior', 'senior', 'manager']);
      
      // Check if user already exists
      const existingBooker = seedData.bookers.find(b => b.email === email);
      if (existingBooker) {
        console.log(`    ⚠️  Booker ${email} already exists, skipping`);
        nameIndex.booker++;
        continue;
      }

      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, DEFAULT_PASSWORD);
        const userId = userCredential.user.uid;
        
        await setDoc(doc(db, 'users', userId), {
          id: userId,
          email: email,
          name: name,
          phone: generatePhone(phoneIndex++),
          role: 'booker',
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
          // Try to find existing user in Firestore
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
    
    // Assign exactly 3 bookers to each salesman
    for (let i = 0; i < 3; i++) {
      if (bookerIndex < seedData.bookers.length) {
        const booker = seedData.bookers[bookerIndex];
        bookerIds.push(booker.id);
        bookerNames.push(booker.name);
        bookerIndex++;
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
    
    for (let i = 0; i < 10; i++) {
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
        console.log(`  → Shops: ${shopCounter}/720`);
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

  const year = new Date().getFullYear();
  let orderCounter = 0;
  let batch: any[] = [];
  const unauthorizedOrderIds: string[] = [];

  for (const shop of seedData.shops) {
    const booker = seedData.bookers.find(b => b.id === shop.bookerId)!;
    const salesman = seedData.mappings.find(m => m.bookerIds.includes(booker.id));
    const salesmanData = salesman ? seedData.salesmen.find(s => s.id === salesman.salesmanId) : null;

    for (let i = 0; i < 3; i++) {
      const orderId = uuidv4();
      const orderNumber = `ORD-${year}-${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}`;
      
      // Status distribution: 70% delivered, 20% submitted, 10% draft
      let status: 'draft' | 'submitted' | 'delivered';
      const rand = Math.random();
      if (rand < 0.7) status = 'delivered';
      else if (rand < 0.9) status = 'submitted';
      else status = 'draft';

      // Create order items (2-5 products)
      const numItems = randomInt(2, 5);
      const selectedProducts = [];
      for (let j = 0; j < numItems; j++) {
        selectedProducts.push(randomChoice(seedData.products));
      }

      const items: any[] = [];
      let subtotal = 0;
      let totalDiscount = 0;
      let allowedDiscount = 0;
      let unauthorizedDiscount = 0;
      let hasUnauthorized = false;

      // Determine if this order should have unauthorized discount (30% chance)
      const shouldHaveUnauthorized = Math.random() < 0.3;
      let unauthorizedType: 'item' | 'order' | 'both' = 'item';

      if (shouldHaveUnauthorized) {
        unauthorizedOrderIds.push(orderId);
        unauthorizedType = randomChoice(['item', 'order', 'both']);
      }

      for (const product of selectedProducts) {
        const quantity = randomInt(1, 10);
        const unitPrice = product.price;
        const lineTotal = quantity * unitPrice;

        // Calculate discount
        let discountPercent = randomFloat(0, 25);
        const effectiveMaxDiscount = Math.min(product.maxDiscount, booker.maxDiscountPercent);
        
        // Apply unauthorized discount if needed
        if (shouldHaveUnauthorized && (unauthorizedType === 'item' || unauthorizedType === 'both')) {
          discountPercent = effectiveMaxDiscount + randomFloat(1, 10); // Exceed limit
        }

        const discountAmount = lineTotal * (discountPercent / 100);
        const maxAllowedAmount = lineTotal * (effectiveMaxDiscount / 100);
        const isUnauthorizedDiscount = discountPercent > effectiveMaxDiscount;
        const unauthorizedAmount = isUnauthorizedDiscount ? discountAmount - maxAllowedAmount : 0;
        const finalAmount = lineTotal - discountAmount;

        items.push({
          id: uuidv4(),
          productId: product.id,
          productName: product.nameEn,
          productNameUrdu: product.name,
          quantity: quantity,
          unitPrice: unitPrice,
          unit: 'Pcs',
          discountPercent: Math.round(discountPercent * 100) / 100,
          lineTotal: lineTotal,
          discountAmount: Math.round(discountAmount * 100) / 100,
          finalAmount: Math.round(finalAmount * 100) / 100,
          maxAllowedDiscount: effectiveMaxDiscount,
          isUnauthorizedDiscount: isUnauthorizedDiscount,
          unauthorizedAmount: Math.round(unauthorizedAmount * 100) / 100
        });

        subtotal += lineTotal;
        totalDiscount += discountAmount;
        allowedDiscount += Math.min(discountAmount, maxAllowedAmount);
        unauthorizedDiscount += unauthorizedAmount;
        if (isUnauthorizedDiscount) hasUnauthorized = true;
      }

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
        // Scale up items
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
        // Scale down items
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
      
      // Add order-level unauthorized if applicable
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
        salesmanId: salesmanData?.id || undefined,
        salesmanName: salesmanData?.name || undefined,
        regionId: booker.regionId,
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
      orderCounter++;

      if (batch.length >= BATCH_SIZE) {
        const b = writeBatch(db);
        batch.forEach(({ ref, data }) => b.set(ref, data));
        await b.commit();
        console.log(`  → Orders: ${orderCounter}/2160`);
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
  let failedCount = 0;

  for (const order of seedData.orders) {
    const shop = seedData.shops.find(s => s.id === order.shopId)!;
    const salesman = order.salesmanId ? seedData.salesmen.find(s => s.id === order.salesmanId) : null;

    // Delivery status based on order status
    let deliveryStatus: 'pending' | 'delivered' | 'failed';
    if (order.status === 'delivered') {
      // 50-100 failed deliveries for testing
      if (failedCount < 100 && Math.random() < 0.05) {
        deliveryStatus = 'failed';
        failedCount++;
      } else {
        deliveryStatus = 'delivered';
      }
    } else {
      deliveryStatus = 'pending';
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
    if (deliveryStatus === 'delivered') {
      deliveryData.paymentAmount = order.grandTotal;
    }
    if (deliveryStatus === 'failed') {
      deliveryData.failureReason = 'shop_closed' as const;
      deliveryData.failureNotes = 'Shop was closed during delivery attempt';
    }

    batch.push({ ref: doc(db, 'deliveries', deliveryData.id), data: deliveryData });
    seedData.deliveries.push(deliveryData);
    deliveryCounter++;

    if (batch.length >= BATCH_SIZE) {
      const b = writeBatch(db);
      batch.forEach(({ ref, data }) => b.set(ref, data));
      await b.commit();
      console.log(`  → Deliveries: ${deliveryCounter}/2160`);
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

// Phase 7: Ledger Entries (SALE_DELIVERED)
async function seedLedgerEntries(): Promise<void> {
  console.log('💰 Phase 7: Seeding ledger entries (SALE_DELIVERED)...\n');

  let ledgerCounter = 0;
  let batch: any[] = [];

  // Only create ledger entries for delivered orders
  const deliveredOrders = seedData.orders.filter(o => o.status === 'delivered');

  for (const order of deliveredOrders) {
    const delivery = seedData.deliveries.find(d => d.orderId === order.id);
    if (!delivery || delivery.status !== 'delivered') continue;

    const ledgerId = uuidv4();
    const branch = seedData.branches.find(b => b.regionId === order.regionId);

    const ledgerData = {
      id: ledgerId,
      ledger_id: ledgerId,
      created_at: delivery.deliveredAt || delivery.createdAt,
      region_id: order.regionId,
      branch_id: branch?.id || undefined,
      party_id: order.shopId,
      order_id: order.id, // MANDATORY for SALE_DELIVERED
      type: 'SALE_DELIVERED' as const,
      gross_amount: Math.round(order.subtotal * 100) / 100,
      discount_allowed: Math.round(order.allowedDiscount * 100) / 100,
      discount_given: Math.round(order.totalDiscount * 100) / 100,
      unauthorized_discount: Math.round(order.unauthorizedDiscount * 100) / 100,
      net_cash: Math.round(order.grandTotal * 100) / 100,
      created_by: order.bookerId,
      order_number: order.orderNumber,
      shopId: order.shopId, // Legacy field
      shopName: order.shopName, // Legacy field
      createdAt: delivery.deliveredAt || delivery.createdAt,
      updatedAt: delivery.deliveredAt || delivery.createdAt,
      syncStatus: 'synced' as const
    };

    batch.push({ ref: doc(db, 'ledger_transactions', ledgerId), data: ledgerData });
    seedData.ledgerEntries.push(ledgerData);
    ledgerCounter++;

    if (batch.length >= BATCH_SIZE) {
      const b = writeBatch(db);
      batch.forEach(({ ref, data }) => b.set(ref, data));
      await b.commit();
      console.log(`  → Ledger entries: ${ledgerCounter}/1512`);
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

// Phase 8: Unauthorized Discount Tracking
async function trackUnauthorizedDiscounts(): Promise<void> {
  console.log('📊 Phase 8: Tracking unauthorized discounts...\n');

  // Group orders by booker and month
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

  // Duplicate checks
  const orderIds = new Set<string>();
  const deliveryOrderIds = new Set<string>();
  const ledgerOrderIds = new Set<string>();
  const duplicateDeliveries: string[] = [];
  const duplicateLedger: string[] = [];

  ordersSnapshot.forEach(doc => {
    const orderId = doc.id;
    if (orderIds.has(orderId)) {
      verification.duplicates.duplicateOrders = (verification.duplicates.duplicateOrders || 0) + 1;
    }
    orderIds.add(orderId);
  });

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

  verification.duplicates.duplicateDeliveries = duplicateDeliveries.length;
  verification.duplicates.duplicateLedgerEntries = duplicateLedger.length;

  // Relationship checks
  const mappingsSnapshot = await getDocs(collection(db, 'mappings'));
  let mappingsWith3Bookers = 0;
  let bookersWithSalesman = 0;
  const bookerSalesmanMap = new Map<string, string>();

  mappingsSnapshot.forEach(doc => {
    const data = doc.data();
    if (data.bookerIds && data.bookerIds.length === 3) {
      mappingsWith3Bookers++;
    }
    if (data.bookerIds) {
      data.bookerIds.forEach((bookerId: string) => {
        bookerSalesmanMap.set(bookerId, data.salesmanId);
        bookersWithSalesman++;
      });
    }
  });

  verification.relationships.mappingsWith3Bookers = mappingsWith3Bookers;
  verification.relationships.totalMappings = mappingsSnapshot.size;
  verification.relationships.bookersWithSalesman = bookersWithSalesman;

  // Data integrity
  let ordersWithDelivery = 0;
  let deliveredOrdersWithLedger = 0;

  ordersSnapshot.forEach(orderDoc => {
    const order = orderDoc.data();
    const hasDelivery = deliveryOrderIds.has(orderDoc.id);
    if (hasDelivery) ordersWithDelivery++;

    if (order.status === 'delivered') {
      const hasLedger = ledgerOrderIds.has(orderDoc.id);
      if (hasLedger) deliveredOrdersWithLedger++;
    }
  });

  verification.integrity.ordersWithDelivery = ordersWithDelivery;
  verification.integrity.deliveredOrdersWithLedger = deliveredOrdersWithLedger;

  // Output report
  console.log('📋 Verification Report:');
  console.log('  Counts:');
  console.log(`    Orders: ${verification.counts.orders} (expected: 2160) ${verification.counts.orders === 2160 ? '✓' : '✗'}`);
  console.log(`    Deliveries: ${verification.counts.deliveries} (expected: 2160) ${verification.counts.deliveries === 2160 ? '✓' : '✗'}`);
  console.log(`    Ledger Entries: ${verification.counts.ledgerEntries} (expected: 1512) ${verification.counts.ledgerEntries === 1512 ? '✓' : '✗'}`);
  console.log('  Duplicates:');
  console.log(`    Duplicate Deliveries: ${verification.duplicates.duplicateDeliveries} (expected: 0) ${verification.duplicates.duplicateDeliveries === 0 ? '✓' : '✗'}`);
  console.log(`    Duplicate Ledger Entries: ${verification.duplicates.duplicateLedgerEntries} (expected: 0) ${verification.duplicates.duplicateLedgerEntries === 0 ? '✓' : '✗'}`);
  console.log('  Relationships:');
  console.log(`    Mappings with 3 bookers: ${verification.relationships.mappingsWith3Bookers} (expected: 24) ${verification.relationships.mappingsWith3Bookers === 24 ? '✓' : '✗'}`);
  console.log(`    Bookers with salesman: ${verification.relationships.bookersWithSalesman} (expected: 72) ${verification.relationships.bookersWithSalesman === 72 ? '✓' : '✗'}`);
  console.log('  Integrity:');
  console.log(`    Orders with delivery: ${verification.integrity.ordersWithDelivery} (expected: 2160) ${verification.integrity.ordersWithDelivery === 2160 ? '✓' : '✗'}`);
  console.log(`    Delivered orders with ledger: ${verification.integrity.deliveredOrdersWithLedger} (expected: 1512) ${verification.integrity.deliveredOrdersWithLedger === 1512 ? '✓' : '✗'}`);
  console.log('');

  const allPassed = 
    verification.counts.orders === 2160 &&
    verification.counts.deliveries === 2160 &&
    verification.counts.ledgerEntries === 1512 &&
    verification.duplicates.duplicateDeliveries === 0 &&
    verification.duplicates.duplicateLedgerEntries === 0 &&
    verification.relationships.mappingsWith3Bookers === 24 &&
    verification.relationships.bookersWithSalesman === 72 &&
    verification.integrity.ordersWithDelivery === 2160 &&
    verification.integrity.deliveredOrdersWithLedger === 1512;

  if (allPassed) {
    console.log('✅ All verification checks passed!\n');
  } else {
    console.log('⚠️  Some verification checks failed. Please review the report above.\n');
  }
}

// Main function
async function main() {
  console.log('='.repeat(60));
  console.log('🌱 Comprehensive Test Data Seeding');
  console.log('='.repeat(60));
  console.log('');

  try {
    await authenticate();
  } catch (error) {
    console.log('\n❌ Cannot proceed without authentication.');
    process.exit(1);
  }

  const startTime = Date.now();

  try {
    // Load existing data first to avoid duplicates
    await loadExistingData();
    
    await seedBaseData();
    await seedUsers();
    await seedMappings();
    await seedShops();
    await seedOrders();
    await seedDeliveries();
    await seedLedgerEntries();
    await trackUnauthorizedDiscounts();
    await verifySeeding();

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('='.repeat(60));
    console.log('✅ Seeding completed!');
    console.log(`⏱️  Time taken: ${duration}s`);
    console.log('='.repeat(60));
    console.log('\n📊 Summary:');
    console.log(`  - Regions: ${seedData.regions.length}`);
    console.log(`  - Branches: ${seedData.branches.length}`);
    console.log(`  - Products: ${seedData.products.length}`);
    console.log(`  - KPOs: ${seedData.kpos.length}`);
    console.log(`  - Salesmen: ${seedData.salesmen.length}`);
    console.log(`  - Bookers: ${seedData.bookers.length}`);
    console.log(`  - Mappings: ${seedData.mappings.length}`);
    console.log(`  - Shops: ${seedData.shops.length}`);
    console.log(`  - Orders: ${seedData.orders.length}`);
    console.log(`  - Deliveries: ${seedData.deliveries.length}`);
    console.log(`  - Ledger Entries: ${seedData.ledgerEntries.length}`);
    console.log('');

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Fatal error during seeding:', error);
    process.exit(1);
  }
}

main();

