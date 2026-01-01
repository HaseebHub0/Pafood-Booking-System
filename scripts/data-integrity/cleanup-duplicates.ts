/**
 * Cleanup Duplicates Script
 * 
 * Safely removes duplicate ledger entries and deliveries based on analysis report.
 * 
 * Safety Features:
 * - DRY_RUN mode (default: enabled)
 * - Comprehensive logging
 * - Batch operations (max 500 per batch)
 * - Never deletes RETURN entries
 * - Always keeps earliest SALE entry
 * 
 * Usage:
 *   # Dry run (safe, no deletes)
 *   DRY_RUN=true npx ts-node scripts/data-integrity/cleanup-duplicates.ts
 *   
 *   # Actual cleanup (after review)
 *   DRY_RUN=false npx ts-node scripts/data-integrity/cleanup-duplicates.ts
 */

import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, doc, writeBatch, getDocs, query, where } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import * as readline from 'readline';
import { FIREBASE_CONFIG, CONFIG, AnalysisReport, CleanupLog, CleanupReport } from './config';

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(FIREBASE_CONFIG) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);

/**
 * Authenticate with Firebase (required for write operations)
 */
async function authenticate(): Promise<void> {
  // Check if already authenticated
  if (auth.currentUser) {
    return;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve, reject) => {
    console.log('🔐 Authentication required for cleanup operations.\n');
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
          console.log('\n💡 Alternative: Update Firestore security rules temporarily:');
          console.log('   Go to Firebase Console > Firestore > Rules');
          console.log('   Set rules to: allow read, write: if true;');
          console.log('   (Remember to revert after cleanup!)\n');
          reject(error);
        }
      });
    });
  });
}

const DRY_RUN = CONFIG.DRY_RUN;
const BATCH_SIZE = CONFIG.BATCH_SIZE;

/**
 * Find the most recent analysis report
 */
function findLatestAnalysisReport(): string | null {
  const files = fs.readdirSync(process.cwd())
    .filter(f => f.startsWith('analysis-report-') && f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) {
    return null;
  }

  return path.join(process.cwd(), files[0]);
}

/**
 * Cleanup duplicate SALE entries
 */
async function cleanupDuplicateSales(
  duplicateSales: any[],
  logs: CleanupLog[]
): Promise<{ deleted: number; kept: number }> {
  console.log(`\n💰 Cleaning up duplicate SALE entries...`);
  console.log(`   Found ${duplicateSales.length} orders with duplicates\n`);

  let deleted = 0;
  let kept = 0;
  let batchCount = 0;
  let currentBatch = writeBatch(db);
  let batchOps = 0;

  for (const duplicate of duplicateSales) {
    // Log what we're keeping
    logs.push({
      timestamp: new Date().toISOString(),
      operation: 'keep',
      collection: CONFIG.COLLECTIONS.LEDGER,
      documentId: duplicate.keepEntry,
      orderId: duplicate.orderId,
      reason: `Earliest SALE entry for order ${duplicate.orderId}`,
      net_cash: duplicate.entries.find((e: any) => e.ledgerId === duplicate.keepEntry)?.net_cash || 0,
      dryRun: DRY_RUN,
    });
    kept++;

    // Delete duplicates
    for (const deleteId of duplicate.deleteEntries) {
      const entry = duplicate.entries.find((e: any) => e.ledgerId === deleteId);
      const reason = entry?.hasCompleteFields === false
        ? `Incomplete SALE entry (missing fields) for order ${duplicate.orderId}`
        : `Duplicate SALE entry (later than earliest) for order ${duplicate.orderId}`;

      logs.push({
        timestamp: new Date().toISOString(),
        operation: 'delete',
        collection: CONFIG.COLLECTIONS.LEDGER,
        documentId: deleteId,
        orderId: duplicate.orderId,
        reason,
        net_cash: entry?.net_cash || 0,
        dryRun: DRY_RUN,
      });

      if (!DRY_RUN) {
        const docRef = doc(db, CONFIG.COLLECTIONS.LEDGER, deleteId);
        currentBatch.delete(docRef);
        batchOps++;

        if (batchOps >= BATCH_SIZE) {
          await currentBatch.commit();
          batchCount++;
          console.log(`   → Committed batch ${batchCount} (${batchOps} operations)`);
          currentBatch = writeBatch(db);
          batchOps = 0;
        }
      }

      deleted++;
    }

    if (duplicateSales.indexOf(duplicate) % 10 === 0 && duplicateSales.indexOf(duplicate) > 0) {
      console.log(`   Processed ${duplicateSales.indexOf(duplicate)}/${duplicateSales.length} orders...`);
    }
  }

  // Commit remaining batch
  if (!DRY_RUN && batchOps > 0) {
    await currentBatch.commit();
    batchCount++;
    console.log(`   → Committed final batch ${batchCount} (${batchOps} operations)`);
  }

  console.log(`   ✅ Kept: ${kept} entries`);
  console.log(`   ${DRY_RUN ? '📝 Would delete' : '🗑️  Deleted'}: ${deleted} duplicate entries`);

  return { deleted, kept };
}

/**
 * Cleanup duplicate deliveries
 */
