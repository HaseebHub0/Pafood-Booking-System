import { storage } from './asyncStorage';
import { firestoreService } from '../firebase';
import { COLLECTIONS, CollectionName } from '../firebase/collections';
import { STORAGE_KEYS } from './keys';
import * as Network from 'expo-network';

/**
 * Hybrid Storage Service
 * Combines AsyncStorage (offline) with Firestore (online sync)
 */
class HybridStorageService {
  private isOnline: boolean = true;

  constructor() {
    // Check network status
    this.checkNetworkStatus();
  }

  private async checkNetworkStatus() {
    try {
      const networkState = await Network.getNetworkStateAsync();
      this.isOnline = networkState.isConnected ?? false;
    } catch (error) {
      console.warn('Error checking network status:', error);
      this.isOnline = true; // Assume online by default
    }
  }

  /**
   * Update network status (call this periodically or on network change)
   */
  async updateNetworkStatus(): Promise<void> {
    await this.checkNetworkStatus();
  }

  /**
   * Set network status directly (for real-time updates from network listener)
   */
  setNetworkStatus(isOnline: boolean): void {
    this.isOnline = isOnline;
  }

  /**
   * Get collection name from storage key
   */
  private getCollectionName(key: string): CollectionName | null {
    const keyMap: Record<string, CollectionName> = {
      [STORAGE_KEYS.SHOPS]: COLLECTIONS.SHOPS,
      [STORAGE_KEYS.ORDERS]: COLLECTIONS.ORDERS,
      [STORAGE_KEYS.PRODUCTS]: COLLECTIONS.PRODUCTS,
      [STORAGE_KEYS.DELIVERIES]: COLLECTIONS.DELIVERIES,
      [STORAGE_KEYS.LEDGER_TRANSACTIONS]: COLLECTIONS.LEDGER_TRANSACTIONS,
      [STORAGE_KEYS.INVOICES]: COLLECTIONS.INVOICES,
      [STORAGE_KEYS.ROUTES]: COLLECTIONS.ROUTES,
      [STORAGE_KEYS.VISITS]: COLLECTIONS.VISITS,
      [STORAGE_KEYS.RETURNS]: COLLECTIONS.RETURNS,
      [STORAGE_KEYS.LOAD_FORMS]: COLLECTIONS.LOAD_FORMS,
      [STORAGE_KEYS.EDIT_REQUESTS]: COLLECTIONS.EDIT_REQUESTS,
      [STORAGE_KEYS.TARGETS]: COLLECTIONS.TARGETS,
    };
    return keyMap[key] || null;
  }

  /**
   * Get data - tries Firebase first, falls back to AsyncStorage
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      // Always try local storage first for fast access
      const localData = await storage.get<T>(key as any);
      
      if (this.isOnline) {
        const collectionName = this.getCollectionName(key);
        if (collectionName) {
          try {
            // Try to sync from Firebase
            const firebaseData = await firestoreService.getDocs<T>(collectionName);
            if (firebaseData && firebaseData.length > 0) {
              // Update local storage with Firebase data
              await storage.set(key as any, firebaseData);
              return firebaseData as T;
            }
          } catch (error) {
            console.warn(`Failed to sync from Firebase for ${key}, using local data:`, error);
          }
        }
      }
      
      return localData;
    } catch (error) {
      console.error(`Error getting ${key}:`, error);
      return null;
    }
  }

  /**
   * Set data - saves to both AsyncStorage and Firebase
   */
  async set<T>(key: string, value: T): Promise<boolean> {
    try {
      // Always save to local storage first
      const localSuccess = await storage.set(key as any, value);
      
      if (!localSuccess) {
        return false;
      }

      // Try to sync to Firebase if online
      if (this.isOnline) {
        const collectionName = this.getCollectionName(key);
        if (collectionName && Array.isArray(value)) {
          try {
            // Batch write to Firebase
            const operations = value.map((item: any) => ({
              type: 'set' as const,
              collection: collectionName,
              docId: item.id,
              data: item,
            }));
            
            await firestoreService.batchWrite(operations);
            console.log(`Synced ${value.length} items to Firebase for ${key}`);
          } catch (error) {
            console.warn(`Failed to sync to Firebase for ${key}:`, error);
            // Don't fail - local storage is saved
          }
        }
      }
      
      return true;
    } catch (error) {
      console.error(`Error setting ${key}:`, error);
      return false;
    }
  }

  /**
   * Remove data
   */
  async remove(key: string): Promise<boolean> {
    try {
      await storage.remove(key as any);
      // Note: Firebase deletion should be handled separately per document
      return true;
    } catch (error) {
      console.error(`Error removing ${key}:`, error);
      return false;
    }
  }

  /**
   * Sync all pending data to Firebase
   */
  async syncToFirebase(): Promise<void> {
    if (!this.isOnline) {
      console.log('Offline - skipping sync');
      return;
    }

    // Check if user is authenticated
    try {
      const { auth } = await import('../../config/firebase');
      if (!auth.currentUser) {
        console.log('User not authenticated - skipping sync');
        return;
      }
    } catch (error) {
      console.log('Auth check failed - skipping sync');
      return;
    }

    try {
      const keys = Object.values(STORAGE_KEYS);
      
      for (const key of keys) {
        const collectionName = this.getCollectionName(key);
        if (!collectionName) continue;

        const localData = await storage.get<any[]>(key);
        if (!localData || localData.length === 0) continue;

        try {
          const operations = localData
            .filter((item) => item.syncStatus === 'pending')
            .map((item) => ({
              type: 'set' as const,
              collection: collectionName,
              docId: item.id,
              data: { ...item, syncStatus: 'synced' },
            }));

          if (operations.length > 0) {
            await firestoreService.batchWrite(operations);
            console.log(`Synced ${operations.length} items for ${key}`);
            
            // Update local storage with synced status
            const updatedData = localData.map((item) =>
              item.syncStatus === 'pending'
                ? { ...item, syncStatus: 'synced' as const }
                : item
            );
            await storage.set(key, updatedData);
          }
        } catch (error: any) {
          // Permission errors are expected if user is not authenticated
          if (error.code === 'permission-denied') {
            console.log(`Permission denied for ${key} - user may not be authenticated`);
          } else {
            console.error(`Error syncing ${key}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Error in syncToFirebase:', error);
    }
  }

  /**
   * Sync from Firebase to local storage
   */
  async syncFromFirebase(): Promise<void> {
    if (!this.isOnline) {
      console.log('Offline - skipping sync');
      return;
    }

    try {
      const keys = Object.values(STORAGE_KEYS);
      
      for (const key of keys) {
        const collectionName = this.getCollectionName(key);
        if (!collectionName) continue;

        try {
          const firebaseData = await firestoreService.getDocs<any>(collectionName);
          if (firebaseData && firebaseData.length > 0) {
            await storage.set(key, firebaseData);
            console.log(`Synced ${firebaseData.length} items from Firebase for ${key}`);
          }
        } catch (error) {
          console.error(`Error syncing from Firebase for ${key}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in syncFromFirebase:', error);
    }
  }

  /**
   * Get online status
   */
  getOnlineStatus(): boolean {
    return this.isOnline;
  }
}

export const hybridStorage = new HybridStorageService();
export default hybridStorage;


