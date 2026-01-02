/**
 * Financial Service - Single Source of Truth for All Financial Calculations
 * 
 * Cash-only system: All deliveries are cash-on-delivery.
 * This service ensures all dashboards use the same calculation rules and
 * only reads from delivered orders (cash sales) and returns.
 */

import { dataService } from '../dataService';
import { toSafeDate } from '../utils/dateUtils';
import { DateRange } from '../utils/dateUtils';
import { isTestShop } from '../utils/shopFilters';

export interface FinancialMetrics {
    totalCashToday: number;
    globalSales: number;
    totalReturns: number;
}

export interface PaymentRecord {
    id: string;
    orderId: string;
    orderNumber: string;
    shopId: string;
    shopName: string;
    amount: number;
    paymentType: 'cash' | 'credit';
    paymentStatus: 'received' | 'pending';
    orderStatus: string;
    date: any;
    regionId?: string;
    branch?: string;
}

export interface DeliveryRecord {
    id: string;
    orderId: string;
    orderNumber: string;
    shopId: string;
    shopName: string;
    grandTotal: number;
    cashAmount: number;
    creditAmount: number;
    paymentMode: 'cash' | 'credit' | 'partial';
    status: string;
    deliveredAt?: any;
    createdAt: any;
    regionId?: string;
    branch?: string;
}

/**
 * Get Total Cash Today - ONLY from ledger entries
 * Sum net_cash from SALE_DELIVERED entries today, subtract net_cash from RETURN entries today
 */
