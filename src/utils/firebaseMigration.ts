import { storage, STORAGE_KEYS } from '../services/storage/asyncStorage';
import { firestoreService } from '../services/firebase';
import { COLLECTIONS } from '../services/firebase/collections';

/**
 * Migration utility to migrate existing AsyncStorage data to Firebase
 */
export class FirebaseMigration {
  /**
   * Migrate all local data to Firebase
   */
  static async migrateAllToFirebase(): Promise<{
    success: boolean;
    migrated: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let migrated = 0;

    const migrations = [
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

    for (const { key, collection } of migrations) {
      try {
        const localData = await storage.get<any[]>(key);
        if (!localData || localData.length === 0) {
          console.log(`No data to migrate for ${key}`);
          continue;
        }

        // Batch write to Firebase
        const operations = localData.map((item) => ({
          type: 'set' as const,
          collection: collection as any,
          docId: item.id,
          data: {
            ...item,
            syncStatus: 'synced',
            updatedAt: new Date().toISOString(),
          },
        }));

        await firestoreService.batchWrite(operations);
        migrated += localData.length;
        console.log(`Migrated ${localData.length} items from ${key} to ${collection}`);
      } catch (error: any) {
        errors.push(`${key}: ${error.message}`);
        console.error(`Error migrating ${key}:`, error);
      }
    }

    return {
      success: errors.length === 0,
      migrated,
      errors,
    };
  }

  /**
   * Check if migration is needed
   */
  static async needsMigration(): Promise<boolean> {
    try {
      // Check if any local data exists
      const shops = await storage.get(STORAGE_KEYS.SHOPS);
      const orders = await storage.get(STORAGE_KEYS.ORDERS);
      
      return !!(shops || orders);
    } catch {
      return false;
    }
  }
}

