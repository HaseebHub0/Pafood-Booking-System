import { create } from 'zustand';
import { SalesmanBookerMapping, MappingFormData } from '../types/mapping';
import { storage, STORAGE_KEYS } from '../services/storage/asyncStorage';
import { useAuthStore } from './authStore';

interface MappingState {
  mappings: SalesmanBookerMapping[];
  isLoading: boolean;
  error: string | null;
}

interface MappingActions {
  loadMappings: () => Promise<void>;
  getMappingByBooker: (bookerId: string) => SalesmanBookerMapping | null;
  getMappingBySalesman: (salesmanId: string) => SalesmanBookerMapping | null;
  getSalesmanForBooker: (bookerId: string) => string | null; // Returns salesmanId
}

type MappingStore = MappingState & MappingActions;

export const useMappingStore = create<MappingStore>((set, get) => ({
  // Initial state
  mappings: [],
  isLoading: false,
  error: null,

  // Actions
  loadMappings: async () => {
    set({ isLoading: true, error: null });

    try {
      const currentUser = useAuthStore.getState().user;
      
      // Try Firebase first
      try {
        const { firestoreService } = await import('../services/firebase');
        const { COLLECTIONS } = await import('../services/firebase/collections');
        
        let mappingsList: SalesmanBookerMapping[] = [];
        
        if (currentUser?.role === 'kpo') {
          // KPO can see mappings in their region
          mappingsList = await firestoreService.getDocsWhere<SalesmanBookerMapping>(
            COLLECTIONS.MAPPINGS,
            'regionId',
            '==',
            currentUser.regionId
          );
        } else if (currentUser?.role === 'admin' || currentUser?.role === 'owner') {
          // Admin/Owner can see all mappings
          mappingsList = await firestoreService.getDocs<SalesmanBookerMapping>(COLLECTIONS.MAPPINGS);
        } else {
          // Salesman can see their own mapping
          mappingsList = await firestoreService.getDocsWhere<SalesmanBookerMapping>(
            COLLECTIONS.MAPPINGS,
            'salesmanId',
            '==',
            currentUser?.id || ''
          );
        }

        // Filter by active status
        mappingsList = mappingsList.filter(m => m.isActive);

        // Update local storage cache
        await storage.set(STORAGE_KEYS.MAPPINGS, mappingsList);
        set({ mappings: mappingsList, isLoading: false });
      } catch (firebaseError) {
        console.warn('Firebase load failed, trying local storage:', firebaseError);
        
        // Fallback to local storage
        const storedMappings = await storage.get<SalesmanBookerMapping[]>(STORAGE_KEYS.MAPPINGS);
        const mappingsList = (storedMappings || []).filter(m => m.isActive);

        set({ mappings: mappingsList, isLoading: false });
      }
    } catch (error) {
      set({
        error: 'Failed to load mappings',
        isLoading: false,
      });
    }
  },

  getMappingByBooker: (bookerId: string) => {
    const { mappings } = get();
    return mappings.find(m => m.bookerIds.includes(bookerId) && m.isActive) || null;
  },

  getMappingBySalesman: (salesmanId: string) => {
    const { mappings } = get();
    return mappings.find(m => m.salesmanId === salesmanId && m.isActive) || null;
  },

  getSalesmanForBooker: (bookerId: string) => {
    const mapping = get().getMappingByBooker(bookerId);
    return mapping ? mapping.salesmanId : null;
  },

  getBookersForSalesman: (salesmanId: string) => {
    const mapping = get().getMappingBySalesman(salesmanId);
    return mapping ? mapping.bookerIds : [];
  },
}));

