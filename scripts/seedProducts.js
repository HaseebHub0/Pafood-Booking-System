/**
 * Firebase Products Seed Script
 * Adds products to Firebase without affecting existing users/regions
 * 
 * Usage: node scripts/seedProducts.js
 */

const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
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

// Products data
const PRODUCTS = [
  // Nimco Products
  { name: 'چپس نمکین', nameEn: 'Salted Chips', sku: 'NIMCO-001', category: 'nimco', unit: 'Pcs', price: 50, maxDiscount: 5, image: 'https://via.placeholder.com/200?text=Chips' },
  { name: 'چپس چلی', nameEn: 'Chili Chips', sku: 'NIMCO-002', category: 'nimco', unit: 'Pcs', price: 50, maxDiscount: 5, image: 'https://via.placeholder.com/200?text=Chili+Chips' },
  { name: 'نمکو', nameEn: 'Nimco', sku: 'NIMCO-003', category: 'nimco', unit: 'Pcs', price: 30, maxDiscount: 5, image: 'https://via.placeholder.com/200?text=Nimco' },
  { name: 'کریکرز', nameEn: 'Crackers', sku: 'NIMCO-004', category: 'nimco', unit: 'Pcs', price: 40, maxDiscount: 5, image: 'https://via.placeholder.com/200?text=Crackers' },
  
  // Snacks
  { name: 'بسکٹ', nameEn: 'Biscuits', sku: 'SNACK-001', category: 'snacks', unit: 'Pcs', price: 100, maxDiscount: 5, image: 'https://via.placeholder.com/200?text=Biscuits' },
  { name: 'کیک', nameEn: 'Cake', sku: 'SNACK-002', category: 'snacks', unit: 'Pcs', price: 150, maxDiscount: 5, image: 'https://via.placeholder.com/200?text=Cake' },
  { name: 'چاکلیٹ', nameEn: 'Chocolate', sku: 'SNACK-003', category: 'snacks', unit: 'Pcs', price: 80, maxDiscount: 5, image: 'https://via.placeholder.com/200?text=Chocolate' },
  
  // Peanuts
  { name: 'مونگ پھلی نمکین', nameEn: 'Salted Peanuts', sku: 'PEANUT-001', category: 'peanuts', unit: '250 Gram', price: 200, maxDiscount: 5, image: 'https://via.placeholder.com/200?text=Peanuts' },
  { name: 'مونگ پھلی میٹھی', nameEn: 'Sweet Peanuts', sku: 'PEANUT-002', category: 'peanuts', unit: '250 Gram', price: 220, maxDiscount: 5, image: 'https://via.placeholder.com/200?text=Sweet+Peanuts' },
  { name: 'مونگ پھلی مصالحہ', nameEn: 'Spiced Peanuts', sku: 'PEANUT-003', category: 'peanuts', unit: '250 Gram', price: 210, maxDiscount: 5, image: 'https://via.placeholder.com/200?text=Spiced+Peanuts' },
  
  // Sweets
  { name: 'مٹھائی', nameEn: 'Sweets', sku: 'SWEET-001', category: 'sweets', unit: '1 Kg', price: 800, maxDiscount: 5, image: 'https://via.placeholder.com/200?text=Sweets' },
  { name: 'لڈو', nameEn: 'Ladoo', sku: 'SWEET-002', category: 'sweets', unit: '1 Kg', price: 700, maxDiscount: 5, image: 'https://via.placeholder.com/200?text=Ladoo' },
  { name: 'برفی', nameEn: 'Barfi', sku: 'SWEET-003', category: 'sweets', unit: '1 Kg', price: 900, maxDiscount: 5, image: 'https://via.placeholder.com/200?text=Barfi' },
  
  // Bulk Items
  { name: 'چاول بسمتی', nameEn: 'Basmati Rice', sku: 'BULK-001', category: 'bulk', unit: '5 Kg', price: 2500, maxDiscount: 3, image: 'https://via.placeholder.com/200?text=Rice' },
  { name: 'چینی', nameEn: 'Sugar', sku: 'BULK-002', category: 'bulk', unit: '5 Kg', price: 900, maxDiscount: 3, image: 'https://via.placeholder.com/200?text=Sugar' },
  { name: 'آٹا', nameEn: 'Flour', sku: 'BULK-003', category: 'bulk', unit: '5 Kg', price: 600, maxDiscount: 3, image: 'https://via.placeholder.com/200?text=Flour' },
  { name: 'تیل', nameEn: 'Cooking Oil', sku: 'BULK-004', category: 'bulk', unit: '5 Litre', price: 2250, maxDiscount: 3, image: 'https://via.placeholder.com/200?text=Oil' },
  { name: 'دال چنا', nameEn: 'Chana Dal', sku: 'BULK-005', category: 'bulk', unit: '1 Kg', price: 350, maxDiscount: 3, image: 'https://via.placeholder.com/200?text=Dal' },
  { name: 'دال ماش', nameEn: 'Moong Dal', sku: 'BULK-006', category: 'bulk', unit: '1 Kg', price: 400, maxDiscount: 3, image: 'https://via.placeholder.com/200?text=Moong+Dal' },
  
  // Other
  { name: 'چائے', nameEn: 'Tea', sku: 'OTHER-001', category: 'other', unit: '250 Gram', price: 300, maxDiscount: 5, image: 'https://via.placeholder.com/200?text=Tea' },
  { name: 'کافی', nameEn: 'Coffee', sku: 'OTHER-002', category: 'other', unit: '200 Gram', price: 500, maxDiscount: 5, image: 'https://via.placeholder.com/200?text=Coffee' },
  { name: 'مصالحے', nameEn: 'Spices Mix', sku: 'OTHER-003', category: 'other', unit: '250 Gram', price: 250, maxDiscount: 5, image: 'https://via.placeholder.com/200?text=Spices' }
];

