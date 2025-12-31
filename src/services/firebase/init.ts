import { app, db, auth } from '../../config/firebase';
import { syncService } from './syncService';
import { hybridStorage } from '../storage/hybridStorage';
import { useSyncStore } from '../../stores/syncStore';

/**
 * Initialize Firebase services
 * Call this in app startup
 */
export async function initializeFirebase(): Promise<void> {
  try {
    console.log('Initializing Firebase...');

    // Note: IndexedDB persistence is not available in React Native
    // Firestore will use memory cache, which is fine for mobile apps
    // Data is persisted via AsyncStorage through our hybrid storage

    // Load sync queue from storage
    await useSyncStore.getState().loadQueue();
    const queueCount = useSyncStore.getState().getQueueCount();
    console.log(`[Sync] Loaded ${queueCount} pending sync items from queue`);

    // Check network status
    await hybridStorage.updateNetworkStatus();
    const isOnline = hybridStorage.getOnlineStatus();
    useSyncStore.getState().setOnlineStatus(isOnline);

    // Sync pending data to Firebase if online AND user is authenticated
    const { auth } = await import('../../config/firebase');
    if (isOnline && auth.currentUser) {
      console.log('Syncing pending data to Firebase...');
      try {
        // Sync via syncStore (handles queue)
        await useSyncStore.getState().syncPendingItems();
        // Also sync via hybridStorage (handles syncStatus='pending' items)
        await syncService.syncPendingToFirebase();
      } catch (error: any) {
        // Permission errors are expected if user is not authenticated
        if (error.code === 'permission-denied') {
          console.log('Sync skipped: User not authenticated');
        } else {
          console.warn('Sync error:', error.message);
        }
      }
    } else if (!auth.currentUser) {
      console.log('Sync skipped: User not authenticated');
    } else if (!isOnline) {
      console.log('Sync skipped: Device is offline');
    }

    console.log('Firebase initialized successfully');
  } catch (error) {
    console.error('Error initializing Firebase:', error);
    throw error;
  }
}

/**
 * Check Firebase connection
 */
export async function checkFirebaseConnection(): Promise<boolean> {
  try {
    // Simple check - if app is initialized, connection is ready
    return app !== null && db !== null;
  } catch (error) {
    console.error('Firebase connection check failed:', error);
    return false;
  }
}

export { app, db, auth };

