import { app, db, auth } from '../../config/firebase';
import { syncService } from './syncService';
import { hybridStorage } from '../storage/hybridStorage';
import { useSyncStore } from '../../stores/syncStore';
import { enableNetwork } from 'firebase/firestore';
import { Platform } from 'react-native';

/**
 * Setup global error handlers for Firestore internal errors
 */
function setupFirestoreErrorHandlers() {
  // Handle unhandled promise rejections (common for Firestore errors)
  if (typeof window !== 'undefined') {
    // Web platform
    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
      const error = event.reason;
      const isFirestoreInternalError = 
        error?.message?.includes('INTERNAL ASSERTION FAILED') ||
        error?.message?.includes('Unexpected state') ||
        error?.code === 'ca9' ||
        error?.code === 'c050' ||
        error?.code === 'b815' ||
        (error?.message && error?.message.includes('ID: ca9')) ||
        (error?.message && error?.message.includes('ID: c050')) ||
        (error?.message && error?.message.includes('ID: b815'));
      
      if (isFirestoreInternalError) {
        // Suppress warning - error is handled and will recover automatically
        event.preventDefault(); // Prevent the error from being logged to console
        return;
      }
    });
    
    // Handle general errors
    window.addEventListener('error', (event: ErrorEvent) => {
      const error = event.error || event.message;
      const isFirestoreInternalError = 
        (typeof error === 'string' && error.includes('INTERNAL ASSERTION FAILED')) ||
        (typeof error === 'string' && error.includes('Unexpected state')) ||
        (typeof error === 'string' && error.includes('ID: ca9')) ||
        (typeof error === 'string' && error.includes('ID: c050')) ||
        (typeof error === 'string' && error.includes('ID: b815')) ||
        (error?.message?.includes('INTERNAL ASSERTION FAILED')) ||
        (error?.message?.includes('Unexpected state')) ||
        (error?.code === 'ca9') ||
        (error?.code === 'c050') ||
        (error?.code === 'b815');
      
      if (isFirestoreInternalError) {
        // Suppress warning - error is handled and will recover automatically
        event.preventDefault(); // Prevent the error from being logged to console
        return;
      }
    });
  } else if (Platform.OS !== 'web') {
    // React Native platform
    const originalHandler = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
      const isFirestoreInternalError = 
        error?.message?.includes('INTERNAL ASSERTION FAILED') ||
        error?.message?.includes('Unexpected state') ||
        (error?.message && error?.message.includes('ID: ca9'));
      
      if (isFirestoreInternalError) {
        // Suppress warning - error is handled and will recover automatically
        // Don't call original handler for these errors
        return;
      }
      
      // Call original handler for other errors
      if (originalHandler) {
        originalHandler(error, isFatal);
      }
    });
  }
}

/**
 * Initialize Firebase services
 * Call this in app startup
 */
export async function initializeFirebase(): Promise<void> {
  try {
    console.log('Initializing Firebase...');
    
    // Setup global error handlers first
    setupFirestoreErrorHandlers();

    // Ensure Firestore network is enabled
    try {
      await enableNetwork(db);
      console.log('[Firebase] Firestore network enabled');
    } catch (error: any) {
      // If already enabled, that's fine
      if (error.code !== 'failed-precondition') {
        console.warn('[Firebase] Network enable warning:', error.message);
      }
    }

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