/**
 * Authenticate with Firebase
 */
async function authenticate() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve, reject) => {
    console.log('🔐 Authentication required for product seeding.\n');
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

/**
 * Check if product already exists
 */
async function productExists(productId) {
  try {
    const productDoc = await getDoc(doc(db, 'products', productId));
    return productDoc.exists();
  } catch (error) {
    return false;
  }
}

/**
 * Create product
 */
async function createProduct(productData, index) {
  const productId = `product-${index + 1}`;
  
  // Check if product already exists
  const exists = await productExists(productId);
  if (exists) {
    console.log(`  ⚠️  Product already exists: ${productData.nameEn} (${productData.sku}) - Skipping`);
    return null;
  }

  const productDoc = {
    id: productId,
    name: productData.name,
    nameEn: productData.nameEn,
    sku: productData.sku,
    category: productData.category,
    unit: productData.unit,
    price: productData.price,
    maxDiscount: productData.maxDiscount,
    image: productData.image,
    isActive: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    syncStatus: 'synced'
  };

  await setDoc(doc(db, 'products', productId), productDoc);
  console.log(`  ✓ Created product: ${productData.nameEn} (${productData.sku})`);
  return productId;
}

/**
 * Main seeding function
 */
async function seedProducts() {
  console.log('🚀 Starting Products Seed...\n');

  // Authenticate first
  try {
    await authenticate();
  } catch (error) {
    console.log('\n❌ Cannot proceed without authentication.');
    process.exit(1);
  }

  console.log(`📋 Will create/check ${PRODUCTS.length} products\n`);

  const startTime = Date.now();
  let createdCount = 0;
  let skippedCount = 0;

  // Create products
  console.log('📦 Processing products...\n');
  for (let i = 0; i < PRODUCTS.length; i++) {
    const result = await createProduct(PRODUCTS[i], i);
    if (result) {
      createdCount++;
    } else {
      skippedCount++;
    }
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  console.log('\n' + '='.repeat(50));
  console.log('✅ Products seeding completed!');
  console.log(`⏱️  Time taken: ${duration}s`);
  console.log('\n📋 Summary:');
  console.log(`   - ${createdCount} Products created`);
  if (skippedCount > 0) {
    console.log(`   - ${skippedCount} Products already exist (skipped)`);
  }
  console.log(`   - ${PRODUCTS.length} Total products in database`);
  console.log('='.repeat(50));
}

// Run seed
seedProducts()
  .then(() => {
    console.log('\n✅ All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });

