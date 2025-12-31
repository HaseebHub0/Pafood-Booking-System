import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { StockReturn, ReturnFormData, ReturnStatus, generateReturnNumber } from '../types/return';
import { storage, STORAGE_KEYS } from '../services/storage/asyncStorage';
import { useAuthStore } from './authStore';
import { useShopStore } from './shopStore';
import { useProductStore } from './productStore';
import { getCurrentLocation } from '../services/location';

interface ReturnState {
  returns: StockReturn[];
  currentReturn: StockReturn | null;
  isLoading: boolean;
  error: string | null;
}

interface ReturnActions {
  loadReturns: () => Promise<void>;
  createReturn: (data: ReturnFormData) => Promise<StockReturn>;
  updateReturnStatus: (id: string, status: ReturnStatus, notes?: string) => Promise<boolean>;
  markCollected: (id: string) => Promise<boolean>;
  markReceived: (id: string, receivedBy: string, notes?: string) => Promise<boolean>;
  approveReturn: (id: string, approvedBy: string) => Promise<boolean>;
  rejectReturn: (id: string, rejectedBy: string, reason: string) => Promise<boolean>;
  getReturnById: (id: string) => StockReturn | undefined;
  getReturnsByShop: (shopId: string) => StockReturn[];
  getReturnsByStatus: (status: ReturnStatus) => StockReturn[];
  getPendingReturns: () => StockReturn[];
  setCurrentReturn: (returnItem: StockReturn | null) => void;
}

type ReturnStore = ReturnState & ReturnActions;

