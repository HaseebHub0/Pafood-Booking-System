/**
 * Migration Script: Add regionId to existing data
 * 
 * This script helps migrate existing data to include regionId fields.
 * Run this after creating regions and assigning them to users.
 * 
 * Usage:
 *   npm run migrate:regions
 *   OR
 *   ts-node scripts/migrateRegions.ts
 */

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';

// Firebase config - same as in your app
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
const db = getFirestore(app);

interface User {
  id: string;
  regionId?: string;
  role: string;
}

interface Shop {
  id: string;
  bookerId: string;
  regionId?: string;
}

interface Order {
  id: string;
  bookerId: string;
  regionId?: string;
}

async function migrateRegions() {
  console.log('🚀 Starting region migration...\n');

  try {
    // Step 1: Get all users
    console.log('📋 Step 1: Loading users...');
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const users: User[] = [];
    usersSnapshot.forEach((doc) => {
      users.push({ id: doc.id, ...doc.data() } as User);
    });
    console.log(`   Found ${users.length} users\n`);

    // Step 2: Check users without regionId
    const usersWithoutRegion = users.filter(u => !u.regionId);
    if (usersWithoutRegion.length > 0) {
      console.log(`⚠️  WARNING: ${usersWithoutRegion.length} users don't have regionId assigned:`);
      usersWithoutRegion.forEach(u => {
        console.log(`   - ${u.id} (${u.role}): ${(u as any).name || (u as any).email}`);
      });
      console.log('\n   Please assign regions to these users first using the dashboard.\n');
      console.log('   Migration cannot proceed without region assignments.\n');
      return;
    }
    console.log('✅ All users have regionId assigned\n');

    // Step 3: Migrate shops - inherit regionId from booker
    console.log('📋 Step 2: Migrating shops...');
    const shopsSnapshot = await getDocs(collection(db, 'shops'));
    let shopsUpdated = 0;
    let shopsSkipped = 0;

    for (const shopDoc of shopsSnapshot.docs) {
      const shop = { id: shopDoc.id, ...shopDoc.data() } as Shop;
      
      if (shop.regionId) {
        shopsSkipped++;
        continue;
      }

      // Find booker and get their regionId
      const booker = users.find(u => u.id === shop.bookerId);
      if (booker && booker.regionId) {
        await updateDoc(doc(db, 'shops', shop.id), {
          regionId: booker.regionId,
          updatedAt: new Date().toISOString(),
        });
        shopsUpdated++;
        console.log(`   ✓ Updated shop ${shop.id} with regionId: ${booker.regionId}`);
      } else {
        console.log(`   ⚠️  Shop ${shop.id} has booker ${shop.bookerId} without regionId - skipped`);
      }
    }
    console.log(`   ✅ Updated ${shopsUpdated} shops, skipped ${shopsSkipped} (already had regionId)\n`);

    // Step 4: Migrate orders - inherit regionId from booker
    console.log('📋 Step 3: Migrating orders...');
    const ordersSnapshot = await getDocs(collection(db, 'orders'));
    let ordersUpdated = 0;
    let ordersSkipped = 0;

    for (const orderDoc of ordersSnapshot.docs) {
      const order = { id: orderDoc.id, ...orderDoc.data() } as Order;
      
      if (order.regionId) {
        ordersSkipped++;
        continue;
      }

      // Find booker and get their regionId
      const booker = users.find(u => u.id === order.bookerId);
      if (booker && booker.regionId) {
        await updateDoc(doc(db, 'orders', order.id), {
          regionId: booker.regionId,
          updatedAt: new Date().toISOString(),
        });
        ordersUpdated++;
        console.log(`   ✓ Updated order ${order.id} with regionId: ${booker.regionId}`);
      } else {
        console.log(`   ⚠️  Order ${order.id} has booker ${order.bookerId} without regionId - skipped`);
      }
    }
    console.log(`   ✅ Updated ${ordersUpdated} orders, skipped ${ordersSkipped} (already had regionId)\n`);

    // Step 5: Migrate deliveries - inherit regionId from order
    console.log('📋 Step 4: Migrating deliveries...');
    const deliveriesSnapshot = await getDocs(collection(db, 'deliveries'));
    let deliveriesUpdated = 0;
    let deliveriesSkipped = 0;

    for (const deliveryDoc of deliveriesSnapshot.docs) {
      const delivery = { id: deliveryDoc.id, ...deliveryDoc.data() } as any;
      
      if (delivery.regionId) {
        deliveriesSkipped++;
        continue;
      }

      // Get order to find regionId
      if (delivery.orderId) {
        const orderDoc = await getDocs(query(collection(db, 'orders'), where('__name__', '==', delivery.orderId)));
        if (!orderDoc.empty) {
          const order = orderDoc.docs[0].data() as Order;
          if (order.regionId) {
            await updateDoc(doc(db, 'deliveries', delivery.id), {
              regionId: order.regionId,
              updatedAt: new Date().toISOString(),
            });
            deliveriesUpdated++;
            console.log(`   ✓ Updated delivery ${delivery.id} with regionId: ${order.regionId}`);
            continue;
          }
        }
      }
      console.log(`   ⚠️  Delivery ${delivery.id} has no orderId or order has no regionId - skipped`);
    }
    console.log(`   ✅ Updated ${deliveriesUpdated} deliveries, skipped ${deliveriesSkipped} (already had regionId)\n`);

    console.log('🎉 Migration completed successfully!\n');
    console.log('Summary:');
    console.log(`   - Shops: ${shopsUpdated} updated`);
    console.log(`   - Orders: ${ordersUpdated} updated`);
    console.log(`   - Deliveries: ${deliveriesUpdated} updated`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
if (require.main === module) {
  migrateRegions()
    .then(() => {
      console.log('\n✅ Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration script failed:', error);
      process.exit(1);
    });
}

export { migrateRegions };

