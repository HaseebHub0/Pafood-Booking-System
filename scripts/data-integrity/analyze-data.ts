/**
 * Data Analysis Script - Read-Only
 * 
 * Analyzes Firestore data to identify:
 * - Duplicate SALE entries per orderId
 * - Missing critical fields in ledger entries
 * - Duplicate deliveries per orderId
 * 
 * Usage: npx ts-node scripts/data-integrity/analyze-data.ts
 */

import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import * as readline from 'readline';
import { FIREBASE_CONFIG, CONFIG, AnalysisReport, LedgerEntry, Delivery, DuplicateSale, MissingFieldsEntry, DuplicateDelivery } from './config';

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
    console.log('💡 Note: Authentication is optional for read-only analysis.');
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
          console.log('   (Remember to revert after analysis!)\n');
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
 * Analyze ledger transactions for duplicates and missing fields
 */
async function analyzeLedgerTransactions(): Promise<{
  duplicateSales: DuplicateSale[];
  missingFields: MissingFieldsEntry[];
  statistics: any;
}> {
  console.log('📊 Analyzing ledger transactions...\n');

  const ledgerRef = collection(db, CONFIG.COLLECTIONS.LEDGER);
  const snapshot = await getDocs(ledgerRef);
  
  const allEntries: LedgerEntry[] = [];
  snapshot.forEach((doc) => {
    allEntries.push(normalizeLedgerEntry(doc));
  });

  console.log(`   Found ${allEntries.length} total ledger entries`);

  // Group by order_id and type
  const saleEntriesByOrder = new Map<string, LedgerEntry[]>();
  const returnEntriesByOrder = new Map<string, LedgerEntry[]>();
  const missingFieldsEntries: MissingFieldsEntry[] = [];

  for (const entry of allEntries) {
    const orderId = entry.order_id;
    const type = entry.type;

    // Check for missing critical fields
    const missingFields: string[] = [];
    if (!orderId && (type === 'SALE_DELIVERED' || type === 'SALE')) {
      missingFields.push('order_id');
    }
    if (!entry.region_id) {
      missingFields.push('region_id');
    }
    if (!entry.branch_id && entry.branch_id !== undefined) {
      // branch_id is optional, but if it's explicitly undefined/null, note it
      // Only flag if we expect it but it's missing
    }

    if (missingFields.length > 0) {
      missingFieldsEntries.push({
        ledgerId: entry.id,
        orderId: orderId || 'MISSING',
        orderNumber: entry.order_number,
        type: type || 'UNKNOWN',
        missingFields,
        net_cash: entry.net_cash || 0,
      });
    }

    // Group SALE entries by orderId
    if ((type === 'SALE_DELIVERED' || type === 'SALE') && orderId) {
      if (!saleEntriesByOrder.has(orderId)) {
        saleEntriesByOrder.set(orderId, []);
      }
      saleEntriesByOrder.get(orderId)!.push(entry);
    }

    // Group RETURN entries (for statistics)
    if (type === 'RETURN' && orderId) {
      if (!returnEntriesByOrder.has(orderId)) {
        returnEntriesByOrder.set(orderId, []);
      }
      returnEntriesByOrder.get(orderId)!.push(entry);
    }
  }

  // Find duplicate SALE entries
  const duplicateSales: DuplicateSale[] = [];
  
  for (const [orderId, entries] of saleEntriesByOrder.entries()) {
    if (entries.length > 1) {
      // Sort by created_at (earliest first)
      entries.sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return aTime - bTime;
      });

      const keepEntry = entries[0];
      const deleteEntries = entries.slice(1);

      duplicateSales.push({
        orderId,
        orderNumber: entries[0].order_number,
        entries: entries.map(e => ({
          ledgerId: e.id,
          createdAt: e.created_at || 'UNKNOWN',
          net_cash: e.net_cash || 0,
          region_id: e.region_id,
          branch_id: e.branch_id,
          hasCompleteFields: !!(e.region_id && (e.branch_id !== undefined || !e.branch_id)),
        })),
        keepEntry: keepEntry.id,
        deleteEntries: deleteEntries.map(e => e.id),
      });
    }
  }

  // Check for incomplete entries that should be deleted if complete ones exist
  for (const duplicate of duplicateSales) {
    const hasComplete = duplicate.entries.some(e => e.hasCompleteFields);
    const hasIncomplete = duplicate.entries.some(e => !e.hasCompleteFields);
    
    if (hasComplete && hasIncomplete) {
      // Mark incomplete entries for deletion even if they're earlier
      const incompleteEntries = duplicate.entries.filter(e => !e.hasCompleteFields);
      const completeEntries = duplicate.entries.filter(e => e.hasCompleteFields);
      
      if (completeEntries.length > 0) {
        // Keep earliest complete entry, delete incomplete ones
        completeEntries.sort((a, b) => {
          const aTime = new Date(a.createdAt).getTime();
          const bTime = new Date(b.createdAt).getTime();
          return aTime - bTime;
        });
        
        // Find the entry object for the earliest complete entry
        const earliestComplete = completeEntries[0];
        duplicate.keepEntry = earliestComplete.ledgerId;
        
        // Delete all incomplete entries and other complete entries
        duplicate.deleteEntries = [
          ...incompleteEntries.map(e => e.ledgerId),
          ...completeEntries.slice(1).map(e => e.ledgerId),
        ];
      }
    }
  }

  const statistics = {
    totalLedgerEntries: allEntries.length,
    totalSaleEntries: Array.from(saleEntriesByOrder.values()).flat().length,
    totalReturnEntries: Array.from(returnEntriesByOrder.values()).flat().length,
    duplicateSaleOrders: duplicateSales.length,
    missingFieldEntries: missingFieldsEntries.length,
  };

  console.log(`   Found ${statistics.totalSaleEntries} SALE entries`);
  console.log(`   Found ${statistics.totalReturnEntries} RETURN entries`);
  console.log(`   Found ${duplicateSales.length} orders with duplicate SALE entries`);
  console.log(`   Found ${missingFieldsEntries.length} entries with missing critical fields\n`);

  return {
    duplicateSales,
    missingFields: missingFieldsEntries,
    statistics,
  };
}