export async function getTotalCashToday(branchName?: string, dateRange?: DateRange): Promise<number> {
    try {
        console.log('financialService.getTotalCashToday: Fetching from ledger entries');
        
        // @ts-ignore - Firebase CDN imports (browser environment)
        const { getDocs, query, where, collection } = await import('firebase/firestore');
        const { db } = await import('../firebase');
        
        const today = dateRange ? dateRange.start : new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = dateRange ? dateRange.end : new Date(today);
        if (!dateRange) {
        tomorrow.setDate(tomorrow.getDate() + 1);
        }
        
        // Get branch shops for filtering if branchName provided
        let branchShopIds: Set<string> | null = null;
        if (branchName) {
            try {
                const branchBookers = await dataService.getBranchBookers(branchName);
                const bookerIds = branchBookers.map(b => b.id);
                // Use filtered getAllShops to reduce reads
                const branchShops = await dataService.getAllShops(undefined, branchName);
                const filteredShops = branchShops.filter(shop => bookerIds.includes(shop.bookerId));
                branchShopIds = new Set(filteredShops.map(shop => shop.id));
            } catch (e) {
                console.warn('Could not fetch branch shops:', e);
            }
        }
        
        // Query ledger_transactions for today's entries with date filter
        // @ts-ignore - Firebase CDN imports
        const { Timestamp } = await import('firebase/firestore');
        const todayTimestamp = Timestamp.fromDate(today);
        const tomorrowTimestamp = Timestamp.fromDate(tomorrow);
        
        // Try date-filtered query first, fallback if needed
        let entries: any[] = [];
        try {
            const ledgerQuery = query(
                collection(db, 'ledger_transactions'),
                where('created_at', '>=', todayTimestamp),
                where('created_at', '<', tomorrowTimestamp)
            );
            const snapshot = await getDocs(ledgerQuery);
            entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (queryError: any) {
            console.warn('getTotalCashToday: Date-filtered query failed, trying without filter:', queryError.message);
            // Fallback: Load all and filter in memory
            const fallbackQuery = query(collection(db, 'ledger_transactions'));
            const fallbackSnapshot = await getDocs(fallbackQuery);
            entries = fallbackSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Filter by date in memory
            entries = entries.filter(entry => {
                const entryDate = toSafeDate(entry.created_at || entry.date || entry.createdAt);
                return entryDate >= today && entryDate < tomorrow;
            });
        }
        
        // Filter by type
        entries = entries.filter(entry => {
            
            // Filter by branch if provided
            if (branchName && branchShopIds) {
                const partyId = entry.party_id || entry.shopId;
                if (!partyId || !branchShopIds.has(partyId)) {
                    return false;
                }
            }
            
            return entry.type === 'SALE_DELIVERED' || entry.type === 'RETURN';
        });
        
        // Sum net_cash: positive from SALE_DELIVERED, negative from RETURN
        const totalCash = entries.reduce((sum, entry) => {
            const netCash = entry.net_cash !== undefined ? entry.net_cash : (entry.amount || 0);
            return sum + (typeof netCash === 'number' ? netCash : parseFloat(netCash) || 0);
        }, 0);
        
        console.log(`financialService.getTotalCashToday: Found ${entries.length} ledger entries, total cash: ${totalCash.toFixed(2)}`);
        
        // ALWAYS check orders as fallback (for migration/compatibility)
        try {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/abb08022-2053-4b74-b83b-ae5ba940a17c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'financialService.ts:113',message:'getTotalCashToday starting fallback',data:{branchName,dateRange,ledgerCash:totalCash,ledgerEntries:entries.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B,C'})}).catch(()=>{});
            // #endregion
            const orders = branchName 
                ? await dataService.getBranchOrders(branchName, dateRange)
                : await getAllDeliveredOrders(dateRange);
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/abb08022-2053-4b74-b83b-ae5ba940a17c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'financialService.ts:119',message:'getTotalCashToday fallback orders received',data:{orderCount:orders.length,statuses:orders.map((o:any)=>o.status)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B,C'})}).catch(()=>{});
            // #endregion
            const today = dateRange ? dateRange.start : new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = dateRange ? dateRange.end : new Date(today);
            if (!dateRange) {
                tomorrow.setDate(tomorrow.getDate() + 1);
            }
            
            const cashOrders = orders.filter(order => {
                if (order.status !== 'delivered') return false;
                const deliveredDate = toSafeDate(order.deliveredAt || order.updatedAt || order.createdAt || order.date);
                return deliveredDate >= today && deliveredDate < tomorrow;
            });
            const ordersCash = cashOrders.reduce((sum, order) => {
                return sum + (order.grandTotal || order.totalAmount || 0);
            }, 0);
            console.log(`financialService.getTotalCashToday: Orders fallback - found ${cashOrders.length} delivered orders today, total: ${ordersCash}`);
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/abb08022-2053-4b74-b83b-ae5ba940a17c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'financialService.ts:135',message:'getTotalCashToday comparing ledger vs orders',data:{ledgerCash:totalCash,ordersCash,cashOrdersCount:cashOrders.length,willUseOrders:ordersCash > totalCash || totalCash === 0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B,C'})}).catch(()=>{});
            // #endregion
            
            // Use orders if they have more cash than ledger (or if ledger is zero)
            if (ordersCash > totalCash || totalCash === 0) {
                console.log(`financialService.getTotalCashToday: Using orders data (${ordersCash}) instead of ledger (${totalCash})`);
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/abb08022-2053-4b74-b83b-ae5ba940a17c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'financialService.ts:140',message:'getTotalCashToday returning orders cash',data:{ordersCash},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B,C'})}).catch(()=>{});
                // #endregion
                return ordersCash;
            }
        } catch (fallbackError: any) {
            console.error('financialService.getTotalCashToday Orders Fallback Error:', fallbackError);
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/abb08022-2053-4b74-b83b-ae5ba940a17c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'financialService.ts:146',message:'getTotalCashToday fallback error',data:{error:fallbackError.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B,C'})}).catch(()=>{});
            // #endregion
            // Continue with ledger cash even if fallback fails
        }
        
        return totalCash;
    } catch (error: any) {
        console.error('financialService.getTotalCashToday Error:', error.message);
        // Fallback to old method for compatibility
        try {
            const orders = branchName 
                ? await dataService.getBranchOrders(branchName, dateRange)
                : await getAllDeliveredOrders(dateRange);
            const cashOrders = orders.filter(order => order.status === 'delivered');
            const totalCash = cashOrders.reduce((sum, order) => {
                return sum + (order.grandTotal || order.totalAmount || 0);
            }, 0);
            return totalCash;
        } catch (fallbackError: any) {
            console.error('financialService.getTotalCashToday Fallback Error:', fallbackError.message);
        return 0;
        }
    }
}

/**
 * Get Global Sales - ONLY from ledger entries (SALE_DELIVERED type)
 * This is the single source of truth for financial calculations
 * 
 * @param dateRange - Optional date range. If not provided, uses all-time data for admin dashboard
 * @param excludeTestShops - Whether to exclude test shops (default: true for admin)
 */
export async function getGlobalSales(dateRange?: DateRange, excludeTestShops: boolean = true): Promise<number> {
    try {
        console.log('financialService.getGlobalSales: Fetching from ledger entries', { dateRange, excludeTestShops });
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/abb08022-2053-4b74-b83b-ae5ba940a17c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'financialService.ts:136',message:'getGlobalSales entry',data:{dateRange,excludeTestShops},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B'})}).catch(()=>{});
        // #endregion
        
        // @ts-ignore - Firebase CDN imports (browser environment)
        const { getDocs, query, where, collection, Timestamp } = await import('firebase/firestore');
        const { db } = await import('../firebase');
        
        // Query ledger_transactions - try with date filter, fallback if needed
        // Note: created_at might be ISO string or Timestamp, so we'll filter in memory if query fails
        let allEntries: any[] = [];
        try {
            let allQuery;
            if (dateRange) {
                const startTimestamp = Timestamp.fromDate(dateRange.start);
                const endTimestamp = Timestamp.fromDate(dateRange.end);
                allQuery = query(
                    collection(db, 'ledger_transactions'),
                    where('created_at', '>=', startTimestamp),
                    where('created_at', '<=', endTimestamp)
                );
            } else {
                // For admin dashboard (no dateRange), load ALL entries (all-time)
                // Remove 90-day limit to show complete totals
                console.log('getGlobalSales: No dateRange provided, loading all-time data');
                allQuery = query(collection(db, 'ledger_transactions'));
            }
            const allSnapshot = await getDocs(allQuery);
            allEntries = allSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // If dateRange was provided, filter in memory (in case query didn't work)
            if (dateRange && allEntries.length > 0) {
                allEntries = allEntries.filter(entry => {
                    const entryDate = toSafeDate(entry.created_at || entry.date || entry.createdAt);
                    return entryDate >= dateRange.start && entryDate <= dateRange.end;
                });
            }
        } catch (queryError: any) {
            console.warn('getGlobalSales: Query failed, trying fallback:', queryError.message);
            // Fallback: Load all and filter in memory
            const fallbackQuery = query(collection(db, 'ledger_transactions'));
            const fallbackSnapshot = await getDocs(fallbackQuery);
            allEntries = fallbackSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Apply date filter in memory if dateRange provided
            if (dateRange) {
                allEntries = allEntries.filter(entry => {
                    const entryDate = toSafeDate(entry.created_at || entry.date || entry.createdAt);
                    return entryDate >= dateRange.start && entryDate <= dateRange.end;
                });
            }
            // No 90-day limit if no dateRange - use all-time data
        }
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/abb08022-2053-4b74-b83b-ae5ba940a17c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'financialService.ts:150',message:'All ledger entries query result',data:{totalEntries:allEntries.length,entryTypes:allEntries.map((e:any)=>e.type),sampleEntry:allEntries[0]},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B'})}).catch(()=>{});
        // #endregion
        
        // Query ledger_transactions for SALE_DELIVERED entries with date filter
        // Use the allEntries we already loaded to avoid duplicate queries
        let entries = allEntries.filter((entry: any) => entry.type === 'SALE_DELIVERED');
        
        // If we got entries from allEntries, use them; otherwise try direct query
        if (entries.length === 0) {
            try {
                const ledgerQuery = query(
                    collection(db, 'ledger_transactions'),
                    where('type', '==', 'SALE_DELIVERED')
                );
                const snapshot = await getDocs(ledgerQuery);
                entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                // Apply date filter in memory if dateRange provided
                if (dateRange) {
                    entries = entries.filter(entry => {
                        const entryDate = toSafeDate(entry.created_at || entry.date || entry.createdAt);
                        return entryDate >= dateRange.start && entryDate <= dateRange.end;
                    });
                }
                // No 90-day limit if no dateRange - use all-time data
            } catch (queryError: any) {
                console.warn('getGlobalSales: SALE_DELIVERED query failed:', queryError.message);
                entries = [];
            }
        }
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/abb08022-2053-4b74-b83b-ae5ba940a17c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'financialService.ts:160',message:'SALE_DELIVERED query result',data:{foundEntries:entries.length,entries},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        
        // Also try SALE type for legacy entries - filter from allEntries
        const saleEntries = allEntries.filter((entry: any) => entry.type === 'SALE');
        
        // If no SALE entries found, try direct query
        if (saleEntries.length === 0) {
            try {
                const saleQuery = query(
                    collection(db, 'ledger_transactions'),
                    where('type', '==', 'SALE')
                );
                const saleSnapshot = await getDocs(saleQuery);
                const directSaleEntries = saleSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                
                // Apply date filter in memory if dateRange provided
                if (dateRange) {
                    entries.push(...directSaleEntries.filter(entry => {
                        const entryDate = toSafeDate(entry.created_at || entry.date || entry.createdAt);
                        return entryDate >= dateRange.start && entryDate <= dateRange.end;
                    }));
                } else {
                    // No dateRange - include all entries (all-time)
                    entries.push(...directSaleEntries);
                }
            } catch (queryError: any) {
                console.warn('getGlobalSales: SALE query failed:', queryError.message);
            }
        } else {
            entries.push(...saleEntries);
        }
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/abb08022-2053-4b74-b83b-ae5ba940a17c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'financialService.ts:170',message:'SALE query result',data:{foundEntries:saleEntries.length,saleEntries},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        
        // Combine both types
        entries = [...entries, ...saleEntries];
        console.log(`financialService.getGlobalSales: Found ${entries.length} total ledger entries (${entries.filter((e:any)=>e.type==='SALE_DELIVERED').length} SALE_DELIVERED, ${entries.filter((e:any)=>e.type==='SALE').length} SALE)`);
        
        // Date filter already applied (either in query or in memory)
        console.log(`financialService.getGlobalSales: Found ${entries.length} entries (${entries.filter((e:any)=>e.type==='SALE_DELIVERED').length} SALE_DELIVERED, ${entries.filter((e:any)=>e.type==='SALE').length} SALE)`);
        
        // Filter test shops if requested
        if (excludeTestShops) {
            // Get shop names from ledger entries (shop_name, shopName, or fetch from orderId)
            const entriesBeforeFilter = entries.length;
            entries = entries.filter(entry => {
                const shopName = entry.shop_name || entry.shopName || entry.shop?.shopName;
                if (isTestShop(shopName)) {
                    console.log(`getGlobalSales: Excluding test shop entry: ${shopName}`);
                    return false;
                }
                return true;
            });
            console.log(`getGlobalSales: Filtered ${entriesBeforeFilter - entries.length} test shop entries`);
        }
        
        // Sum net_cash from all SALE_DELIVERED entries
        const totalSales = entries.reduce((sum, entry) => {
            const netCash = entry.net_cash !== undefined ? entry.net_cash : (entry.amount || 0);
            return sum + (typeof netCash === 'number' ? netCash : parseFloat(netCash) || 0);
        }, 0);
        
        console.log(`financialService.getGlobalSales: Calculated total sales: ${totalSales} from ${entries.length} entries (test shops excluded: ${excludeTestShops})`);
        
        // ALWAYS fall back to orders if ledger entries are insufficient (for migration/compatibility)
        // This ensures we show data even if ledger entries haven't been created yet
        try {
            const orders = await getAllDeliveredOrders(dateRange, excludeTestShops);
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/abb08022-2053-4b74-b83b-ae5ba940a17c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'financialService.ts:233',message:'getGlobalSales fallback orders received',data:{orderCount:orders.length,orders:orders.slice(0,3).map((o:any)=>({id:o.id,grandTotal:o.grandTotal,totalAmount:o.totalAmount}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B,C'})}).catch(()=>{});
            // #endregion
            const ordersSales = orders.reduce((sum, order) => {
                const amount = order.grandTotal || order.totalAmount || 0;
                return sum + amount;
            }, 0);
            console.log(`financialService.getGlobalSales: Orders fallback - found ${orders.length} orders, total: ${ordersSales} (test shops excluded: ${excludeTestShops})`);
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/abb08022-2053-4b74-b83b-ae5ba940a17c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'financialService.ts:240',message:'getGlobalSales comparing ledger vs orders',data:{ledgerSales:totalSales,ordersSales,willUseOrders:ordersSales > totalSales || totalSales === 0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B,C'})}).catch(()=>{});
            // #endregion
            
            // Use orders if they have more sales than ledger (or if ledger is zero)
            if (ordersSales > totalSales || totalSales === 0) {
                console.log(`financialService.getGlobalSales: Using orders data (${ordersSales}) instead of ledger (${totalSales})`);
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/abb08022-2053-4b74-b83b-ae5ba940a17c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'financialService.ts:244',message:'getGlobalSales returning orders sales',data:{ordersSales},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B,C'})}).catch(()=>{});
                // #endregion
                return ordersSales;
            }
        } catch (fallbackError: any) {
            console.error('financialService.getGlobalSales Orders Fallback Error:', fallbackError);
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/abb08022-2053-4b74-b83b-ae5ba940a17c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'financialService.ts:249',message:'getGlobalSales fallback error',data:{error:fallbackError.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B,C'})}).catch(()=>{});
            // #endregion
            // Continue with ledger sales even if fallback fails
        }
        
        return totalSales;
    } catch (error: any) {
        console.error('financialService.getGlobalSales Error:', error.message);
        // Fallback to old method for compatibility during migration
        try {
            const orders = await getAllDeliveredOrders(dateRange, excludeTestShops);
            const totalSales = orders.reduce((sum, order) => {
                return sum + (order.grandTotal || order.totalAmount || 0);
            }, 0);
            return totalSales;
        } catch (fallbackError: any) {
            console.error('financialService.getGlobalSales Fallback Error:', fallbackError.message);
        return 0;
        }
    }
}


/**
 * Get all delivered orders (helper function)
 * @param dateRange - Optional date range filter
 * @param excludeTestShops - Whether to exclude test shops (default: true)
 */
async function getAllDeliveredOrders(dateRange?: DateRange, excludeTestShops: boolean = true): Promise<any[]> {
    try {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/abb08022-2053-4b74-b83b-ae5ba940a17c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'financialService.ts:272',message:'getAllDeliveredOrders entry',data:{dateRange},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B,C'})}).catch(()=>{});
        // #endregion
        // @ts-ignore - Firebase CDN imports (browser environment)
        const { getDocs, query, where } = await import('firebase/firestore');
        const { collections } = await import('../firebase');
        
        // Query for delivered orders
        const ordersQuery = query(
            collections.orders,
            where('status', '==', 'delivered')
        );
        
        const snapshot = await getDocs(ordersQuery);
        let orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/abb08022-2053-4b74-b83b-ae5ba940a17c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'financialService.ts:288',message:'getAllDeliveredOrders query result',data:{totalOrders:orders.length,statuses:orders.map((o:any)=>o.status),sampleOrders:orders.slice(0,3).map((o:any)=>({id:o.id,status:o.status,orderNumber:o.orderNumber,grandTotal:o.grandTotal,totalAmount:o.totalAmount,deliveredAt:o.deliveredAt,createdAt:o.createdAt}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B,C'})}).catch(()=>{});
        // #endregion
        
        // Filter by date range if provided
        if (dateRange) {
            const beforeFilter = orders.length;
            orders = orders.filter(order => {
                const orderDate = toSafeDate(order.deliveredAt || order.updatedAt || order.createdAt || order.date);
                return orderDate >= dateRange.start && orderDate <= dateRange.end;
            });
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/abb08022-2053-4b74-b83b-ae5ba940a17c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'financialService.ts:295',message:'getAllDeliveredOrders date filter result',data:{beforeFilter,afterFilter:orders.length,dateRange},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
            // #endregion
        }
        
        // Filter test shops if requested
        if (excludeTestShops) {
            const beforeTestFilter = orders.length;
            orders = orders.filter(order => {
                const shopName = order.shopName || order.shop?.shopName;
                return !isTestShop(shopName);
            });
            console.log(`getAllDeliveredOrders: Filtered ${beforeTestFilter - orders.length} test shop orders`);
        }
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/abb08022-2053-4b74-b83b-ae5ba940a17c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'financialService.ts:300',message:'getAllDeliveredOrders returning',data:{finalOrderCount:orders.length,excludeTestShops},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B,C'})}).catch(()=>{});
        // #endregion
        return orders;
    } catch (error: any) {
        console.error('getAllDeliveredOrders Error:', error.message);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/abb08022-2053-4b74-b83b-ae5ba940a17c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'financialService.ts:305',message:'getAllDeliveredOrders error',data:{error:error.message,stack:error.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B,C'})}).catch(()=>{});
        // #endregion
        return [];
    }
}

/**
 * Get ledger entries - Cash-only system
 * Reads from ledger_transactions collection (SALE_DELIVERED and RETURN types only)
 */
export async function getFinancialLedgerEntries(branchName?: string): Promise<any[]> {
    try {
        console.log('financialService.getFinancialLedgerEntries: Fetching from ledger_transactions');
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/abb08022-2053-4b74-b83b-ae5ba940a17c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'financialService.ts:223',message:'getFinancialLedgerEntries entry',data:{branchName},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        
        // @ts-ignore - Firebase CDN imports (browser environment)
        const { getDocs, query, where, collection, Timestamp } = await import('firebase/firestore');
        const { db } = await import('../firebase');
        
        // Get branch shops if branchName is provided (for filtering)
        let branchShopIds: Set<string> | null = null;
        if (branchName) {
            try {
                const branchBookers = await dataService.getBranchBookers(branchName);
                const bookerIds = branchBookers.map(b => b.id);
                // Use filtered getAllShops instead of loading all shops
                const branchShops = await dataService.getAllShops(undefined, branchName);
                branchShopIds = new Set(branchShops.map(shop => shop.id));
                console.log(`financialService.getFinancialLedgerEntries: Branch ${branchName} has ${branchShopIds.size} shops`);
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/abb08022-2053-4b74-b83b-ae5ba940a17c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'financialService.ts:239',message:'Branch shops loaded',data:{branchName,shopCount:branchShopIds.size,shopIds:Array.from(branchShopIds).slice(0,5)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
                // #endregion
            } catch (e) {
                console.warn('Could not fetch branch shops for filtering:', e);
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/abb08022-2053-4b74-b83b-ae5ba940a17c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'financialService.ts:243',message:'Branch shops fetch error',data:{branchName,error:e},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
                // #endregion
            }
        }
        
        // Query ledger_transactions for SALE_DELIVERED and RETURN entries
        // For branch-specific queries, load all entries (branch filter will reduce results)
        // For admin queries, limit to last 90 days to prevent excessive reads
        let entries: any[] = [];
        try {
            // If branch-specific query, load all entries (branch filter will handle reduction)
            // If admin query (no branch), limit to 90 days
            if (branchName) {
                // Branch query: Load all entries, branch filter will reduce results
                const ledgerQuery = query(collection(db, 'ledger_transactions'));
                const snapshot = await getDocs(ledgerQuery);
                entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                console.log(`getFinancialLedgerEntries: Loaded ${entries.length} total entries for branch filtering`);
            } else {
                // Admin query: Limit to last 90 days to prevent excessive reads
                const ninetyDaysAgo = new Date();
                ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
                const startTimestamp = Timestamp.fromDate(ninetyDaysAgo);
                
                const ledgerQuery = query(
                    collection(db, 'ledger_transactions'),
                    where('created_at', '>=', startTimestamp)
                );
                const snapshot = await getDocs(ledgerQuery);
                entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                console.log(`getFinancialLedgerEntries: Loaded ${entries.length} entries (90 days limit)`);
            }
        } catch (queryError: any) {
            console.warn('getFinancialLedgerEntries: Query failed, trying fallback:', queryError.message);
            // Fallback: Load all and filter in memory
            const fallbackQuery = query(collection(db, 'ledger_transactions'));
            const fallbackSnapshot = await getDocs(fallbackQuery);
            entries = fallbackSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log(`getFinancialLedgerEntries: Fallback loaded ${entries.length} total entries`);
            
            // Only apply date filter for admin queries (not branch-specific)
            if (!branchName) {
                const ninetyDaysAgo = new Date();
                ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
                entries = entries.filter(entry => {
                    const entryDate = toSafeDate(entry.created_at || entry.date || entry.createdAt);
                    return entryDate >= ninetyDaysAgo;
                });
                console.log(`getFinancialLedgerEntries: After date filter: ${entries.length} entries`);
            }
        }
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/abb08022-2053-4b74-b83b-ae5ba940a17c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'financialService.ts:251',message:'Raw ledger entries from query',data:{totalEntries:entries.length,entryTypes:entries.map((e:any)=>e.type),sampleEntry:entries[0]},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B'})}).catch(()=>{});
        // #endregion
        
        // Filter by type and branch
        const beforeFilter = entries.length;
        entries = entries.filter((entry: any) => {
            // Only include SALE_DELIVERED and RETURN types
            if (entry.type !== 'SALE_DELIVERED' && entry.type !== 'RETURN') {
                // Also accept legacy 'SALE' type for backward compatibility
                if (entry.type !== 'SALE') {
                    return false;
                }
            }
            
            // Filter by branch if provided
            if (branchName && branchShopIds) {
                const partyId = entry.party_id || entry.shopId;
                if (!partyId || !branchShopIds.has(partyId)) {
                    return false;
                }
            }
            
            return true;
                });
        console.log(`financialService.getFinancialLedgerEntries: After filtering - ${entries.length} entries (from ${beforeFilter}, branch: ${branchName}, shops: ${branchShopIds?.size || 'N/A'})`);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/abb08022-2053-4b74-b83b-ae5ba940a17c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'financialService.ts:368',message:'After type and branch filtering',data:{beforeFilter,afterFilter:entries.length,branchName,entries:entries.slice(0,3).map((e:any)=>({type:e.type,party_id:e.party_id,shopId:e.shopId}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,E'})}).catch(()=>{});
        // #endregion
        
        // Transform to expected format
        const transformedEntries = entries.map((entry: any) => {
            const isSale = entry.type === 'SALE_DELIVERED' || entry.type === 'SALE';
            const netCash = entry.net_cash !== undefined ? entry.net_cash : (entry.amount || 0);
                
                return {
                id: entry.order_number || entry.return_number || entry.id,
                date: entry.created_at || entry.date || entry.createdAt,
                partyName: entry.shopName || 'Unknown',
                description: entry.notes || (isSale 
                    ? `Order ${entry.order_number || entry.id?.slice(0, 8)} - Cash Sale`
                    : 'Stock return'),
                type: isSale ? 'SALE' : 'RETURN',
                reference: entry.order_number || entry.return_number || entry.id,
                referenceType: isSale ? 'Order' : 'Return',
                amount: Math.abs(netCash),
                net_cash: typeof netCash === 'number' ? netCash : parseFloat(netCash) || 0,
                timestamp: entry.created_at || entry.date || entry.createdAt,
                regionId: entry.region_id || entry.regionId || '',
                shopName: entry.shopName || 'Unknown',
                orderNumber: entry.order_number,
                returnNumber: entry.return_number
            };
        });
        
        // Sort by timestamp (most recent first)
        const toTimestamp = (val: any): number => {
            if (!val) return 0;
            const date = toSafeDate(val);
            return date.getTime();
        };
        
        transformedEntries.sort((a, b) => toTimestamp(b.timestamp) - toTimestamp(a.timestamp));
        
        console.log(`financialService.getFinancialLedgerEntries: Found ${transformedEntries.length} ledger entries`);
        
        // ALWAYS try fallback to orders (for migration/compatibility)
        // This ensures we show data even if ledger entries haven't been created yet
        // Works for both branch-specific queries AND admin view (all branches)
        try {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/abb08022-2053-4b74-b83b-ae5ba940a17c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'financialService.ts:453',message:'getFinancialLedgerEntries starting fallback',data:{branchName:branchName||'ALL_BRANCHES',ledgerEntryCount:transformedEntries.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
            // #endregion
            
            let deliveredOrders: any[] = [];
            if (branchName) {
                // Branch-specific fallback
                deliveredOrders = await dataService.getBranchOrders(branchName);
            } else {
                // Admin view: get all delivered orders from all branches
                deliveredOrders = await getAllDeliveredOrders();
            }
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/abb08022-2053-4b74-b83b-ae5ba940a17c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'financialService.ts:465',message:'getFinancialLedgerEntries fallback orders received',data:{totalOrders:deliveredOrders.length,statuses:deliveredOrders.map((o:any)=>o.status)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
            // #endregion
            
            console.log(`financialService.getFinancialLedgerEntries: Orders fallback - found ${deliveredOrders.length} total orders`);
            const saleEntries = deliveredOrders
                .filter(order => order.status === 'delivered')
                .map(order => ({
                    id: order.orderNumber || order.id,
                    date: order.deliveredAt || order.updatedAt || order.createdAt,
                    partyName: order.shopName || 'Unknown',
                    description: `Order ${order.orderNumber || order.id?.slice(0, 8)} - Cash Sale`,
                    type: 'SALE' as const,
                    reference: order.orderNumber || order.id,
                    referenceType: 'Order',
                    amount: order.grandTotal || order.totalAmount || 0,
                    net_cash: (order.grandTotal || order.totalAmount || 0) - (order.totalDiscount || 0),
                    timestamp: order.deliveredAt || order.updatedAt || order.createdAt,
                    regionId: order.regionId || '',
                    shopName: order.shopName || 'Unknown',
                    orderNumber: order.orderNumber
                }));
            
            console.log(`financialService.getFinancialLedgerEntries: Orders fallback converted ${saleEntries.length} delivered orders to ledger entries`);
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/abb08022-2053-4b74-b83b-ae5ba940a17c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'financialService.ts:488',message:'getFinancialLedgerEntries comparing ledger vs orders',data:{ledgerEntryCount:transformedEntries.length,ordersEntryCount:saleEntries.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
            // #endregion
            
            if (branchName) {
                // Branch-specific: Use orders if we have more entries from orders than from ledger
                if (saleEntries.length > transformedEntries.length || transformedEntries.length === 0) {
                    console.log(`financialService.getFinancialLedgerEntries: Using orders data (${saleEntries.length} entries) instead of ledger (${transformedEntries.length} entries)`);
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/abb08022-2053-4b74-b83b-ae5ba940a17c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'financialService.ts:494',message:'getFinancialLedgerEntries returning orders entries (branch)',data:{saleEntriesCount:saleEntries.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
                    // #endregion
                    return saleEntries;
                }
            } else {
                // Admin view: Combine ledger entries (returns) with orders (sales)
                // This ensures we show both sales from orders and returns from ledger
                const combinedEntries = [...transformedEntries, ...saleEntries];
                
                // Remove duplicates (if ledger already has some sales)
                const uniqueEntries = combinedEntries.reduce((acc: any[], entry: any) => {
                    const exists = acc.find(e => 
                        e.reference === entry.reference && 
                        e.type === entry.type &&
                        Math.abs((e.net_cash || e.amount) - (entry.net_cash || entry.amount)) < 0.01
                    );
                    if (!exists) {
                        acc.push(entry);
                    }
                    return acc;
                }, []);
                
                // Sort by timestamp (most recent first)
                uniqueEntries.sort((a, b) => {
                    const dateA = toSafeDate(a.timestamp || a.date).getTime();
                    const dateB = toSafeDate(b.timestamp || b.date).getTime();
                    return dateB - dateA;
                });
                
                console.log(`financialService.getFinancialLedgerEntries: Admin view - returning ${uniqueEntries.length} combined entries (${transformedEntries.length} from ledger, ${saleEntries.length} from orders)`);
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/abb08022-2053-4b74-b83b-ae5ba940a17c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'financialService.ts:518',message:'getFinancialLedgerEntries returning combined entries (admin)',data:{combinedCount:uniqueEntries.length,ledgerCount:transformedEntries.length,ordersCount:saleEntries.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
                // #endregion
                return uniqueEntries;
            }
        } catch (fallbackError: any) {
            console.error('financialService.getFinancialLedgerEntries Orders Fallback Error:', fallbackError);
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/abb08022-2053-4b74-b83b-ae5ba940a17c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'financialService.ts:522',message:'getFinancialLedgerEntries fallback error',data:{error:fallbackError.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
            // #endregion
            // Continue with ledger entries even if fallback fails
        }
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/abb08022-2053-4b74-b83b-ae5ba940a17c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'financialService.ts:543',message:'getFinancialLedgerEntries result',data:{transformedCount:transformedEntries.length,transformedSample:transformedEntries.slice(0,2)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,C,D,E'})}).catch(()=>{});
        // #endregion
        return transformedEntries;
    } catch (error: any) {
        console.error('financialService.getFinancialLedgerEntries Error:', error.message);
        return [];
    }
}

/**
 * Get recent activity (non-financial) - bookings, deliveries, returns
 * This is separate from financial ledgers
 */
export async function getRecentActivity(branchName?: string, limit: number = 10): Promise<any[]> {
    try {
        console.log('financialService.getRecentActivity: Fetching activity for branch:', branchName);
        const activities: any[] = [];
        
        // Get orders (all statuses) for activity log
        const orders = branchName
            ? await dataService.getBranchOrders(branchName)
            : await getAllDeliveredOrders();
        
        const orderActivities = orders
            .filter(order => order.status !== 'draft')
            .slice(0, limit)
            .map(order => ({
                id: order.orderNumber || order.id,
                time: order.createdAt || order.date,
                type: order.status === 'delivered' ? 'Delivery' : 'Booking',
                entity: `${order.shopName || 'Unknown Shop'} • ${order.orderNumber || order.id?.slice(0, 8)}`,
                amount: order.grandTotal || order.totalAmount || 0,
                timestamp: order.createdAt || order.date,
                isFinancial: order.status === 'delivered' // Only deliveries are financial
            }));
        
        activities.push(...orderActivities);
        
        // Sort by timestamp
        const toTimestamp = (val: any): number => {
            if (!val) return 0;
            const date = toSafeDate(val);
            return date.getTime();
        };
        
        activities.sort((a, b) => toTimestamp(b.timestamp) - toTimestamp(a.timestamp));
        
        return activities.slice(0, limit);
    } catch (error: any) {
        console.error('financialService.getRecentActivity Error:', error.message);
        return [];
    }
}

