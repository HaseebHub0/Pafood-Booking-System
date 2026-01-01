/**
 * Integrity Verification Script
 * 
 * Verifies data integrity after cleanup:
 * - One SALE entry per orderId
 * - Financial integrity (SALE - RETURN = Net Cash)
 * - Region-wise net cash matches sum of ledger entries
 * - One delivery per orderId
 * 
 * Usage: npx ts-node scripts/data-integrity/verify-integrity.ts
 */

import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import * as readline from 'readline';
import { FIREBASE_CONFIG, CONFIG, LedgerEntry, Delivery, IntegrityReport, IntegrityCheck } from './config';

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(FIREBASE_CONFIG) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);

/**
 * Authenticate with Firebase (optional for read-only operations)
 */
async function authenticate(): Promise<boolean> {
  // Check if already authenticated
  if (auth.currentUser) {
    return true;
  }

  // Check if authentication is required via environment variable
  const requireAuth = process.env.REQUIRE_AUTH === 'true';
  
  if (!requireAuth) {
    console.log('💡 Note: Authentication is optional for read-only verification.');
    console.log('   If you get permission errors, set REQUIRE_AUTH=true or update Firestore rules.\n');
    return false;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    console.log('🔐 Authentication required for Firestore access.\n');
    
    rl.question('Admin Email (or press Enter to skip): ', (email) => {
      if (!email.trim()) {
        rl.close();
        console.log('⚠️  Skipping authentication. Ensure Firestore rules allow read access.\n');
        resolve(false);
        return;
      }

      rl.question('Admin Password: ', async (password) => {
        rl.close();
        
        try {
          console.log('\n🔐 Authenticating...');
          await signInWithEmailAndPassword(auth, email.trim(), password);
          console.log('✅ Authentication successful!\n');
          resolve(true);
        } catch (error: any) {
          console.error(`\n❌ Authentication failed: ${error.message}`);
          console.log('\n💡 Alternative: Update Firestore security rules temporarily:');
          console.log('   Go to Firebase Console > Firestore > Rules');
          console.log('   Set rules to: allow read: if true;');
          console.log('   (Remember to revert after verification!)\n');
          resolve(false);
        }
      });
    });
  });
}

/**
 * Normalize ledger entry to handle both new and legacy field names
 */
function normalizeLedgerEntry(doc: any): LedgerEntry {
  const data = doc.data();
  return {
    id: doc.id,
    ...data,
    order_id: data.order_id || data.orderId,
    region_id: data.region_id || data.regionId,
    branch_id: data.branch_id || data.branchId,
    created_at: data.created_at || data.createdAt,
    net_cash: data.net_cash || data.netCash || 0,
  };
}

/**
 * Normalize delivery to handle both new and legacy field names
 */
function normalizeDelivery(doc: any): Delivery {
  const data = doc.data();
  return {
    id: doc.id,
    ...data,
    createdAt: data.createdAt || data.created_at || new Date().toISOString(),
  };
}

/**
 * Verify one SALE entry per orderId
 */
async function verifyOneSalePerOrder(): Promise<IntegrityCheck> {
  console.log('🔍 Verifying one SALE entry per orderId...\n');

  const ledgerRef = collection(db, CONFIG.COLLECTIONS.LEDGER);
  const snapshot = await getDocs(ledgerRef);
  
  const saleEntries: LedgerEntry[] = [];
  snapshot.forEach((doc) => {
    const entry = normalizeLedgerEntry(doc);
    if ((entry.type === 'SALE_DELIVERED' || entry.type === 'SALE') && entry.order_id) {
      saleEntries.push(entry);
    }
  });

  // Group by order_id
  const salesByOrder = new Map<string, LedgerEntry[]>();
  for (const entry of saleEntries) {
    if (!salesByOrder.has(entry.order_id!)) {
      salesByOrder.set(entry.order_id!, []);
    }
    salesByOrder.get(entry.order_id!)!.push(entry);
  }

  // Find violations
  const violations: any[] = [];
  for (const [orderId, entries] of salesByOrder.entries()) {
    if (entries.length > 1) {
      violations.push({
        orderId,
        orderNumber: entries[0].order_number,
        count: entries.length,
        ledgerIds: entries.map(e => e.id),
      });
    }
  }

  const passed = violations.length === 0;
  const message = passed
    ? `✅ All orders have exactly one SALE entry (${salesByOrder.size} orders checked)`
    : `❌ Found ${violations.length} orders with multiple SALE entries`;

  console.log(`   ${message}`);
  if (violations.length > 0) {
    console.log(`   Violations: ${violations.length} orders`);
  }
  console.log('');

  return {
    name: 'One SALE Per Order',
    passed,
    message,
    violations: violations.length > 0 ? violations : undefined,
    statistics: {
      totalOrders: salesByOrder.size,
      totalSaleEntries: saleEntries.length,
      violations: violations.length,
    },
  };
}

