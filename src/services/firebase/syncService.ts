import { firestoreService } from './firestore';
import { COLLECTIONS } from './collections';
import { storage, STORAGE_KEYS } from '../storage/asyncStorage';
import { hybridStorage } from '../storage/hybridStorage';

/**
 * Sync Service
 * Handles synchronization between local storage and Firebase
 */
class SyncService {
  /**
   * Sync all collections from Firebase to local storage
   */
  async syncAllFromFirebase(): Promise<{ success: boolean; synced: number; errors: string[] }> {
    const errors: string[] = [];
    let synced = 0;

    try {
      const collections = [
        { key: STORAGE_KEYS.SHOPS, collection: COLLECTIONS.SHOPS },
        { key: STORAGE_KEYS.ORDERS, collection: COLLECTIONS.ORDERS },
        { key: STORAGE_KEYS.PRODUCTS, collection: COLLECTIONS.PRODUCTS },
        { key: STORAGE_KEYS.DELIVERIES, collection: COLLECTIONS.DELIVERIES },
        { key: STORAGE_KEYS.LEDGER_TRANSACTIONS, collection: COLLECTIONS.LEDGER_TRANSACTIONS },
        { key: STORAGE_KEYS.INVOICES, collection: COLLECTIONS.INVOICES },
        { key: STORAGE_KEYS.ROUTES, collection: COLLECTIONS.ROUTES },
        { key: STORAGE_KEYS.VISITS, collection: COLLECTIONS.VISITS },
        { key: STORAGE_KEYS.RETURNS, collection: COLLECTIONS.RETURNS },
        { key: STORAGE_KEYS.LOAD_FORMS, collection: COLLECTIONS.LOAD_FORMS },
        { key: STORAGE_KEYS.EDIT_REQUESTS, collection: COLLECTIONS.EDIT_REQUESTS },
        { key: STORAGE_KEYS.TARGETS, collection: COLLECTIONS.TARGETS },
      ];

      for (const { key, collection } of collections) {
        try {
          const data = await firestoreService.getDocs<any>(collection);
          if (data && data.length > 0) {
            await storage.set(key, data);
            synced += data.length;
            console.log(`Synced ${data.length} items from ${collection}`);
          }
        } catch (error: any) {
          errors.push(`${collection}: ${error.message}`);
          console.error(`Error syncing ${collection}:`, error);
        }
      }

      return {
        success: errors.length === 0,
        synced,
        errors,
      };
    } catch (error: any) {
      return {
        success: false,
        synced,
        errors: [...errors, `General error: ${error.message}`],
      };
    }
  }

  /**
   * Sync pending items to Firebase
   */
  async syncPendingToFirebase(): Promise<{ success: boolean; synced: number; errors: string[] }> {
    const errors: string[] = [];
    let synced = 0;

    try {
      await hybridStorage.syncToFirebase();
      
      return {
        success: true,
        synced,
        errors: [],
      };
    } catch (error: any) {
      return {
        success: false,
        synced,
        errors: [error.message],
      };
    }
  }

  /**
   * Sync specific collection
   */
  async syncCollection(
    collectionName: string,
    storageKey: string
  ): Promise<{ success: boolean; count: number }> {
    try {
      const data = await firestoreService.getDocs<any>(collectionName as any);
      if (data && data.length > 0) {
        await storage.set(storageKey, data);
        return { success: true, count: data.length };
      }
      return { success: true, count: 0 };
    } catch (error) {
      console.error(`Error syncing collection ${collectionName}:`, error);
      return { success: false, count: 0 };
    }
  }

  /**
   * Sync single document to Firebase
   */
  async syncDocumentToFirebase(
    collectionName: string,
    documentId: string,
    data: any
  ): Promise<boolean> {
    try {
      await firestoreService.setDoc(collectionName as any, {
        id: documentId,
        ...data,
        syncStatus: 'synced',
        updatedAt: new Date().toISOString(),
      });
      return true;
    } catch (error) {
      console.error(`Error syncing document ${documentId}:`, error);
      return false;
    }
  }
}

export const syncService = new SyncService();
export default syncService;