async function cleanupDuplicateDeliveries(
  duplicateDeliveries: any[],
  logs: CleanupLog[]
): Promise<{ deleted: number; kept: number }> {
  console.log(`\n📦 Cleaning up duplicate deliveries...`);
  console.log(`   Found ${duplicateDeliveries.length} orders with duplicates\n`);

  let deleted = 0;
  let kept = 0;
  let batchCount = 0;
  let currentBatch = writeBatch(db);
  let batchOps = 0;

  for (const duplicate of duplicateDeliveries) {
    // Log what we're keeping
    const keepDelivery = duplicate.deliveries.find((d: any) => d.deliveryId === duplicate.keepDelivery);
    logs.push({
      timestamp: new Date().toISOString(),
      operation: 'keep',
      collection: CONFIG.COLLECTIONS.DELIVERIES,
      documentId: duplicate.keepDelivery,
      orderId: duplicate.orderId,
      reason: keepDelivery?.status === 'delivered'
        ? `Delivered delivery for order ${duplicate.orderId}`
        : `Earliest delivery for order ${duplicate.orderId}`,
      dryRun: DRY_RUN,
    });
    kept++;

    // Delete duplicates
    for (const deleteId of duplicate.deleteDeliveries) {
      logs.push({
        timestamp: new Date().toISOString(),
        operation: 'delete',
        collection: CONFIG.COLLECTIONS.DELIVERIES,
        documentId: deleteId,
        orderId: duplicate.orderId,
        reason: `Duplicate delivery for order ${duplicate.orderId}`,
        dryRun: DRY_RUN,
      });

      if (!DRY_RUN) {
        const docRef = doc(db, CONFIG.COLLECTIONS.DELIVERIES, deleteId);
        currentBatch.delete(docRef);
        batchOps++;

        if (batchOps >= BATCH_SIZE) {
          await currentBatch.commit();
          batchCount++;
          console.log(`   → Committed batch ${batchCount} (${batchOps} operations)`);
          currentBatch = writeBatch(db);
          batchOps = 0;
        }
      }

      deleted++;
    }

    if (duplicateDeliveries.indexOf(duplicate) % 10 === 0 && duplicateDeliveries.indexOf(duplicate) > 0) {
      console.log(`   Processed ${duplicateDeliveries.indexOf(duplicate)}/${duplicateDeliveries.length} orders...`);
    }
  }

  // Commit remaining batch
  if (!DRY_RUN && batchOps > 0) {
    await currentBatch.commit();
    batchCount++;
    console.log(`   → Committed final batch ${batchCount} (${batchOps} operations)`);
  }

  console.log(`   ✅ Kept: ${kept} deliveries`);
  console.log(`   ${DRY_RUN ? '📝 Would delete' : '🗑️  Deleted'}: ${deleted} duplicate deliveries`);

  return { deleted, kept };
}

/**
 * Execute cleanup based on analysis report
 */
async function executeCleanup() {
  console.log('='.repeat(60));
  console.log(DRY_RUN ? '🔍 Cleanup Dry Run (No Deletes)' : '🗑️  Cleanup Execution (DELETING DATA)');
  console.log('='.repeat(60));
  console.log('');

  // Authenticate (required for write operations)
  try {
    await authenticate();
  } catch (error) {
    console.log('\n❌ Cannot proceed without authentication.');
    process.exit(1);
  }

  if (DRY_RUN) {
    console.log('⚠️  DRY_RUN mode is ENABLED - no data will be deleted');
    console.log('   Set DRY_RUN=false to perform actual cleanup\n');
  } else {
    console.log('⚠️  WARNING: DRY_RUN is DISABLED - data will be DELETED');
    console.log('   This operation cannot be undone!\n');
  }

  // Find latest analysis report
  const reportPath = findLatestAnalysisReport();
  if (!reportPath) {
    console.error('❌ No analysis report found. Run analyze-data.ts first.');
    process.exit(1);
  }

  console.log(`📄 Loading analysis report: ${path.basename(reportPath)}\n`);

  const reportContent = fs.readFileSync(reportPath, 'utf-8');
  const report: AnalysisReport = JSON.parse(reportContent);

  const logs: CleanupLog[] = [];

  // Cleanup duplicate sales
  const salesResult = await cleanupDuplicateSales(
    report.ledgerIssues.duplicateSales,
    logs
  );

  // Cleanup duplicate deliveries
  const deliveriesResult = await cleanupDuplicateDeliveries(
    report.deliveryIssues.duplicateDeliveries,
    logs
  );

  // Generate cleanup report
  const cleanupReport: CleanupReport = {
    timestamp: new Date().toISOString(),
    dryRun: DRY_RUN,
    operations: logs,
    statistics: {
      totalDeletions: salesResult.deleted + deliveriesResult.deleted,
      totalKept: salesResult.kept + deliveriesResult.kept,
      ledgerDeletions: salesResult.deleted,
      deliveryDeletions: deliveriesResult.deleted,
    },
  };

  // Save cleanup log
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logFilename = `cleanup-${DRY_RUN ? 'dryrun' : 'executed'}-${timestamp}.json`;
  const logPath = path.join(process.cwd(), logFilename);
  fs.writeFileSync(logPath, JSON.stringify(cleanupReport, null, 2));

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(DRY_RUN ? '📝 Dry Run Summary' : '✅ Cleanup Summary');
  console.log('='.repeat(60));
  console.log('');
  console.log('Ledger Entries:');
  console.log(`  • Kept: ${salesResult.kept}`);
  console.log(`  • ${DRY_RUN ? 'Would delete' : 'Deleted'}: ${salesResult.deleted}`);
  console.log('');
  console.log('Deliveries:');
  console.log(`  • Kept: ${deliveriesResult.kept}`);
  console.log(`  • ${DRY_RUN ? 'Would delete' : 'Deleted'}: ${deliveriesResult.deleted}`);
  console.log('');
  console.log(`📄 Cleanup log saved to: ${logFilename}`);
  console.log('');

  if (DRY_RUN) {
    console.log('💡 Review the cleanup log. If satisfied, run with DRY_RUN=false');
  } else {
    console.log('✅ Cleanup completed! Run verify-integrity.ts to verify data integrity.');
  }

  console.log('='.repeat(60));
}

// Run cleanup
executeCleanup().catch((error) => {
  console.error('❌ Cleanup failed:', error);
  process.exit(1);
});

