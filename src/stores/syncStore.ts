import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { storage, STORAGE_KEYS } from '../services/storage/asyncStorage';

type SyncAction = 'CREATE' | 'UPDATE' | 'DELETE';
type SyncEntity = 'shop' | 'order';

interface SyncQueueItem {
  id: string;
  action: SyncAction;
  entity: SyncEntity;
  entityId: string;
  payload: any;
  createdAt: string;
  attempts: number;
  lastError?: string;
}

interface SyncState {
  queue: SyncQueueItem[];
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncAt: string | null;
}

interface SyncActions {
  addToQueue: (action: SyncAction, entity: SyncEntity, entityId: string, payload: any) => void;
  removeFromQueue: (id: string) => void;
  setOnlineStatus: (isOnline: boolean) => void;
  syncPendingItems: () => Promise<void>;
  loadQueue: () => Promise<void>;
  clearQueue: () => Promise<void>;
  getQueueCount: () => number;
}

type SyncStore = SyncState & SyncActions;

export const useSyncStore = create<SyncStore>((set, get) => ({
  // Initial state
  queue: [],
  isOnline: true, // Assume online by default
  isSyncing: false,
  lastSyncAt: null,

  // Actions
  addToQueue: (action, entity, entityId, payload) => {
    const { queue } = get();

    // Check if there's already a pending item for this entity
    const existingIndex = queue.findIndex(
      (item) => item.entity === entity && item.entityId === entityId
    );

    let updatedQueue: SyncQueueItem[];

    if (existingIndex >= 0) {
      // Update existing item
      updatedQueue = queue.map((item, index) =>
        index === existingIndex
          ? {
              ...item,
              action,
              payload,
              createdAt: new Date().toISOString(),
            }
          : item
      );
    } else {
      // Add new item
      const newItem: SyncQueueItem = {
        id: uuidv4(),
        action,
        entity,
        entityId,
        payload,
        createdAt: new Date().toISOString(),
        attempts: 0,
      };
      updatedQueue = [...queue, newItem];
    }

    set({ queue: updatedQueue });
    storage.set(STORAGE_KEYS.PENDING_SYNC, updatedQueue);
  },

  removeFromQueue: (id: string) => {
    const { queue } = get();
    const updatedQueue = queue.filter((item) => item.id !== id);
    set({ queue: updatedQueue });
    storage.set(STORAGE_KEYS.PENDING_SYNC, updatedQueue);
  },

  setOnlineStatus: (isOnline: boolean) => {
    set({ isOnline });

    // Auto-sync when coming back online
    if (isOnline && get().queue.length > 0) {
      get().syncPendingItems();
    }
  },

  syncPendingItems: async () => {
    const { queue, isOnline, isSyncing } = get();

    if (!isOnline || isSyncing || queue.length === 0) {
      return;
    }

    // Check if user is authenticated
    try {
      const { auth } = await import('../config/firebase');
      if (!auth.currentUser) {
        console.log('[SYNC] User not authenticated - skipping sync');
        return;
      }
    } catch (error) {
      console.log('[SYNC] Auth check failed - skipping sync');
      return;
    }

    set({ isSyncing: true });

    const MAX_RETRIES = 3;

    for (const item of queue) {
      try {
        const { firestoreService } = await import('../services/firebase');
        const { COLLECTIONS } = await import('../services/firebase/collections');
        
        console.log(`[SYNC] Processing: ${item.action} ${item.entity} ${item.entityId}`);

        // Map entity to collection
        const collectionMap: Record<SyncEntity, string> = {
          shop: COLLECTIONS.SHOPS,
          order: COLLECTIONS.ORDERS,
        };

        const collectionName = collectionMap[item.entity] as any;

        // Execute Firebase operation based on action
        switch (item.action) {
          case 'CREATE':
          case 'UPDATE':
            const { sanitizeForFirebase } = await import('../utils/dataSanitizers');
            const sanitizedPayload = sanitizeForFirebase({
              ...item.payload,
              id: item.entityId,
              syncStatus: 'synced',
              updatedAt: new Date().toISOString(),
            });
            await firestoreService.setDoc(collectionName, sanitizedPayload);
            break;
          case 'DELETE':
            await firestoreService.deleteDoc(collectionName, item.entityId);
            break;
        }

        // Success - remove from queue
        get().removeFromQueue(item.id);
      } catch (error: any) {
        console.error(`[SYNC] Error syncing ${item.entity} ${item.entityId}:`, error);
        
        const updatedQueue = get().queue.map((qItem) =>
          qItem.id === item.id
            ? {
                ...qItem,
                attempts: qItem.attempts + 1,
                lastError: error.message,
              }
            : qItem
        );

        set({ queue: updatedQueue });

        // Remove if max retries reached
        if (item.attempts + 1 >= MAX_RETRIES) {
          console.error(`[SYNC] Max retries reached for ${item.id}`);
          get().removeFromQueue(item.id);
        }
      }
    }

    set({
      isSyncing: false,
      lastSyncAt: new Date().toISOString(),
    });

    storage.set(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
  },

  loadQueue: async () => {
    try {
      const storedQueue = await storage.get<SyncQueueItem[]>(STORAGE_KEYS.PENDING_SYNC);
      const lastSync = await storage.get<string>(STORAGE_KEYS.LAST_SYNC);

      set({
        queue: storedQueue || [],
        lastSyncAt: lastSync,
      });
    } catch (error) {
      console.error('Failed to load sync queue:', error);
    }
  },

  clearQueue: async () => {
    set({ queue: [] });
    await storage.remove(STORAGE_KEYS.PENDING_SYNC);
  },

  getQueueCount: () => {
    return get().queue.length;
  },
}));

