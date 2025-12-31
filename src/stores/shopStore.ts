import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { Shop, ShopFormData } from '../types';
import { storage, STORAGE_KEYS } from '../services/storage/asyncStorage';
import { useAuthStore } from './authStore';
import { useSyncStore } from './syncStore';

interface ShopState {
  shops: Shop[];
  allShops: Shop[];  // All shops before filtering
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
  getMyShops: () => Shop[];  // Get shops for current user
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
        const { firestoreService } = await import('../services/firebase');
        const { COLLECTIONS } = await import('../services/firebase/collections');
        
        let shopsList: Shop[] = [];
        
        if (currentUser?.role === 'booker') {
          // Get shops for current booker
          shopsList = await firestoreService.getDocsWhere<Shop>(
            COLLECTIONS.SHOPS,
            'bookerId',
            '==',
            currentUser.id
          );
        } else if (currentUser?.role === 'admin' || currentUser?.role === 'owner') {
          // Admin/Owner can see all shops
          shopsList = await firestoreService.getDocs<Shop>(COLLECTIONS.SHOPS);
        } else if (currentUser?.role === 'kpo') {
          // KPO can see shops in their region
          shopsList = await firestoreService.getDocsWhere<Shop>(
            COLLECTIONS.SHOPS,
            'regionId',
            '==',
            currentUser.regionId
          );
        } else if (currentUser?.role?.toLowerCase() === 'salesman') {
          // Salesman can see shops in their branch (same branch as bookers)
          console.log('Loading shops for salesman:', currentUser.id, 'branch:', currentUser.branch, 'regionId:', currentUser.regionId);
          if (currentUser?.branch) {
            // Filter by branch first (preferred)
            shopsList = await firestoreService.getDocsWhere<Shop>(
              COLLECTIONS.SHOPS,
              'branch',
              '==',
              currentUser.branch
            );
            console.log(`Found ${shopsList.length} shops in branch "${currentUser.branch}"`);
          } else if (currentUser?.regionId) {
            // Fallback to region if branch not available
            shopsList = await firestoreService.getDocsWhere<Shop>(
              COLLECTIONS.SHOPS,
              'regionId',
              '==',
              currentUser.regionId
            );
            console.log(`Found ${shopsList.length} shops in region "${currentUser.regionId}"`);
          } else {
            console.warn('Salesman has no branch or regionId, loading all shops');
            shopsList = await firestoreService.getDocs<Shop>(COLLECTIONS.SHOPS);
          }
          console.log('Total shops found for salesman:', shopsList.length);
        } else {
          // Unknown role - no shops
          shopsList = [];
        }

        // Migrate old shops that don't have shopId - generate from id if missing
        const migratedShops = shopsList.map((shop) => {
          if (!shop.shopId) {
            // Generate shopId from existing id (first 8 chars) or use a default
            return {
              ...shop,
              shopId: shop.id.substring(0, 8).toUpperCase() || `SHOP-${Date.now()}`,
            };
          }
          return shop;
        });

        // Update local storage cache
        await storage.set(STORAGE_KEYS.SHOPS, migratedShops);

        // Filter shops by current user's role and region
        let filteredShops = migratedShops;
        if (currentUser) {
          if (currentUser.role?.toLowerCase() === 'booker') {
            // Booker sees only their shops
            filteredShops = migratedShops.filter((shop) => 
              shop.bookerId === currentUser.id && 
              (shop.regionId === currentUser.regionId || shop.city === currentUser.region)
            );
          } else if (currentUser.role?.toLowerCase() === 'kpo') {
            // KPO see shops in their region
            filteredShops = migratedShops.filter((shop) => 
              shop.regionId === currentUser.regionId || shop.city === currentUser.region
            );
          } else if (currentUser.role?.toLowerCase() === 'salesman') {
            // Salesman see only shops from assigned bookers
            try {
              const { useMappingStore } = await import('./mappingStore');
              const mappingStore = useMappingStore.getState();
              await mappingStore.loadMappings();
              const assignedBookerIds = mappingStore.getBookersForSalesman(currentUser.id);
              
              if (assignedBookerIds.length > 0) {
                filteredShops = migratedShops.filter((shop) => assignedBookerIds.includes(shop.bookerId));
                console.log(`Filtered shops for salesman: ${filteredShops.length} shops from ${assignedBookerIds.length} assigned bookers`);
              } else {
                // No bookers assigned - show no shops
                filteredShops = [];
                console.log('No bookers assigned to salesman, showing no shops');
              }
            } catch (error) {
              console.warn('Failed to load mappings for shop filtering, falling back to branch:', error);
              // Fallback to branch-based filtering
              filteredShops = migratedShops.filter((shop) => {
                if (currentUser.branch) {
                  return shop.branch === currentUser.branch;
                }
                // Fallback to region if branch not available
                return shop.regionId === currentUser.regionId || shop.city === currentUser.region;
              });
            }
          }
          // Admin/Owner sees all (no filtering)
        }

