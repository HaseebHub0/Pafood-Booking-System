/**
 * Firebase Seed Script
 * Run this script to populate Firebase with initial data
 * 
 * Usage: npx ts-node scripts/seedFirebase.ts
 * OR: Add to package.json scripts and run: npm run seed:firebase
 */

import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

// Firebase config - Update with your config
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'your-api-key',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'your-project.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'your-project-id',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'your-project.appspot.com',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '123456789',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || 'your-app-id',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Sample Users
const sampleUsers = [
  {
    email: 'booker@pafood.com',
    password: 'password123',
    userData: {
      name: 'Test Booker',
      role: 'booker',
      maxDiscountPercent: 10,
      maxDiscountAmount: 5000,
      phone: '+92 300 1234567',
      status: 'active',
    },
  },
  {
    email: 'salesman@pafood.com',
    password: 'password123',
    userData: {
      name: 'Test Salesman',
      role: 'salesman',
      phone: '+92 300 7654321',
      status: 'active',
    },
  },
  {
    email: 'admin@pafood.com',
    password: 'admin123',
    userData: {
      name: 'Admin User',
      role: 'admin',
      isSuperAdmin: true,
      phone: '+92 300 1111111',
      status: 'active',
    },
  },
  {
    email: 'kpo@pafood.com',
    password: 'kpo123',
    userData: {
      name: 'KPO User',
      role: 'kpo',
      phone: '+92 300 2222222',
      status: 'active',
    },
  },
];

// Sample Products
const sampleProducts = [
  {
    id: 'product-1',
    nameEn: 'Basmati Rice',
    name: 'بسمتی چاول',
    sku: 'RICE-001',
    category: 'rice',
    price: 2500,
    unit: 'Kg',
    maxDiscount: 5,
    isActive: true,
    stock: 1000,
  },
  {
    id: 'product-2',
    nameEn: 'Cooking Oil',
    name: 'ککنگ آئل',
    sku: 'OIL-001',
    category: 'oil',
    price: 450,
    unit: 'Litre',
    maxDiscount: 3,
    isActive: true,
    stock: 500,
  },
  {
    id: 'product-3',
    nameEn: 'Wheat Flour',
    name: 'گندم کا آٹا',
    sku: 'FLOUR-001',
    category: 'flour',
    price: 120,
    unit: 'Kg',
    maxDiscount: 2,
    isActive: true,
    stock: 2000,
  },
  {
    id: 'product-4',
    nameEn: 'Sugar',
    name: 'چینی',
    sku: 'SUGAR-001',
    category: 'beverages',
    price: 180,
    unit: 'Kg',
    maxDiscount: 2,
    isActive: true,
    stock: 1500,
  },
  {
    id: 'product-5',
    nameEn: 'Red Chilli Powder',
    name: 'لال مرچ پاؤڈر',
    sku: 'SPICE-001',
    category: 'spices',
    price: 350,
    unit: 'Kg',
    maxDiscount: 5,
    isActive: true,
    stock: 300,
  },
  {
    id: 'product-6',
    nameEn: 'Turmeric Powder',
    name: 'ہلدی پاؤڈر',
    sku: 'SPICE-002',
    category: 'spices',
    price: 400,
    unit: 'Kg',
    maxDiscount: 5,
    isActive: true,
    stock: 250,
  },
  {
    id: 'product-7',
    nameEn: 'Cumin Seeds',
    name: 'زیرہ',
    sku: 'SPICE-003',
    category: 'spices',
    price: 1200,
    unit: 'Kg',
    maxDiscount: 5,
    isActive: true,
    stock: 150,
  },
  {
    id: 'product-8',
    nameEn: 'Black Pepper',
    name: 'کالی مرچ',
    sku: 'SPICE-004',
    category: 'spices',
    price: 800,
    unit: 'Kg',
    maxDiscount: 5,
    isActive: true,
    stock: 200,
  },
];

async function createUsers() {
  console.log('📝 Creating users...');
  
  for (const userInfo of sampleUsers) {
    try {
      // Create auth user
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        userInfo.email,
        userInfo.password
      );
      
      const userId = userCredential.user.uid;
      
      // Create user document in Firestore
      const userDoc = {
        id: userId,
        email: userInfo.email,
        ...userInfo.userData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        syncStatus: 'synced',
      };
      
      await setDoc(doc(db, 'users', userId), userDoc);
      console.log(`✅ Created user: ${userInfo.email} (${userInfo.userData.role})`);
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        console.log(`⚠️  User already exists: ${userInfo.email}`);
      } else {
        console.error(`❌ Error creating user ${userInfo.email}:`, error.message);
      }
    }
  }
}

async function createProducts() {
  console.log('📦 Creating products...');
  
  for (const product of sampleProducts) {
    try {
      const productDoc = {
        ...product,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        syncStatus: 'synced',
      };
      
      await setDoc(doc(db, 'products', product.id), productDoc);
      console.log(`✅ Created product: ${product.nameEn}`);
    } catch (error: any) {
      console.error(`❌ Error creating product ${product.nameEn}:`, error.message);
    }
  }
}

async function seedFirebase() {
  console.log('🚀 Starting Firebase seed...\n');
  
  try {
    await createUsers();
    console.log('');
    await createProducts();
    console.log('\n✅ Firebase seed completed successfully!');
    console.log('\n📋 Test Credentials:');
    console.log('   Booker: booker@pafood.com / password123');
    console.log('   Salesman: salesman@pafood.com / password123');
    console.log('   Admin: admin@pafood.com / admin123');
    console.log('   KPO: kpo@pafood.com / kpo123');
  } catch (error) {
    console.error('❌ Error seeding Firebase:', error);
    process.exit(1);
  }
}

// Run seed
seedFirebase();

