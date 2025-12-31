/**
 * EXAMPLE: How to update ShopStore to use Firebase
 * 
 * This is a reference implementation showing how to integrate Firebase
 * Replace the existing shopStore.ts with this pattern
 */

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { Shop, ShopFormData } from '../types/shop';
import { firestoreService } from '../services/firebase';
import { COLLECTIONS } from '../services/firebase/collections';
import { storage, STORAGE_KEYS } from '../services/storage/asyncStorage';
import { useAuthStore } from './authStore';
import { DEFAULT_CREDIT_LIMIT } from '../types/shop';

interface ShopState {
  shops: Shop[];
  allShops: Shop[];
  isLoading: boolean;
  error: string | null;
  selectedShop: Shop | null;
}

interface ShopActions {
  loadShops: () => Promise<void>;
  addShop: (data: ShopFormData) => Promise<Shop>;
  updateShop: (id: string, data: Partial<ShopFormData>) => Promise<boolean>;
  deleteShop: (id: string) => Promise<boolean>;
  selectShop: (shop: Shop | null) => void;
  getShopById: (id: string) => Shop | undefined;
  searchShops: (query: string) => Shop[];
  getMyShops: () => Shop[];
}

type ShopStore = ShopState & ShopActions;

export const useShopStore = create<ShopStore>((set, get) => ({
  // Initial state
  shops: [],
  allShops: [],
  isLoading: false,
  error: null,
  selectedShop: null,

  // Actions
  loadShops: async () => {
    set({ isLoading: true, error: null });

    try {
      const currentUser = useAuthStore.getState().user;
      
      // Try Firebase first
      try {
        let shopsList: Shop[] = [];
        
        if (currentUser?.role === 'booker') {
          // Get shops for current booker
          shopsList = await firestoreService.getDocsWhere<Shop>(
            COLLECTIONS.SHOPS,
            'bookerId',
            '==',
            currentUser.id
          );
        } else {
          // Admin/salesman can see all shops
          shopsList = await firestoreService.getDocs<Shop>(COLLECTIONS.SHOPS);
        }

        // Update local storage cache
        await storage.set(STORAGE_KEYS.SHOPS, shopsList);

        // Filter shops by current user's bookerId (visibility rule)
        const filteredShops = currentUser
          ? shopsList.filter((shop) => shop.bookerId === currentUser.id)
          : shopsList;

        set({
          allShops: shopsList,
          shops: filteredShops,
          isLoading: false,
        });
      } catch (firebaseError) {
        console.warn('Firebase load failed, trying local storage:', firebaseError);
        
        // Fallback to local storage
        const storedShops = await storage.get<Shop[]>(STORAGE_KEYS.SHOPS);
        const shopsList = storedShops || [];

        const filteredShops = currentUser
          ? shopsList.filter((shop) => shop.bookerId === currentUser.id)
          : shopsList;

        set({
          allShops: shopsList,
          shops: filteredShops,
          isLoading: false,
        });
      }
    } catch (error) {
      set({
        error: 'Failed to load shops',
        isLoading: false,
      });
    }
  },

  addShop: async (data: ShopFormData) => {
    const { shops, allShops } = get();
    const currentUser = useAuthStore.getState().user;

    const newShop: Shop = {
      id: uuidv4(),
      ...data,
      bookerId: currentUser?.id || 'booker_001',
      isActive: true,
      creditLimit: data.creditLimit || DEFAULT_CREDIT_LIMIT,
      currentBalance: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    // Save to local storage first (for offline support)
    const updatedAllShops = [...allShops, newShop];
    const updatedShops = [...shops, newShop];
    await storage.set(STORAGE_KEYS.SHOPS, updatedAllShops);
    set({ shops: updatedShops, allShops: updatedAllShops });

    // Try to sync to Firebase
    try {
      await firestoreService.setDoc(COLLECTIONS.SHOPS, {
        ...newShop,
        syncStatus: 'synced',
      });
      
      // Update local storage with synced status
      const syncedShop = { ...newShop, syncStatus: 'synced' as const };
      const syncedAllShops = allShops.map((s) => (s.id === newShop.id ? syncedShop : s));
      const syncedShops = shops.map((s) => (s.id === newShop.id ? syncedShop : s));
      await storage.set(STORAGE_KEYS.SHOPS, syncedAllShops);
      set({ shops: syncedShops, allShops: syncedAllShops });
    } catch (error) {
      console.warn('Failed to sync shop to Firebase:', error);
      // Keep as pending - will sync later
    }

    return newShop;
  },

  updateShop: async (id: string, data: Partial<ShopFormData>) => {
    const { shops, allShops } = get();

    const updateFn = (shop: Shop) =>
      shop.id === id
        ? {
            ...shop,
            ...data,
            updatedAt: new Date().toISOString(),
            syncStatus: 'pending' as const,
          }
        : shop;

    const updatedAllShops = allShops.map(updateFn);
    const updatedShops = shops.map(updateFn);

    // Update local storage
    await storage.set(STORAGE_KEYS.SHOPS, updatedAllShops);
    set({ shops: updatedShops, allShops: updatedAllShops });

    // Try to sync to Firebase
    try {
      const shop = updatedAllShops.find((s) => s.id === id);
      if (shop) {
        await firestoreService.updateDoc(COLLECTIONS.SHOPS, id, {
          ...data,
          syncStatus: 'synced',
          updatedAt: new Date().toISOString(),
        });

        // Update local storage with synced status
        const syncedShop = { ...shop, syncStatus: 'synced' as const };
        const syncedAllShops = allShops.map((s) => (s.id === id ? syncedShop : s));
        const syncedShops = shops.map((s) => (s.id === id ? syncedShop : s));
        await storage.set(STORAGE_KEYS.SHOPS, syncedAllShops);
        set({ shops: syncedShops, allShops: syncedAllShops });
      }
    } catch (error) {
      console.warn('Failed to sync shop update to Firebase:', error);
    }

    return true;
  },

  deleteShop: async (id: string) => {
    const { shops, allShops } = get();

    const updatedAllShops = allShops.filter((shop) => shop.id !== id);
    const updatedShops = shops.filter((shop) => shop.id !== id);

    await storage.set(STORAGE_KEYS.SHOPS, updatedAllShops);
    set({ shops: updatedShops, allShops: updatedAllShops });

    // Try to delete from Firebase
    try {
      await firestoreService.deleteDoc(COLLECTIONS.SHOPS, id);
    } catch (error) {
      console.warn('Failed to delete shop from Firebase:', error);
    }

    return true;
  },

  selectShop: (shop: Shop | null) => {
    set({ selectedShop: shop });
  },

  getShopById: (id: string) => {
    return get().shops.find((shop) => shop.id === id);
  },

  searchShops: (query: string) => {
    const { shops } = get();
    const lowerQuery = query.toLowerCase();

    return shops.filter(
      (shop) =>
        shop.shopName.toLowerCase().includes(lowerQuery) ||
        shop.ownerName.toLowerCase().includes(lowerQuery) ||
        shop.area.toLowerCase().includes(lowerQuery) ||
        shop.city.toLowerCase().includes(lowerQuery)
    );
  },

  getMyShops: () => {
    const { allShops } = get();
    const currentUser = useAuthStore.getState().user;

    if (!currentUser) return allShops;

    return allShops.filter((shop) => shop.bookerId === currentUser.id);
  },
}));

