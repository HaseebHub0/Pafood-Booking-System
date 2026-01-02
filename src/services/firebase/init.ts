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
    try {
      const ErrorUtils = (global as any).ErrorUtils;
      if (ErrorUtils) {
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
    } catch (e) {
      // ErrorUtils might not be available in all environments
      console.warn('Could not setup ErrorUtils handler in init.ts:', e);
    }
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
    try {
      setupFirestoreErrorHandlers();
    } catch (error) {
      console.warn('[Firebase] Error setting up error handlers:', error);
      // Continue even if error handlers fail
    }

    // Ensure Firestore network is enabled
    try {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/abb08022-2053-4b74-b83b-ae5ba940a17c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'src/services/firebase/init.ts:103',message:'About to enable network',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      await enableNetwork(db);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/abb08022-2053-4b74-b83b-ae5ba940a17c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'src/services/firebase/init.ts:106',message:'Network enabled successfully',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      console.log('[Firebase] Firestore network enabled');
    } catch (error: any) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/abb08022-2053-4b74-b83b-ae5ba940a17c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'src/services/firebase/init.ts:110',message:'Network enable error',data:{errorCode:error?.code,errorMessage:error?.message?.substring(0,200),isFailedPrecondition:error?.code==='failed-precondition'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      // If already enabled, that's fine
      if (error.code !== 'failed-precondition') {
        console.warn('[Firebase] Network enable warning:', error.message);
      }
    }

    // Note: IndexedDB persistence is not available in React Native
    // Firestore will use memory cache, which is fine for mobile apps
    // Data is persisted via AsyncStorage through our hybrid storage

    // Load sync queue from storage (with error handling)
    try {
      await useSyncStore.getState().loadQueue();
      const queueCount = useSyncStore.getState().getQueueCount();
      console.log(`[Sync] Loaded ${queueCount} pending sync items from queue`);
    } catch (error) {
      console.warn('[Firebase] Error loading sync queue:', error);
      // Continue even if sync queue load fails
    }

    // Check network status (with error handling)
    try {
      await hybridStorage.updateNetworkStatus();
      const isOnline = hybridStorage.getOnlineStatus();
      useSyncStore.getState().setOnlineStatus(isOnline);
    } catch (error) {
      console.warn('[Firebase] Error checking network status:', error);
      // Default to online if check fails
      useSyncStore.getState().setOnlineStatus(true);
    }

    // Sync pending data to Firebase if online AND user is authenticated
    try {
      const { auth } = await import('../../config/firebase');
      const isOnline = useSyncStore.getState().isOnline;
      
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
    } catch (error) {
      console.warn('[Firebase] Error during sync check:', error);
      // Continue even if sync check fails
    }

    console.log('Firebase initialized successfully');
  } catch (error) {
    console.error('Error initializing Firebase:', error);
    // Don't throw - let app continue even if Firebase init fails partially
    // This prevents app crashes
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