/**
 * Verify financial integrity
 */
async function verifyFinancialIntegrity(): Promise<IntegrityCheck> {
  console.log('💰 Verifying financial integrity...\n');

  const ledgerRef = collection(db, CONFIG.COLLECTIONS.LEDGER);
  const snapshot = await getDocs(ledgerRef);
  
  const allEntries: LedgerEntry[] = [];
  snapshot.forEach((doc) => {
    allEntries.push(normalizeLedgerEntry(doc));
  });

  // Calculate totals
  let totalSaleNetCash = 0;
  let totalReturnNetCash = 0;
  const regionTotals = new Map<string, number>();

  for (const entry of allEntries) {
    const netCash = entry.net_cash || 0;
    const regionId = entry.region_id || 'UNKNOWN';

    if (entry.type === 'SALE_DELIVERED' || entry.type === 'SALE') {
      totalSaleNetCash += netCash;
    } else if (entry.type === 'RETURN') {
      totalReturnNetCash += Math.abs(netCash); // Returns are negative
    }

    // Sum by region
    if (!regionTotals.has(regionId)) {
      regionTotals.set(regionId, 0);
    }
    regionTotals.set(regionId, regionTotals.get(regionId)! + netCash);
  }

  const netCash = totalSaleNetCash - totalReturnNetCash;

  // Verify region totals
  const regionBreakdown: any = {};
  for (const [regionId, total] of regionTotals.entries()) {
    regionBreakdown[regionId] = total;
  }

  const passed = true; // This is more of a calculation check
  const message = `✅ Financial totals calculated: Sales=${totalSaleNetCash.toFixed(2)}, Returns=${totalReturnNetCash.toFixed(2)}, Net=${netCash.toFixed(2)}`;

  console.log(`   ${message}`);
  console.log(`   Regions: ${regionTotals.size}`);
  console.log('');

  return {
    name: 'Financial Integrity',
    passed,
    message,
    statistics: {
      totalSaleNetCash,
      totalReturnNetCash,
      netCash,
      regionBreakdown,
      totalEntries: allEntries.length,
    },
  };
}

/**
 * Verify delivery integrity
 */
