import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { Bill, BillPaymentStatus, BillCreditStatus, generateBillNumber } from '../types/bill';
import { storage, STORAGE_KEYS } from '../services/storage/asyncStorage';

interface BillState {
  bills: Bill[];
  isLoading: boolean;
  error: string | null;
}

interface BillActions {
  loadBills: () => Promise<void>;
  createBill: (billData: Omit<Bill, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus'>) => Promise<Bill | null>;
  updateBillStatus: (billId: string, paidAmount: number, remainingCredit: number) => Promise<boolean>;
  getBillById: (id: string) => Bill | undefined;
  getBillByOrder: (orderId: string) => Bill | undefined;
  getBillsByBooker: (bookerId: string) => Bill[];
  getBillsBySalesman: (salesmanId: string) => Bill[];
  getBillsByShop: (shopId: string) => Bill[];
  getBillsByStatus: (paymentStatus: BillPaymentStatus) => Bill[];
  getPendingCreditBills: (salesmanId?: string) => Bill[];
  getShopBalance: (shopId: string) => number;
}

type BillStore = BillState & BillActions;

export const useBillStore = create<BillStore>((set, get) => ({
  // Initial state
  bills: [],
  isLoading: false,
  error: null,

  // Actions
  loadBills: async () => {
    set({ isLoading: true, error: null });

    try {
      // Try Firebase first
      try {
        const { firestoreService } = await import('../services/firebase');
        const { COLLECTIONS } = await import('../services/firebase/collections');
        const { useAuthStore } = await import('./authStore');
        
        const currentUser = useAuthStore.getState().user;
        let billsList: Bill[] = [];
        
        if (currentUser?.role === 'admin' || currentUser?.role === 'owner') {
          // Admin/Owner can see all bills
          billsList = await firestoreService.getDocs<Bill>(COLLECTIONS.BILLS);
        } else if (currentUser?.regionId) {
          // KPO/Salesman see bills in their region
          billsList = await firestoreService.getDocsWhere<Bill>(
            COLLECTIONS.BILLS,
            'regionId',
            '==',
            currentUser.regionId
          );
        }
        
        // Sort by billedAt descending (most recent first)
        billsList.sort((a, b) => 
          new Date(b.billedAt).getTime() - new Date(a.billedAt).getTime()
        );

        // Update local storage cache
        await storage.set(STORAGE_KEYS.BILLS, billsList);
        set({ bills: billsList, isLoading: false });
      } catch (firebaseError) {
        console.warn('Firebase load failed, trying local storage:', firebaseError);
        
        // Fallback to local storage
        const storedBills = await storage.get<Bill[]>(STORAGE_KEYS.BILLS);
        const billsList = storedBills || [];
        set({ bills: billsList, isLoading: false });
      }
    } catch (error) {
      set({
        error: 'Failed to load bills',
        isLoading: false,
      });
    }
  },

  createBill: async (billData) => {
    const { bills } = get();
    
    // Check if bill already exists for this order
    const existingBill = bills.find(b => b.orderId === billData.orderId);
    if (existingBill) {
      console.warn('Bill already exists for order:', billData.orderId);
      return existingBill;
    }

    const newBill: Bill = {
      ...billData,
      id: uuidv4(),
      billNumber: billData.billNumber || generateBillNumber(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    const updatedBills = [...bills, newBill];
    await storage.set(STORAGE_KEYS.BILLS, updatedBills);
    set({ bills: updatedBills });

    // Try to sync to Firebase
    try {
      const { firestoreService } = await import('../services/firebase');
      const { COLLECTIONS } = await import('../services/firebase/collections');
      const { sanitizeForFirebase } = await import('../utils/dataSanitizers');
      
      const sanitizedBill = sanitizeForFirebase({
        ...newBill,
        syncStatus: 'synced',
      });
      
      await firestoreService.setDoc(COLLECTIONS.BILLS, sanitizedBill);
      
      // Update local storage with synced status
      const syncedBill = { ...newBill, syncStatus: 'synced' as const };
      const syncedBills = updatedBills.map(b => (b.id === newBill.id ? syncedBill : b));
      await storage.set(STORAGE_KEYS.BILLS, syncedBills);
      set({ bills: syncedBills });
    } catch (error) {
      console.warn('Failed to sync bill to Firebase:', error);
      // Keep as pending - will sync later
    }

    return newBill;
  },

  updateBillStatus: async (billId, paidAmount, remainingCredit) => {
    const { bills } = get();
    const billIndex = bills.findIndex(b => b.id === billId);

    if (billIndex === -1) {
      set({ error: 'Bill not found' });
      return false;
    }

    const existingBill = bills[billIndex];
    
    // Determine payment status
    let paymentStatus: BillPaymentStatus;
    let creditStatus: BillCreditStatus;
    
    if (remainingCredit === 0) {
      paymentStatus = 'PAID';
      creditStatus = 'NONE';
    } else if (paidAmount > 0 && remainingCredit > 0) {
      paymentStatus = 'PARTIALLY_PAID';
      creditStatus = remainingCredit === existingBill.totalAmount ? 'FULL_CREDIT' : 'PARTIAL';
    } else {
      paymentStatus = 'UNPAID';
      creditStatus = 'FULL_CREDIT';
    }

    const updatedBill: Bill = {
      ...existingBill,
      paidAmount,
      remainingCredit,
      paymentStatus,
      creditStatus,
      paidAt: remainingCredit === 0 ? new Date().toISOString() : existingBill.paidAt,
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    const updatedBills = bills.map((b, index) =>
      index === billIndex ? updatedBill : b
    );
    await storage.set(STORAGE_KEYS.BILLS, updatedBills);
    set({ bills: updatedBills });

    // Try to sync to Firebase
    try {
      const { firestoreService } = await import('../services/firebase');
      const { COLLECTIONS } = await import('../services/firebase/collections');
      
      await firestoreService.updateDoc(COLLECTIONS.BILLS, billId, {
        paidAmount,
        remainingCredit,
        paymentStatus,
        creditStatus,
        paidAt: updatedBill.paidAt,
        updatedAt: updatedBill.updatedAt,
        syncStatus: 'synced',
      });
      
      const syncedBill = { ...updatedBill, syncStatus: 'synced' as const };
      const syncedBills = updatedBills.map(b => (b.id === billId ? syncedBill : b));
      await storage.set(STORAGE_KEYS.BILLS, syncedBills);
      set({ bills: syncedBills });
    } catch (error) {
      console.warn('Failed to sync bill update to Firebase:', error);
      // Keep as pending - will sync later
    }

    return true;
  },

  getBillById: (id) => {
    const { bills } = get();
    return bills.find(b => b.id === id);
  },

  getBillByOrder: (orderId) => {
    const { bills } = get();
    return bills.find(b => b.orderId === orderId);
  },

  getBillsByBooker: (bookerId) => {
    const { bills } = get();
    return bills.filter(b => b.bookerId === bookerId)
      .sort((a, b) => new Date(b.billedAt).getTime() - new Date(a.billedAt).getTime());
  },

  getBillsBySalesman: (salesmanId) => {
    const { bills } = get();
    return bills.filter(b => b.salesmanId === salesmanId)
      .sort((a, b) => new Date(b.billedAt).getTime() - new Date(a.billedAt).getTime());
  },

  getBillsByShop: (shopId) => {
    const { bills } = get();
    return bills.filter(b => b.shopId === shopId)
      .sort((a, b) => new Date(b.billedAt).getTime() - new Date(a.billedAt).getTime());
  },

  getBillsByStatus: (paymentStatus) => {
    const { bills } = get();
    return bills.filter(b => b.paymentStatus === paymentStatus)
      .sort((a, b) => new Date(b.billedAt).getTime() - new Date(a.billedAt).getTime());
  },

  getPendingCreditBills: (salesmanId) => {
    const { bills } = get();
    let filteredBills = bills.filter(b => 
      b.paymentStatus !== 'PAID' && b.remainingCredit > 0
    );
    
    if (salesmanId) {
      filteredBills = filteredBills.filter(b => b.salesmanId === salesmanId);
    }
    
    return filteredBills.sort((a, b) => 
      new Date(b.billedAt).getTime() - new Date(a.billedAt).getTime()
    );
  },

  getShopBalance: (shopId) => {
    const { bills } = get();
    // Sum all remainingCredit from unpaid bills for this shop
    const shopBills = bills.filter(b => 
      b.shopId === shopId && b.paymentStatus !== 'PAID' && b.remainingCredit > 0
    );
    return shopBills.reduce((sum, bill) => sum + (bill.remainingCredit || 0), 0);
  },
}));

