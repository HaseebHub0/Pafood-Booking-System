import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import {
  LedgerTransaction,
  TransactionType,
  PaymentMode,
  ShopCreditSummary,
  LedgerStats,
  LedgerFilter,
  PaymentFormData,
  AdjustmentFormData,
  DEFAULT_CREDIT_LIMIT,
} from '../types/ledger';
import { Shop } from '../types/shop';
import { storage, STORAGE_KEYS } from '../services/storage/asyncStorage';
import { useShopStore } from './shopStore';
import { useAuthStore } from './authStore';

interface LedgerState {
  transactions: LedgerTransaction[];
  isLoading: boolean;
  error: string | null;
}

interface LedgerActions {
  loadTransactions: () => Promise<void>;
  
  // Record a sale transaction (called when order is submitted with credit)
  recordSale: (
    shopId: string,
    orderId: string,
    orderNumber: string,
    totalAmount: number,
    cashAmount: number,
    creditAmount: number,
    paymentMode: PaymentMode
  ) => Promise<LedgerTransaction | null>;
  
  // Record a payment collection
  recordPayment: (data: PaymentFormData) => Promise<LedgerTransaction | null>;
  
  // Record a balance adjustment
  recordAdjustment: (data: AdjustmentFormData) => Promise<LedgerTransaction | null>;
  
  // Get transactions for a specific shop
  getShopTransactions: (shopId: string, limit?: number) => LedgerTransaction[];
  
  // Get filtered transactions
  getFilteredTransactions: (filter: LedgerFilter) => LedgerTransaction[];
  
  // Get credit summary for a shop
  getShopCreditSummary: (shopId: string) => ShopCreditSummary | null;
  
  // Get overall ledger statistics
  getLedgerStats: () => LedgerStats;
  
  // Get shops with outstanding balance
  getShopsWithBalance: () => Shop[];
  
  // Clear all transactions (for testing)
  clearTransactions: () => Promise<void>;
}

type LedgerStore = LedgerState & LedgerActions;

// Helper to update shop balance
const updateShopBalance = async (shopId: string, newBalance: number) => {
  const shopStore = useShopStore.getState();
  await shopStore.updateShop(shopId, { currentBalance: newBalance } as any);
};

// Generate transaction number
const generateTransactionNumber = (type: TransactionType): string => {
  const prefix = type === 'SALE' ? 'TXN-S' : type === 'PAYMENT' ? 'TXN-P' : 'TXN-A';
  const timestamp = Date.now().toString(36).toUpperCase();
  return `${prefix}-${timestamp}`;
};

