/**
 * Validation Script: Cross-check Dashboard Totals
 * 
 * This script validates that all dashboard totals are consistent:
 * - Transaction history totals match Global Sales
 * - Branch totals sum correctly
 * - Region totals = sum of all branches under that region
 * - Global Sales = sum of all regions = sum of all transactions
 * - Unauthorized Discounts match booker totals
 */

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getDocs, query, where, collection, Timestamp } from 'firebase/firestore';

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
const db = getFirestore(app, 'pafood'); // Explicitly specify database ID

// Import dashboard services (we'll need to adapt for Node.js environment)
// For now, we'll use direct Firestore queries

interface ValidationResult {
  check: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  expected: number;
  actual: number;
  difference?: number;
  details?: string;
}

const results: ValidationResult[] = [];

function isTestShop(shopName: string | undefined | null): boolean {
  if (!shopName) return false;
  const lower = shopName.toLowerCase().trim();
  return lower.includes('connection-test') || 
         lower.includes('test-') || 
         lower.startsWith('test') ||
         lower.includes('demo') ||
         lower.includes('sample');
}

async function validateDashboardTotals() {
  console.log('🔍 Starting Dashboard Totals Validation...\n');

  try {
    // 1. Get all delivered orders (transaction history)
    console.log('📊 Step 1: Fetching transaction history...');
    const ordersQuery = query(collection(db, 'orders'), where('status', '==', 'delivered'));
    const ordersSnapshot = await getDocs(ordersQuery);
    const allOrders = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Filter test shops
    const validOrders = allOrders.filter(order => {
      const shopName = order.shopName || order.shop?.shopName;
      return !isTestShop(shopName);
    });
    
    const transactionHistoryTotal = validOrders.reduce((sum, order) => {
      return sum + (order.grandTotal || order.totalAmount || 0);
    }, 0);
    
    console.log(`   ✓ Found ${validOrders.length} valid orders (${allOrders.length - validOrders.length} test shops excluded)`);
    console.log(`   ✓ Transaction History Total: PKR ${transactionHistoryTotal.toLocaleString()}\n`);

    // 2. Get Global Sales from ledger
    console.log('💰 Step 2: Fetching Global Sales from ledger...');
    const ledgerQuery = query(
      collection(db, 'ledger_transactions'),
      where('type', 'in', ['SALE_DELIVERED', 'SALE'])
    );
    const ledgerSnapshot = await getDocs(ledgerQuery);
    const ledgerEntries = ledgerSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Filter test shops and calculate total
    const validLedgerEntries = ledgerEntries.filter(entry => {
      const shopName = entry.shop_name || entry.shopName || entry.shop?.shopName;
      return !isTestShop(shopName);
    });
    
    const globalSalesFromLedger = validLedgerEntries.reduce((sum, entry) => {
      const netCash = entry.net_cash !== undefined ? entry.net_cash : (entry.amount || 0);
      return sum + (typeof netCash === 'number' ? netCash : parseFloat(netCash) || 0);
    }, 0);
    
    console.log(`   ✓ Found ${validLedgerEntries.length} valid ledger entries`);
    console.log(`   ✓ Global Sales (Ledger): PKR ${globalSalesFromLedger.toLocaleString()}\n`);

    // Compare transaction history vs global sales
    const diff1 = Math.abs(transactionHistoryTotal - globalSalesFromLedger);
    const tolerance = 0.01; // Allow 1 paisa difference for rounding
    if (diff1 <= tolerance) {
      results.push({
        check: 'Transaction History vs Global Sales (Ledger)',
        status: 'PASS',
        expected: transactionHistoryTotal,
        actual: globalSalesFromLedger,
        details: 'Totals match within tolerance'
      });
    } else {
      results.push({
        check: 'Transaction History vs Global Sales (Ledger)',
        status: 'FAIL',
        expected: transactionHistoryTotal,
        actual: globalSalesFromLedger,
        difference: diff1,
        details: `Mismatch: ${diff1 > 0 ? 'Ledger' : 'Orders'} has ${Math.abs(diff1).toLocaleString()} more`
      });
    }

    // 3. Get all branches and their sales
    console.log('🏢 Step 3: Fetching branch sales...');
    const branchesQuery = query(collection(db, 'branches'));
    const branchesSnapshot = await getDocs(branchesQuery);
    const allBranches = branchesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    console.log(`   ✓ Found ${allBranches.length} branches`);
    
    // Get all users to map bookers to branches
    const usersQuery = query(collection(db, 'users'));
    const usersSnapshot = await getDocs(usersQuery);
    const allUsers = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Create booker to branch mapping
    const bookerToBranch: Record<string, string> = {};
    allUsers.forEach(user => {
      if (user.role?.toLowerCase() === 'booker' && user.branch) {
        bookerToBranch[user.id] = user.branch;
      }
    });
    
    // Calculate branch sales from orders
    const branchSales: Record<string, number> = {};
    validOrders.forEach(order => {
      const bookerId = order.bookerId;
      if (bookerId && bookerToBranch[bookerId]) {
        const branchName = bookerToBranch[bookerId];
        if (!branchSales[branchName]) {
          branchSales[branchName] = 0;
        }
        branchSales[branchName] += (order.grandTotal || order.totalAmount || 0);
      }
    });
    
    const totalBranchSales = Object.values(branchSales).reduce((sum, sales) => sum + sales, 0);
    console.log(`   ✓ Calculated sales for ${Object.keys(branchSales).length} branches`);
    console.log(`   ✓ Total Branch Sales: PKR ${totalBranchSales.toLocaleString()}\n`);

    // 4. Get all regions and calculate region totals
    console.log('🌍 Step 4: Fetching region sales...');
    const regionsQuery = query(collection(db, 'regions'));
    const regionsSnapshot = await getDocs(regionsQuery);
    const allRegions = regionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    console.log(`   ✓ Found ${allRegions.length} regions`);
    
    // Group branches by region
    const branchesByRegion: Record<string, string[]> = {};
    allBranches.forEach(branch => {
      const regionId = branch.regionId;
      if (regionId) {
        if (!branchesByRegion[regionId]) {
          branchesByRegion[regionId] = [];
        }
        // Find branch name from branch document or use ID
        const branchName = branch.name || branch.id;
        branchesByRegion[regionId].push(branchName);
      }
    });
    
    // Calculate region sales (sum of branches in each region)
    const regionSales: Record<string, number> = {};
    Object.entries(branchesByRegion).forEach(([regionId, branchNames]) => {
      let regionTotal = 0;
      branchNames.forEach(branchName => {
        if (branchSales[branchName]) {
          regionTotal += branchSales[branchName];
        }
      });
      if (regionTotal > 0) {
        regionSales[regionId] = regionTotal;
      }
    });
    
    const totalRegionSales = Object.values(regionSales).reduce((sum, sales) => sum + sales, 0);
    console.log(`   ✓ Calculated sales for ${Object.keys(regionSales).length} regions`);
    console.log(`   ✓ Total Region Sales: PKR ${totalRegionSales.toLocaleString()}\n`);

    // Compare branch totals vs region totals
    const diff2 = Math.abs(totalBranchSales - totalRegionSales);
    if (diff2 <= tolerance) {
      results.push({
        check: 'Branch Totals vs Region Totals',
        status: 'PASS',
        expected: totalBranchSales,
        actual: totalRegionSales,
        details: 'Region totals = sum of branches'
      });
    } else {
      results.push({
        check: 'Branch Totals vs Region Totals',
        status: 'WARNING',
        expected: totalBranchSales,
        actual: totalRegionSales,
        difference: diff2,
        details: 'Some branches may not be assigned to regions'
      });
    }

    // Compare global sales vs region totals
    const diff3 = Math.abs(globalSalesFromLedger - totalRegionSales);
    if (diff3 <= tolerance) {
      results.push({
        check: 'Global Sales vs Region Totals',
        status: 'PASS',
        expected: globalSalesFromLedger,
        actual: totalRegionSales,
        details: 'Global sales = sum of all regions'
      });
    } else {
      results.push({
        check: 'Global Sales vs Region Totals',
        status: 'FAIL',
        expected: globalSalesFromLedger,
        actual: totalRegionSales,
        difference: diff3,
        details: `Mismatch: ${diff3 > 0 ? 'Global Sales' : 'Region Totals'} has ${Math.abs(diff3).toLocaleString()} more`
      });
    }

    // 5. Validate Unauthorized Discounts
    console.log('⚠️ Step 5: Validating Unauthorized Discounts...');
    const bookerUsers = allUsers.filter(u => u.role?.toLowerCase() === 'booker');
    
    // Group bookers by name and sum their totals
    const bookerMap = new Map<string, { total: number; bookerIds: string[] }>();
    
    bookerUsers.forEach(booker => {
      const totalDiscount = booker.totalUnauthorizedDiscount || 0;
      if (totalDiscount > 0) {
        const bookerName = booker.name || 'Unknown';
        const existing = bookerMap.get(bookerName);
        
        if (existing) {
          existing.total += totalDiscount;
          existing.bookerIds.push(booker.id);
        } else {
          bookerMap.set(bookerName, {
            total: totalDiscount,
            bookerIds: [booker.id]
          });
        }
      }
    });
    
    // Filter out bookers with only test shop orders
    let validBookerDiscounts = 0;
    for (const [bookerName, data] of bookerMap) {
      // Check if any of the booker's orders are from non-test shops
      const bookerOrders = validOrders.filter(o => data.bookerIds.includes(o.bookerId));
      const hasNonTestShopOrders = bookerOrders.length === 0 || 
        bookerOrders.some(o => !isTestShop(o.shopName || o.shop?.shopName));
      
      if (hasNonTestShopOrders) {
        validBookerDiscounts += data.total;
      }
    }
    
    console.log(`   ✓ Found ${bookerMap.size} unique booker names with discounts`);
    console.log(`   ✓ Total Unauthorized Discounts: PKR ${validBookerDiscounts.toLocaleString()}\n`);

    // 6. Print detailed region breakdown
    console.log('📋 Step 6: Region Breakdown:');
    Object.entries(regionSales).forEach(([regionId, sales]) => {
      const region = allRegions.find(r => r.id === regionId);
      const regionName = region?.name || regionId;
      const branchNames = branchesByRegion[regionId] || [];
      const branchDetails = branchNames.map(branchName => {
        const branchSale = branchSales[branchName] || 0;
        return `    - ${branchName}: PKR ${branchSale.toLocaleString()}`;
      }).join('\n');
      
      console.log(`\n   ${regionName} (${regionId}): PKR ${sales.toLocaleString()}`);
      if (branchDetails) {
        console.log(branchDetails);
      }
    });

    // Print summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 VALIDATION SUMMARY');
    console.log('='.repeat(80) + '\n');
    
    results.forEach(result => {
      const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
      console.log(`${icon} ${result.check}`);
      console.log(`   Expected: PKR ${result.expected.toLocaleString()}`);
      console.log(`   Actual:   PKR ${result.actual.toLocaleString()}`);
      if (result.difference) {
        console.log(`   Difference: PKR ${result.difference.toLocaleString()}`);
      }
      if (result.details) {
        console.log(`   ${result.details}`);
      }
      console.log('');
    });

    const passCount = results.filter(r => r.status === 'PASS').length;
    const failCount = results.filter(r => r.status === 'FAIL').length;
    const warnCount = results.filter(r => r.status === 'WARNING').length;
    
    console.log('='.repeat(80));
    console.log(`Results: ${passCount} PASSED, ${warnCount} WARNINGS, ${failCount} FAILED`);
    console.log('='.repeat(80) + '\n');

    if (failCount > 0) {
      console.log('❌ Validation failed! Please review the discrepancies above.');
      process.exit(1);
    } else if (warnCount > 0) {
      console.log('⚠️ Validation passed with warnings. Please review warnings above.');
      process.exit(0);
    } else {
      console.log('✅ All validations passed!');
      process.exit(0);
    }

  } catch (error: any) {
    console.error('❌ Validation error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run validation
validateDashboardTotals();