/**
 * Analyze deliveries for duplicates
 */
async function analyzeDeliveries(): Promise<{
  duplicateDeliveries: DuplicateDelivery[];
  statistics: any;
}> {
  console.log('📦 Analyzing deliveries...\n');

  const deliveriesRef = collection(db, CONFIG.COLLECTIONS.DELIVERIES);
  const snapshot = await getDocs(deliveriesRef);
  
  const allDeliveries: Delivery[] = [];
  snapshot.forEach((doc) => {
    allDeliveries.push(normalizeDelivery(doc));
  });

  console.log(`   Found ${allDeliveries.length} total deliveries`);

  // Group by orderId
  const deliveriesByOrder = new Map<string, Delivery[]>();
  
  for (const delivery of allDeliveries) {
    if (!delivery.orderId) {
      console.warn(`   ⚠️  Delivery ${delivery.id} has no orderId`);
      continue;
    }

    if (!deliveriesByOrder.has(delivery.orderId)) {
      deliveriesByOrder.set(delivery.orderId, []);
    }
    deliveriesByOrder.get(delivery.orderId)!.push(delivery);
  }

  // Find duplicate deliveries
  const duplicateDeliveries: DuplicateDelivery[] = [];
  
  for (const [orderId, deliveries] of deliveriesByOrder.entries()) {
    if (deliveries.length > 1) {
      // Prefer 'delivered' status, otherwise earliest
      const delivered = deliveries.find(d => d.status === 'delivered');
      
      let keepDelivery: Delivery;
      let deleteDeliveries: Delivery[];
      
      if (delivered) {
        keepDelivery = delivered;
        deleteDeliveries = deliveries.filter(d => d.id !== delivered.id);
      } else {
        // Sort by createdAt (earliest first)
        deliveries.sort((a, b) => {
          const aTime = new Date(a.createdAt).getTime();
          const bTime = new Date(b.createdAt).getTime();
          return aTime - bTime;
        });
        
        keepDelivery = deliveries[0];
        deleteDeliveries = deliveries.slice(1);
      }

      duplicateDeliveries.push({
        orderId,
        orderNumber: deliveries[0].orderNumber,
        deliveries: deliveries.map(d => ({
          deliveryId: d.id,
          status: d.status,
          createdAt: d.createdAt,
        })),
        keepDelivery: keepDelivery.id,
        deleteDeliveries: deleteDeliveries.map(d => d.id),
      });
    }
  }

  const statistics = {
    totalDeliveries: allDeliveries.length,
    duplicateDeliveryOrders: duplicateDeliveries.length,
  };

  console.log(`   Found ${duplicateDeliveries.length} orders with duplicate deliveries\n`);

  return {
    duplicateDeliveries,
    statistics,
  };
}

/**
 * Generate and save analysis report
 */
async function generateAnalysisReport(
  ledgerIssues: any,
  deliveryIssues: any
): Promise<string> {
  const report: AnalysisReport = {
    timestamp: new Date().toISOString(),
    ledgerIssues,
    deliveryIssues,
  };

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `analysis-report-${timestamp}.json`;
  const filepath = path.join(process.cwd(), filename);

  fs.writeFileSync(filepath, JSON.stringify(report, null, 2));

  return filepath;
}

/**
 * Main analysis function
 */
async function main() {
  console.log('='.repeat(60));
  console.log('🔍 Firestore Data Analysis (Read-Only)');
  console.log('='.repeat(60));
  console.log('');

  // Optional authentication
  await authenticate();

  try {
    // Analyze ledger transactions
    const ledgerIssues = await analyzeLedgerTransactions();

    // Analyze deliveries
    const deliveryIssues = await analyzeDeliveries();

    // Generate report
    const reportPath = await generateAnalysisReport(ledgerIssues, deliveryIssues);

    // Console summary
    console.log('='.repeat(60));
    console.log('📋 Analysis Summary');
    console.log('='.repeat(60));
    console.log('');
    console.log('Ledger Issues:');
    console.log(`  • Duplicate SALE entries: ${ledgerIssues.duplicateSales.length} orders`);
    console.log(`  • Missing field entries: ${ledgerIssues.missingFields.length} entries`);
    console.log('');
    console.log('Delivery Issues:');
    console.log(`  • Duplicate deliveries: ${deliveryIssues.duplicateDeliveries.length} orders`);
    console.log('');
    console.log(`✅ Analysis complete! Report saved to: ${reportPath}`);
    console.log('');
    console.log('⚠️  Review the report before running cleanup script.');
    console.log('='.repeat(60));

  } catch (error: any) {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  }
}

// Run analysis
main();

