import { create } from 'zustand';
import { SalesmanBookerMapping, MappingFormData } from '../types/mapping';
import { storage, STORAGE_KEYS } from '../services/storage/asyncStorage';
import { useAuthStore } from './authStore';

interface MappingState {
  mappings: SalesmanBookerMapping[];
  isLoading: boolean;
  error: string | null;
  _loadPromise: Promise<void> | null; // Track ongoing load to prevent duplicates
}

interface MappingActions {
  loadMappings: () => Promise<void>;
  getMappingByBooker: (bookerId: string) => SalesmanBookerMapping | null;
  getMappingBySalesman: (salesmanId: string) => SalesmanBookerMapping | null;
  getSalesmanForBooker: (bookerId: string) => string | null; // Returns salesmanId
}

type MappingStore = MappingState & MappingActions;

// Helper to validate query values
const isValidQueryValue = (value: any): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  return true;
};

export const useMappingStore = create<MappingStore>((set, get) => ({
  // Initial state
  mappings: [],
  isLoading: false,
  error: null,
  _loadPromise: null, // Track ongoing load promise

  // Actions
  loadMappings: async () => {
    const state = get();
    
    // If already loading, return the existing promise to prevent duplicate queries
    if (state.isLoading && state._loadPromise) {
      console.log('[MappingStore] Load already in progress, reusing existing promise');
      return state._loadPromise;
    }

    // If mappings are already loaded and not stale, skip reload
    // (This prevents unnecessary queries on rapid re-renders)
    if (state.mappings.length > 0 && !state.isLoading && !state.error) {
      console.log('[MappingStore] Mappings already loaded, skipping reload');
      return Promise.resolve();
    }

    const loadPromise = (async () => {
      set({ isLoading: true, error: null, _loadPromise: null });

      try {
        const currentUser = useAuthStore.getState().user;
        
        // Guard: Ensure user exists before querying
        if (!currentUser) {
          console.warn('[MappingStore] No current user, cannot load mappings');
          const storedMappings = await storage.get<SalesmanBookerMapping[]>(STORAGE_KEYS.MAPPINGS);
          const mappingsList = (storedMappings || []).filter(m => m.isActive);
          set({ mappings: mappingsList, isLoading: false, _loadPromise: null });
          return;
        }

        const userRole = currentUser.role?.toLowerCase();
        console.log('[MappingStore] Loading mappings for user:', {
          id: currentUser.id,
          role: userRole,
          regionId: currentUser.regionId,
          branch: currentUser.branch,
        });
        
        // Try Firebase first
        try {
          const { firestoreService } = await import('../services/firebase');
          const { COLLECTIONS } = await import('../services/firebase/collections');
          
          let mappingsList: SalesmanBookerMapping[] = [];
          
          if (userRole === 'kpo') {
            // KPO can see mappings in their region
            if (!isValidQueryValue(currentUser.regionId)) {
              console.warn('[MappingStore] KPO user has no regionId, cannot query mappings');
              throw new Error('KPO user missing regionId');
            }
            
            console.log('[MappingStore] Querying mappings for KPO by regionId:', currentUser.regionId);
            mappingsList = await firestoreService.getDocsWhere<SalesmanBookerMapping>(
              COLLECTIONS.MAPPINGS,
              'regionId',
              '==',
              currentUser.regionId
            );
          } else if (userRole === 'admin' || userRole === 'owner') {
            // Admin/Owner can see all mappings
            console.log('[MappingStore] Querying all mappings for admin/owner');
            mappingsList = await firestoreService.getDocs<SalesmanBookerMapping>(COLLECTIONS.MAPPINGS);
          } else if (userRole === 'salesman') {
            // Salesman can see their own mapping
            if (!isValidQueryValue(currentUser.id)) {
              console.warn('[MappingStore] Salesman user has no id, cannot query mappings');
              throw new Error('Salesman user missing id');
            }
            
            console.log('[MappingStore] Querying mappings for salesman by salesmanId:', currentUser.id);
            mappingsList = await firestoreService.getDocsWhere<SalesmanBookerMapping>(
              COLLECTIONS.MAPPINGS,
              'salesmanId',
              '==',
              currentUser.id
            );
          } else {
            // Unknown role - return empty list
            console.log('[MappingStore] Unknown role, returning empty mappings');
            mappingsList = [];
          }

          // Filter by active status
          mappingsList = mappingsList.filter(m => m.isActive);
          console.log('[MappingStore] Loaded', mappingsList.length, 'active mappings from Firestore');

          // Update local storage cache
          await storage.set(STORAGE_KEYS.MAPPINGS, mappingsList);
          set({ mappings: mappingsList, isLoading: false, _loadPromise: null });
        } catch (firebaseError: any) {
          console.warn('[MappingStore] Firebase load failed, trying local storage:', firebaseError?.message || firebaseError);
          
          // Fallback to local storage
          const storedMappings = await storage.get<SalesmanBookerMapping[]>(STORAGE_KEYS.MAPPINGS);
          const mappingsList = (storedMappings || []).filter(m => m.isActive);
          console.log('[MappingStore] Loaded', mappingsList.length, 'mappings from local storage');

          set({ mappings: mappingsList, isLoading: false, _loadPromise: null });
        }
      } catch (error: any) {
        console.error('[MappingStore] Error loading mappings:', error?.message || error);
        set({
          error: 'Failed to load mappings',
          isLoading: false,
          _loadPromise: null,
        });
      }
    })();

    // Store the promise so concurrent calls can reuse it
    set({ _loadPromise: loadPromise });
    return loadPromise;
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