export const useLedgerStore = create<LedgerStore>((set, get) => ({
  // Initial state
  transactions: [],
  isLoading: false,
  error: null,

  // Actions
  loadTransactions: async () => {
    set({ isLoading: true, error: null });

    try {
      const currentUser = useAuthStore.getState().user;
      
      // Try Firebase first
      try {
        const { firestoreService } = await import('../services/firebase');
        const { COLLECTIONS } = await import('../services/firebase/collections');
        
        let transactionsList: LedgerTransaction[] = [];
        
        if (currentUser?.role === 'admin' || currentUser?.role === 'owner') {
          // Admin/Owner can see all transactions
          transactionsList = await firestoreService.getDocs<LedgerTransaction>(COLLECTIONS.LEDGER_TRANSACTIONS);
        } else if (currentUser?.regionId) {
          // KPO/Salesman see transactions in their region
          // Query by both region_id (new structure) and regionId (legacy)
          const [newTransactions, legacyTransactions] = await Promise.all([
            firestoreService.getDocsWhere<LedgerTransaction>(
              COLLECTIONS.LEDGER_TRANSACTIONS,
              'region_id',
              '==',
              currentUser.regionId
            ).catch(() => []),
            firestoreService.getDocsWhere<LedgerTransaction>(
            COLLECTIONS.LEDGER_TRANSACTIONS,
            'regionId',
            '==',
            currentUser.regionId
            ).catch(() => [])
          ]);
          
          // Combine and deduplicate by id
          const transactionMap = new Map<string, LedgerTransaction>();
          [...newTransactions, ...legacyTransactions].forEach(t => {
            if (!transactionMap.has(t.id)) {
              transactionMap.set(t.id, t);
            }
          });
          transactionsList = Array.from(transactionMap.values());
        }
        
        // Sort in memory (most recent first)
        transactionsList.sort((a, b) => {
          // Handle both new (created_at) and legacy (date, createdAt) date fields
          const dateA = new Date((a as any).created_at || a.date || a.createdAt).getTime();
          const dateB = new Date((b as any).created_at || b.date || b.createdAt).getTime();
          return dateB - dateA;
        });

        // Update local storage cache
        await storage.set(STORAGE_KEYS.LEDGER_TRANSACTIONS, transactionsList);
        set({ 
          transactions: transactionsList, 
          isLoading: false 
        });
      } catch (firebaseError) {
        console.warn('Firebase load failed, trying local storage:', firebaseError);
        
        // Fallback to local storage
      const storedTransactions = await storage.get<LedgerTransaction[]>(STORAGE_KEYS.LEDGER_TRANSACTIONS);
      const shopStore = useShopStore.getState();
      
      let transactionsList = storedTransactions || [];
      
      // Filter by region if user is not admin/owner
      if (currentUser && currentUser.role !== 'admin' && currentUser.role !== 'owner') {
        transactionsList = transactionsList.filter(transaction => {
          // Check both new (region_id) and legacy (regionId) fields, and also check via shop
          const transactionRegionId = (transaction as any).region_id || (transaction as any).regionId;
          if (transactionRegionId === currentUser.regionId) {
            return true;
          }
          // Fallback: check via shop's regionId
          const shop = shopStore.getShopById((transaction as any).party_id || transaction.shopId);
          return shop && shop.regionId === currentUser.regionId;
        });
      }
      
      set({ 
        transactions: transactionsList, 
        isLoading: false 
      });
      }
    } catch (error) {
      set({
        error: 'Failed to load transactions',
        isLoading: false,
      });
    }
  },

  recordSale: async (shopId, orderId, orderNumber, totalAmount, cashAmount, creditAmount, paymentMode) => {
    const { transactions } = get();
    const shopStore = useShopStore.getState();
    const authStore = useAuthStore.getState();
    
    const shop = shopStore.getShopById(shopId);
    if (!shop) {
      set({ error: 'Shop not found' });
      return null;
    }

    // Cash-only system: Always record sale transaction for delivered orders
    // Use totalAmount (full order value) as the sale amount
    const regionId = shop.regionId || authStore.user?.regionId || '';
    
    const transaction: LedgerTransaction & { regionId?: string } = {
      id: uuidv4(),
      shopId,
      shopName: shop.shopName,
      orderId,
      orderNumber,
      type: 'SALE',
      amount: totalAmount, // Full order amount (cash received)
      balanceBefore: 0, // No balance tracking in cash-only system
      balanceAfter: 0, // No balance tracking in cash-only system
      paymentMode: 'cash', // Always cash in cash-only system
      collectedBy: authStore.user?.id,
      collectedByName: authStore.user?.name,
      notes: `Cash sale - Order ${orderNumber}`,
      date: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
      regionId, // Include regionId for filtering
    };

    const updatedTransactions = [transaction, ...transactions];
    
    // No balance update needed in cash-only system
    
    // Save transactions
    await storage.set(STORAGE_KEYS.LEDGER_TRANSACTIONS, updatedTransactions);
    set({ transactions: updatedTransactions });

    // Sync to Firebase
    try {
      const { firestoreService } = await import('../services/firebase');
      const { COLLECTIONS } = await import('../services/firebase/collections');
      
      // Sanitize transaction to remove undefined values
      const { sanitizeForFirebase } = await import('../utils/dataSanitizers');
      const sanitizedTransaction = sanitizeForFirebase({
        ...transaction,
        regionId: shop.regionId || authStore.user?.regionId || '',
        syncStatus: 'synced',
      });
      
      await firestoreService.setDoc(COLLECTIONS.LEDGER_TRANSACTIONS, sanitizedTransaction);
      
      // Update local storage with synced status
      const syncedTransaction = { ...transaction, syncStatus: 'synced' as const };
      const syncedTransactions = updatedTransactions.map((t) => (t.id === transaction.id ? syncedTransaction : t));
      await storage.set(STORAGE_KEYS.LEDGER_TRANSACTIONS, syncedTransactions);
      set({ transactions: syncedTransactions });
    } catch (error) {
      console.warn('Failed to sync transaction to Firebase:', error);
      // Keep as pending - will sync later
    }

    return transaction;
  },

  recordPayment: async (data) => {
    const { transactions } = get();
    const shopStore = useShopStore.getState();
    const authStore = useAuthStore.getState();
    
    const shop = shopStore.getShopById(data.shopId);
    if (!shop) {
      set({ error: 'Shop not found' });
      return null;
    }

    if (data.amount <= 0) {
      set({ error: 'Payment amount must be greater than 0' });
      return null;
    }

    const balanceBefore = shop.currentBalance;
    const balanceAfter = balanceBefore - data.amount; // Payment reduces balance

    const regionId = shop.regionId || authStore.user?.regionId || '';
    
    const transaction: LedgerTransaction & { regionId?: string } = {
      id: uuidv4(),
      shopId: data.shopId,
      shopName: shop.shopName,
      type: 'PAYMENT',
      amount: -data.amount, // Negative because it reduces balance
      balanceBefore,
      balanceAfter,
      collectedBy: authStore.user?.id,
      collectedByName: authStore.user?.name,
      notes: data.notes || 'Payment received',
      date: data.date || new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
      regionId, // Include regionId for filtering
    };

    const updatedTransactions = [transaction, ...transactions];
    
    // Update shop balance
    await updateShopBalance(data.shopId, balanceAfter);
    
    // Save transactions
    await storage.set(STORAGE_KEYS.LEDGER_TRANSACTIONS, updatedTransactions);
    set({ transactions: updatedTransactions });

    // Sync to Firebase
    try {
      const { firestoreService } = await import('../services/firebase');
      const { COLLECTIONS } = await import('../services/firebase/collections');
      
      // Sanitize transaction to remove undefined values
      const { sanitizeForFirebase } = await import('../utils/dataSanitizers');
      const sanitizedTransaction = sanitizeForFirebase({
        ...transaction,
        regionId: shop.regionId || authStore.user?.regionId || '',
        syncStatus: 'synced',
      });
      
      await firestoreService.setDoc(COLLECTIONS.LEDGER_TRANSACTIONS, sanitizedTransaction);
      
      // Update local storage with synced status
      const syncedTransaction = { ...transaction, syncStatus: 'synced' as const };
      const syncedTransactions = updatedTransactions.map((t) => (t.id === transaction.id ? syncedTransaction : t));
      await storage.set(STORAGE_KEYS.LEDGER_TRANSACTIONS, syncedTransactions);
      set({ transactions: syncedTransactions });
    } catch (error) {
      console.warn('Failed to sync payment transaction to Firebase:', error);
      // Keep as pending - will sync later
    }

    return transaction;
  },

  recordAdjustment: async (data) => {
    const { transactions } = get();
    const shopStore = useShopStore.getState();
    const authStore = useAuthStore.getState();
    
    const shop = shopStore.getShopById(data.shopId);
    if (!shop) {
      set({ error: 'Shop not found' });
      return null;
    }

    if (!data.notes || data.notes.trim() === '') {
      set({ error: 'Notes are required for adjustments' });
      return null;
    }

    const balanceBefore = shop.currentBalance;
    const balanceAfter = balanceBefore + data.amount;
    const regionId = shop.regionId || authStore.user?.regionId || '';

    const transaction: LedgerTransaction & { regionId?: string } = {
      id: uuidv4(),
      shopId: data.shopId,
      shopName: shop.shopName,
      type: 'ADJUSTMENT',
      amount: data.amount,
      balanceBefore,
      balanceAfter,
      collectedBy: authStore.user?.id,
      collectedByName: authStore.user?.name,
      notes: data.notes,
      date: new Date().toISOString(),
      regionId, // Include regionId for filtering
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    const updatedTransactions = [transaction, ...transactions];
    
    // Update shop balance
    await updateShopBalance(data.shopId, balanceAfter);
    
    // Save transactions
    await storage.set(STORAGE_KEYS.LEDGER_TRANSACTIONS, updatedTransactions);
    set({ transactions: updatedTransactions });

    // Sync to Firebase
    try {
      const { firestoreService } = await import('../services/firebase');
      const { COLLECTIONS } = await import('../services/firebase/collections');
      
      // Sanitize transaction to remove undefined values
      const { sanitizeForFirebase } = await import('../utils/dataSanitizers');
      const sanitizedTransaction = sanitizeForFirebase({
        ...transaction,
        syncStatus: 'synced',
      });
      
      await firestoreService.setDoc(COLLECTIONS.LEDGER_TRANSACTIONS, sanitizedTransaction);
      
      // Update local storage with synced status
      const syncedTransaction = { ...transaction, syncStatus: 'synced' as const };
      const syncedTransactions = updatedTransactions.map((t) => (t.id === transaction.id ? syncedTransaction : t));
      await storage.set(STORAGE_KEYS.LEDGER_TRANSACTIONS, syncedTransactions);
      set({ transactions: syncedTransactions });
    } catch (error) {
      console.warn('Failed to sync adjustment transaction to Firebase:', error);
      // Keep as pending - will sync later
    }

    return transaction;
  },

  getShopTransactions: (shopId, limit) => {
    const { transactions } = get();
    // Filter by both party_id (new structure) and shopId (legacy) for compatibility
    const filtered = transactions
      .filter(t => {
        const transactionShopId = (t as any).party_id || t.shopId;
        return transactionShopId === shopId;
      })
      .sort((a, b) => {
        // Sort by created_at (new) or date (legacy), most recent first
        const dateA = new Date((a as any).created_at || a.date || a.createdAt).getTime();
        const dateB = new Date((b as any).created_at || b.date || b.createdAt).getTime();
        return dateB - dateA;
      });
    
    return limit ? filtered.slice(0, limit) : filtered;
  },

  getFilteredTransactions: (filter) => {
    const { transactions } = get();
    
    return transactions.filter(t => {
      if (filter.shopId && t.shopId !== filter.shopId) return false;
      if (filter.type && t.type !== filter.type) return false;
      if (filter.startDate && new Date(t.date) < new Date(filter.startDate)) return false;
      if (filter.endDate && new Date(t.date) > new Date(filter.endDate)) return false;
      if (filter.minAmount && Math.abs(t.amount) < filter.minAmount) return false;
      if (filter.maxAmount && Math.abs(t.amount) > filter.maxAmount) return false;
      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  getShopCreditSummary: (shopId) => {
    const { transactions } = get();
    const shopStore = useShopStore.getState();
    
    const shop = shopStore.getShopById(shopId);
    if (!shop) return null;

    const shopTransactions = transactions.filter(t => t.shopId === shopId);
    
    const totalSales = shopTransactions
      .filter(t => t.type === 'SALE')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    const totalPayments = shopTransactions
      .filter(t => t.type === 'PAYMENT')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const lastTransaction = shopTransactions
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

    return {
      shopId,
      shopName: shop.shopName,
      creditLimit: shop.creditLimit,
      currentBalance: shop.currentBalance,
      availableCredit: shop.creditLimit - shop.currentBalance,
      lastTransactionDate: lastTransaction?.date,
      totalSales,
      totalPayments,
      transactionCount: shopTransactions.length,
    };
  },

  getLedgerStats: () => {
    const shopStore = useShopStore.getState();
    const { transactions } = get();
    const shops = shopStore.shops;
    
    const today = new Date().toISOString().split('T')[0];
    const todayTransactions = transactions.filter(t => 
      t.date.split('T')[0] === today
    );

    const totalOutstanding = shops
      .filter(s => s.currentBalance > 0)
      .reduce((sum, s) => sum + s.currentBalance, 0);

    const totalAdvances = shops
      .filter(s => s.currentBalance < 0)
      .reduce((sum, s) => sum + Math.abs(s.currentBalance), 0);

    const shopsWithCredit = shops.filter(s => s.currentBalance > 0).length;
    const shopsWithAdvance = shops.filter(s => s.currentBalance < 0).length;

    const todayCollections = todayTransactions
      .filter(t => t.type === 'PAYMENT')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const todaySales = todayTransactions
      .filter(t => t.type === 'SALE')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    return {
      totalOutstanding,
      totalAdvances,
      shopsWithCredit,
      shopsWithAdvance,
      todayCollections,
      todaySales,
    };
  },

  getShopsWithBalance: () => {
    const shopStore = useShopStore.getState();
    return shopStore.shops
      .filter(s => s.currentBalance !== 0)
      .sort((a, b) => b.currentBalance - a.currentBalance);
  },

  clearTransactions: async () => {
    await storage.remove(STORAGE_KEYS.LEDGER_TRANSACTIONS);
    set({ transactions: [] });
  },
}));