export const useReturnStore = create<ReturnStore>((set, get) => ({
  // Initial state
  returns: [],
  currentReturn: null,
  isLoading: false,
  error: null,

  // Actions
  loadReturns: async () => {
    set({ isLoading: true, error: null });

    try {
      const currentUser = useAuthStore.getState().user;
      if (!currentUser) {
        set({ returns: [], isLoading: false });
        return;
      }

      let returnsList: StockReturn[] = [];

      // Try to fetch from Firebase first (for real-time status updates)
      try {
        const { firestoreService } = await import('../services/firebase');
        const { COLLECTIONS } = await import('../services/firebase/collections');
        
        // Fetch returns from Firebase
        const firebaseReturns = await firestoreService.getDocsWhere<StockReturn>(
          COLLECTIONS.STOCK_RETURNS,
          currentUser.role === 'salesman' ? 'salesmanId' : 'shopId',
          '==',
          currentUser.role === 'salesman' ? currentUser.id : (currentUser.branch || '')
        );

        // Convert Firebase returns to app format
        returnsList = firebaseReturns.map((ret: any) => {
          // Convert Timestamps to ISO strings
          const converted: StockReturn = {
            id: ret.id,
            returnNumber: ret.returnNumber || '',
            shopId: ret.shopId || '',
            shopName: ret.shopName || '',
            ownerName: ret.ownerName || '',
            items: ret.items || [],
            totalValue: ret.totalValue || 0,
            status: ret.status || 'pending_kpo_approval',
            salesmanId: ret.salesmanId || '',
            salesmanName: ret.salesmanName || '',
            notes: ret.notes || '',
            shopNotes: ret.shopNotes || '',
            approvedBy: ret.approvedBy,
            approvedAt: ret.approvedAt?.toDate ? ret.approvedAt.toDate().toISOString() : ret.approvedAt,
            rejectedBy: ret.rejectedBy,
            rejectionReason: ret.rejectionReason,
            collectedAt: ret.collectedAt?.toDate ? ret.collectedAt.toDate().toISOString() : ret.collectedAt,
            receivedAt: ret.receivedAt?.toDate ? ret.receivedAt.toDate().toISOString() : ret.receivedAt,
            receivedBy: ret.receivedBy,
            warehouseNotes: ret.warehouseNotes,
            createdAt: ret.createdAt?.toDate ? ret.createdAt.toDate().toISOString() : ret.createdAt || new Date().toISOString(),
            updatedAt: ret.updatedAt?.toDate ? ret.updatedAt.toDate().toISOString() : ret.updatedAt || new Date().toISOString(),
            syncStatus: 'synced',
          };
          return converted;
        });

        // Filter by salesman if needed
        if (currentUser.role === 'salesman') {
          returnsList = returnsList.filter((r) => r.salesmanId === currentUser.id);
        } else if (currentUser.role === 'kpo' && currentUser.branch) {
          // KPO sees returns in their branch
          returnsList = returnsList.filter((r) => r.branch === currentUser.branch);
        }

        // Cache in local storage
        await storage.set(STORAGE_KEYS.RETURNS, returnsList);
        console.log(`Loaded ${returnsList.length} returns from Firebase`);
      } catch (firebaseError: any) {
        console.warn('Firebase load failed, using local storage:', firebaseError.message);
        
        // Fallback to local storage
        const storedReturns = await storage.get<StockReturn[]>(STORAGE_KEYS.RETURNS);
        returnsList = storedReturns || [];

        // Filter by role and region
        if (currentUser) {
          const shopStore = useShopStore.getState();
          returnsList = returnsList.filter((r) => {
            // Salesman sees only their returns
            if (currentUser.role === 'salesman' && r.salesmanId !== currentUser.id) {
              return false;
            }
            // Check region
            const shop = shopStore.getShopById(r.shopId);
            if (shop && currentUser.role !== 'admin' && currentUser.role !== 'owner') {
              return shop.regionId === currentUser.regionId;
            }
            return true;
          });
        }
      }

      set({ returns: returnsList, isLoading: false });
    } catch (error: any) {
      console.error('Error loading returns:', error);
      set({
        error: error.message || 'Failed to load returns',
        isLoading: false,
      });
    }
  },

  createReturn: async (data) => {
    const { returns } = get();
    const currentUser = useAuthStore.getState().user;
    const shopStore = useShopStore.getState();
    const productStore = useProductStore.getState();

    const shop = shopStore.getShopById(data.shopId);
    if (!shop) {
      set({ error: 'Shop not found' });
      throw new Error('Shop not found');
    }

    // Calculate total value and enrich items with product names
    const enrichedItems = data.items.map((item) => {
      const product = productStore.getProductById(item.productId);
      return {
        ...item,
        productName: product?.nameEn || product?.name || 'Unknown Product',
        productNameUrdu: product?.name,
      };
    });

    const totalValue = enrichedItems.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );

    const newReturn: StockReturn = {
      id: uuidv4(),
      returnNumber: generateReturnNumber(),
      shopId: shop.id,
      shopName: shop.shopName,
      ownerName: shop.ownerName,
      items: enrichedItems,
      totalValue,
      status: 'pending_kpo_approval', // Requires KPO approval
      salesmanId: currentUser?.id || '',
      salesmanName: currentUser?.name || '',
      notes: data.notes || '',
      shopNotes: data.shopNotes || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    const updatedReturns = [...returns, newReturn];
    await storage.set(STORAGE_KEYS.RETURNS, updatedReturns);
    set({ returns: updatedReturns, currentReturn: newReturn });

    // Sync to Firebase for KPO approval
    try {
      const { firestoreService } = await import('../services/firebase');
      const { COLLECTIONS } = await import('../services/firebase/collections');
      
      // Sanitize return to remove undefined values
      const { sanitizeForFirebase } = await import('../utils/dataSanitizers');
      const sanitizedReturn = sanitizeForFirebase({
        ...newReturn,
        regionId: shop.regionId || currentUser?.regionId || '',
        branch: shop.branch || currentUser?.branch || '',
        syncStatus: 'synced',
      });
      
      await firestoreService.setDoc(COLLECTIONS.STOCK_RETURNS, sanitizedReturn);
      
      // Update local with synced status
      const syncedReturn = { ...newReturn, syncStatus: 'synced' as const };
      const syncedReturns = updatedReturns.map((r) => (r.id === newReturn.id ? syncedReturn : r));
      await storage.set(STORAGE_KEYS.RETURNS, syncedReturns);
      set({ returns: syncedReturns, currentReturn: syncedReturn });
      
      console.log('Return synced to Firebase:', newReturn.id);
    } catch (error) {
      console.warn('Failed to sync return to Firebase:', error);
      // Keep as pending - will sync later
    }

    return newReturn;
  },

  updateReturnStatus: async (id, status, notes) => {
    const { returns } = get();
    const returnIndex = returns.findIndex((r) => r.id === id);
    if (returnIndex === -1) return false;

    const updatedReturn: StockReturn = {
      ...returns[returnIndex],
      status,
      notes: notes || returns[returnIndex].notes,
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    const updatedReturns = returns.map((r, index) =>
      index === returnIndex ? updatedReturn : r
    );
    await storage.set(STORAGE_KEYS.RETURNS, updatedReturns);
    set({ returns: updatedReturns });

    return true;
  },

  markCollected: async (id) => {
    const { returns } = get();
    const returnIndex = returns.findIndex((r) => r.id === id);
    if (returnIndex === -1) return false;

    const location = await getCurrentLocation();

    const updatedReturn: StockReturn = {
      ...returns[returnIndex],
      collectedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    const updatedReturns = returns.map((r, index) =>
      index === returnIndex ? updatedReturn : r
    );
    await storage.set(STORAGE_KEYS.RETURNS, updatedReturns);
    set({ returns: updatedReturns });

    return true;
  },

  markReceived: async (id, receivedBy, notes) => {
    const { returns } = get();
    const returnIndex = returns.findIndex((r) => r.id === id);
    if (returnIndex === -1) return false;

    const updatedReturn: StockReturn = {
      ...returns[returnIndex],
      status: 'processed',
      receivedAt: new Date().toISOString(),
      receivedBy,
      warehouseNotes: notes,
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    const updatedReturns = returns.map((r, index) =>
      index === returnIndex ? updatedReturn : r
    );
    await storage.set(STORAGE_KEYS.RETURNS, updatedReturns);
    set({ returns: updatedReturns });

    return true;
  },

  approveReturn: async (id, approvedBy) => {
    const { returns } = get();
    const returnIndex = returns.findIndex((r) => r.id === id);
    if (returnIndex === -1) return false;

    const updatedReturn: StockReturn = {
      ...returns[returnIndex],
      status: 'approved',
      approvedBy,
      approvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    const updatedReturns = returns.map((r, index) =>
      index === returnIndex ? updatedReturn : r
    );
    await storage.set(STORAGE_KEYS.RETURNS, updatedReturns);
    set({ returns: updatedReturns });

    return true;
  },

  rejectReturn: async (id, rejectedBy, reason) => {
    const { returns } = get();
    const returnIndex = returns.findIndex((r) => r.id === id);
    if (returnIndex === -1) return false;

    const updatedReturn: StockReturn = {
      ...returns[returnIndex],
      status: 'rejected',
      approvedBy: rejectedBy, // Reusing field for rejectedBy
      approvedAt: new Date().toISOString(),
      rejectionReason: reason,
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    const updatedReturns = returns.map((r, index) =>
      index === returnIndex ? updatedReturn : r
    );
    await storage.set(STORAGE_KEYS.RETURNS, updatedReturns);
    set({ returns: updatedReturns });

    return true;
  },

  getReturnById: (id) => {
    return get().returns.find((returnItem) => returnItem.id === id);
  },

  getReturnsByShop: (shopId) => {
    return get()
      .returns.filter((returnItem) => returnItem.shopId === shopId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  getReturnsByStatus: (status) => {
    return get().returns.filter((returnItem) => returnItem.status === status);
  },

  getPendingReturns: () => {
    return get().returns.filter(
      (returnItem) => returnItem.status === 'pending' || returnItem.status === 'approved'
    );
  },

  setCurrentReturn: (returnItem) => {
    set({ currentReturn: returnItem });
  },
}));