        set({ 
          allShops: migratedShops,
          shops: filteredShops,
          isLoading: false 
        });
      } catch (firebaseError) {
        console.warn('Firebase load failed, trying local storage:', firebaseError);
        
        // Fallback to local storage
        const storedShops = await storage.get<Shop[]>(STORAGE_KEYS.SHOPS);
        const shopsList = storedShops || [];

        // Migrate old shops that don't have shopId - generate from id if missing
        const migratedShops = shopsList.map((shop) => {
          if (!shop.shopId) {
            // Generate shopId from existing id (first 8 chars) or use a default
            return {
              ...shop,
              shopId: shop.id.substring(0, 8).toUpperCase() || `SHOP-${Date.now()}`,
            };
          }
          return shop;
        });

        // Filter shops by current user's role and region
        let filteredShops = migratedShops;
        if (currentUser) {
          if (currentUser.role?.toLowerCase() === 'booker') {
            // Booker sees only their shops
            filteredShops = migratedShops.filter((shop) => 
              shop.bookerId === currentUser.id && 
              (shop.regionId === currentUser.regionId || shop.city === currentUser.region)
            );
          } else if (currentUser.role?.toLowerCase() === 'kpo') {
            // KPO see shops in their region
            filteredShops = migratedShops.filter((shop) => 
              shop.regionId === currentUser.regionId || shop.city === currentUser.region
            );
          } else if (currentUser.role?.toLowerCase() === 'salesman') {
            // Salesman see shops in their branch (same branch as bookers)
            filteredShops = migratedShops.filter((shop) => {
              if (currentUser.branch) {
                return shop.branch === currentUser.branch;
              }
              // Fallback to region if branch not available
              return shop.regionId === currentUser.regionId || shop.city === currentUser.region;
            });
          }
          // Admin/Owner sees all (no filtering)
        }

        set({
          allShops: migratedShops,
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

    console.log('addShop: Current user:', currentUser?.id, 'Role:', currentUser?.role);

    if (!currentUser || currentUser.role?.toLowerCase() !== 'booker') {
      console.error('addShop: Unauthorized. User role is:', currentUser?.role);
      throw new Error('Only bookers can create shops');
    }

    // Validate manual Shop ID
    if (!data.shopId || !data.shopId.trim()) {
      throw new Error('Shop ID is required');
    }

    // Check if Shop ID already exists
    const existingShop = allShops.find((s) => s.shopId?.toLowerCase() === data.shopId.trim().toLowerCase());
    if (existingShop) {
      console.warn('addShop: Shop ID already exists:', data.shopId);
      throw new Error(`Shop ID "${data.shopId}" already exists`);
    }

    const newShop: Shop = {
      id: uuidv4(), // Internal ID (for database)
      shopId: data.shopId.trim(), // Manual Shop ID (required by client)
      shopName: data.shopName,
      ownerName: data.ownerName,
      phone: data.phone,
      address: data.address,
      area: data.area,
      city: data.city,
      bookerId: currentUser.id,
      bookerName: currentUser.name || currentUser.email || 'Unknown', // Admin tracking: who created this shop
      regionId: currentUser.regionId || 'Unknown', // Inherit region from booker
      branch: currentUser.branch || undefined, // Inherit branch from booker
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    console.log('addShop: Creating new shop object:', JSON.stringify(newShop));

    // Save to local storage first (for offline support)
    const updatedAllShops = [...allShops, newShop];
    
    // Determine if this new shop should be in the current filtered view
    let shouldBeInFiltered = true;
    if (currentUser.role?.toLowerCase() === 'booker') {
      shouldBeInFiltered = newShop.bookerId === currentUser.id;
    } else if (currentUser.role?.toLowerCase() === 'kpo' || currentUser.role?.toLowerCase() === 'salesman') {
      shouldBeInFiltered = newShop.regionId === currentUser.regionId;
    }

    const updatedShops = shouldBeInFiltered ? [...shops, newShop] : shops;
    
    await storage.set(STORAGE_KEYS.SHOPS, updatedAllShops);
    set({ shops: updatedShops, allShops: updatedAllShops });

    // Check network status
    const { isOnline } = useSyncStore.getState();

    if (!isOnline) {
      // Offline: Add to sync queue for later
      console.log('addShop: Device is offline, adding to sync queue');
      useSyncStore.getState().addToQueue('CREATE', 'shop', newShop.id, newShop);
      return newShop; // Return early, don't try Firebase
    }

    // Online: Try to sync to Firebase immediately
    try {
      const { firestoreService } = await import('../services/firebase');
      const { COLLECTIONS } = await import('../services/firebase/collections');
      const { sanitizeForFirebase } = await import('../utils/dataSanitizers');
      
      console.log('addShop: Syncing to Firestore...');
      const sanitizedShop = sanitizeForFirebase({
        ...newShop,
        syncStatus: 'synced',
      });
      await firestoreService.setDoc(COLLECTIONS.SHOPS, sanitizedShop);
      console.log('addShop: Successfully synced to Firestore');
      
      // Update local storage with synced status
      const syncedShop = { ...newShop, syncStatus: 'synced' as const };
      const syncedAllShops = updatedAllShops.map((s) => (s.id === newShop.id ? syncedShop : s));
      const syncedShops = updatedShops.map((s) => (s.id === newShop.id ? syncedShop : s));
      await storage.set(STORAGE_KEYS.SHOPS, syncedAllShops);
      set({ shops: syncedShops, allShops: syncedAllShops });
    } catch (error) {
      console.warn('Failed to sync shop to Firebase:', error);
      // If sync fails, add to queue for retry
      useSyncStore.getState().addToQueue('CREATE', 'shop', newShop.id, newShop);
      // Keep as pending - will sync later
    }

    return newShop;
  },

  updateShop: async (id: string, data: Partial<ShopFormData>) => {
    const { shops, allShops } = get();

    const shopToUpdate = allShops.find(s => s.id === id);
    if (!shopToUpdate) return false;

    const updatedShop: Shop = {
      ...shopToUpdate,
            ...data,
            updatedAt: new Date().toISOString(),
      syncStatus: 'pending',
    };

    const updateFn = (shop: Shop) => shop.id === id ? updatedShop : shop;

    const updatedAllShops = allShops.map(updateFn);
    const updatedShops = shops.map(updateFn);

    set({ shops: updatedShops, allShops: updatedAllShops });
    await storage.set(STORAGE_KEYS.SHOPS, updatedAllShops);

    // Check network status
    const { isOnline } = useSyncStore.getState();

    if (!isOnline) {
      // Offline: Add to sync queue for later
      console.log('updateShop: Device is offline, adding to sync queue');
      useSyncStore.getState().addToQueue('UPDATE', 'shop', id, updatedShop);
      return true;
    }

    // Online: Try to sync to Firebase immediately
    try {
      const { firestoreService } = await import('../services/firebase');
      const { COLLECTIONS } = await import('../services/firebase/collections');
      const { sanitizeForFirebase } = await import('../utils/dataSanitizers');
      
      const sanitizedData = sanitizeForFirebase({
        ...data,
        updatedAt: updatedShop.updatedAt,
      });
      await firestoreService.updateDoc(COLLECTIONS.SHOPS, id, sanitizedData);
      
      // Update local storage with synced status
      const syncedShop = { ...updatedShop, syncStatus: 'synced' as const };
      const syncedAllShops = updatedAllShops.map((s) => (s.id === id ? syncedShop : s));
      const syncedShops = updatedShops.map((s) => (s.id === id ? syncedShop : s));
      await storage.set(STORAGE_KEYS.SHOPS, syncedAllShops);
      set({ shops: syncedShops, allShops: syncedAllShops });
    } catch (error) {
      console.warn('Failed to sync shop update to Firebase:', error);
      // If sync fails, add to queue for retry
      useSyncStore.getState().addToQueue('UPDATE', 'shop', id, updatedShop);
    }

    return true;
  },

  deleteShop: async (id: string) => {
    const { shops, allShops } = get();

    const shopToDelete = allShops.find((s) => s.id === id);
    if (!shopToDelete) return false;

    const updatedAllShops = allShops.filter((shop) => shop.id !== id);
    const updatedShops = shops.filter((shop) => shop.id !== id);

    set({ shops: updatedShops, allShops: updatedAllShops });
    await storage.set(STORAGE_KEYS.SHOPS, updatedAllShops);

    // Check network status
    const { isOnline } = useSyncStore.getState();

    if (!isOnline) {
      // Offline: Add to sync queue for later
      console.log('deleteShop: Device is offline, adding to sync queue');
      useSyncStore.getState().addToQueue('DELETE', 'shop', id, shopToDelete);
      return true;
    }

    // Online: Try to sync to Firebase immediately
    try {
      const { firestoreService } = await import('../services/firebase');
      const { COLLECTIONS } = await import('../services/firebase/collections');
      
      await firestoreService.deleteDoc(COLLECTIONS.SHOPS, id);
    } catch (error) {
      console.warn('Failed to sync shop deletion to Firebase:', error);
      // If sync fails, add to queue for retry
      useSyncStore.getState().addToQueue('DELETE', 'shop', id, shopToDelete);
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

  // Get shops for current user
  getMyShops: () => {
    const { allShops } = get();
    const currentUser = useAuthStore.getState().user;
    
    if (!currentUser) return allShops;
    
    return allShops.filter((shop) => shop.bookerId === currentUser.id);
  },
}));