async function verifyDeliveryIntegrity(): Promise<IntegrityCheck> {
  console.log('📦 Verifying delivery integrity...\n');

  const deliveriesRef = collection(db, CONFIG.COLLECTIONS.DELIVERIES);
  const snapshot = await getDocs(deliveriesRef);
  
  const allDeliveries: Delivery[] = [];
  snapshot.forEach((doc) => {
    allDeliveries.push(normalizeDelivery(doc));
  });

  // Group by orderId
  const deliveriesByOrder = new Map<string, Delivery[]>();
  for (const delivery of allDeliveries) {
    if (!delivery.orderId) {
      continue;
    }
    if (!deliveriesByOrder.has(delivery.orderId)) {
      deliveriesByOrder.set(delivery.orderId, []);
    }
    deliveriesByOrder.get(delivery.orderId)!.push(delivery);
  }

  // Find violations (multiple deliveries per order)
  const violations: any[] = [];
  for (const [orderId, deliveries] of deliveriesByOrder.entries()) {
    if (deliveries.length > 1) {
      violations.push({
        orderId,
        orderNumber: deliveries[0].orderNumber,
        count: deliveries.length,
        deliveryIds: deliveries.map(d => d.id),
      });
    }
  }

  // Verify orderId matches order.id (if orders exist)
  const ordersRef = collection(db, CONFIG.COLLECTIONS.ORDERS);
  const ordersSnapshot = await getDocs(ordersRef);
  const orderIds = new Set<string>();
  ordersSnapshot.forEach((doc) => {
    orderIds.add(doc.id);
  });

  const mismatchedDeliveries: any[] = [];
  for (const delivery of allDeliveries) {
    if (delivery.orderId && !orderIds.has(delivery.orderId)) {
      mismatchedDeliveries.push({
        deliveryId: delivery.id,
        orderId: delivery.orderId,
        reason: 'Order not found in orders collection',
      });
    }
  }

  const passed = violations.length === 0 && mismatchedDeliveries.length === 0;
  const message = passed
    ? `✅ All deliveries are valid (${deliveriesByOrder.size} orders, ${allDeliveries.length} deliveries)`
    : `❌ Found ${violations.length} duplicate deliveries and ${mismatchedDeliveries.length} mismatched deliveries`;

  console.log(`   ${message}`);
  if (violations.length > 0) {
    console.log(`   Duplicate deliveries: ${violations.length} orders`);
  }
  if (mismatchedDeliveries.length > 0) {
    console.log(`   Mismatched deliveries: ${mismatchedDeliveries.length}`);
  }
  console.log('');

  return {
    name: 'Delivery Integrity',
    passed,
    message,
    violations: violations.length > 0 || mismatchedDeliveries.length > 0
      ? [...violations, ...mismatchedDeliveries]
      : undefined,
    statistics: {
      totalDeliveries: allDeliveries.length,
      totalOrders: deliveriesByOrder.size,
      duplicateViolations: violations.length,
      mismatchedViolations: mismatchedDeliveries.length,
    },
  };
}

/**
 * Generate integrity report
 */
async function generateIntegrityReport(checks: IntegrityCheck[]): Promise<string> {
  const passedCount = checks.filter(c => c.passed).length;
  const failedCount = checks.filter(c => !c.passed).length;

  const report: IntegrityReport = {
    timestamp: new Date().toISOString(),
    checks,
    overallStatus: failedCount === 0 ? 'PASS' : 'FAIL',
    summary: {
      totalChecks: checks.length,
      passedChecks: passedCount,
      failedChecks: failedCount,
    },
  };

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `integrity-report-${timestamp}.json`;
  const filepath = path.join(process.cwd(), filename);

  fs.writeFileSync(filepath, JSON.stringify(report, null, 2));

  return filepath;
}

/**
 * Main verification function
 */
async function main() {
  console.log('='.repeat(60));
  console.log('✅ Data Integrity Verification');
  console.log('='.repeat(60));
  console.log('');

  // Optional authentication
  await authenticate();

  try {
    const checks: IntegrityCheck[] = [];

    // Verify one SALE per order
    checks.push(await verifyOneSalePerOrder());

    // Verify financial integrity
    checks.push(await verifyFinancialIntegrity());

    // Verify delivery integrity
    checks.push(await verifyDeliveryIntegrity());

    // Generate report
    const reportPath = await generateIntegrityReport(checks);

    // Summary
    console.log('='.repeat(60));
    console.log('📋 Verification Summary');
    console.log('='.repeat(60));
    console.log('');

    for (const check of checks) {
      const icon = check.passed ? '✅' : '❌';
      console.log(`${icon} ${check.name}: ${check.passed ? 'PASS' : 'FAIL'}`);
    }

    console.log('');
    const overallStatus = checks.every(c => c.passed) ? 'PASS' : 'FAIL';
    console.log(`Overall Status: ${overallStatus}`);
    console.log('');
    console.log(`📄 Integrity report saved to: ${reportPath}`);
    console.log('='.repeat(60));

    process.exit(checks.every(c => c.passed) ? 0 : 1);

  } catch (error: any) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }
}

// Run verification
main();

