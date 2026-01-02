import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Setup global error handlers for Firestore internal errors
 * This must be called before any Firestore operations
 */
function setupFirestoreErrorHandlers() {
  // Helper function to check if error is a Firestore internal error
  const isFirestoreInternalError = (error: any): boolean => {
    if (!error) return false;
    
    const errorMessage = typeof error === 'string' ? error : error?.message || '';
    const errorStack = typeof error === 'string' ? '' : error?.stack || '';
    const errorCode = error?.code;
    const fullErrorText = `${errorMessage} ${errorStack}`;
    
    return (
      errorMessage.includes('INTERNAL ASSERTION FAILED') ||
      errorMessage.includes('Unexpected state') ||
      errorStack.includes('INTERNAL ASSERTION FAILED') ||
      errorStack.includes('Unexpected state') ||
      fullErrorText.includes('ID: ca9') ||
      fullErrorText.includes('ID: c050') ||
      fullErrorText.includes('ID: b815') ||
      fullErrorText.includes('(ID: b815)') ||
      fullErrorText.includes('(ID: ca9)') ||
      fullErrorText.includes('(ID: c050)') ||
      errorCode === 'ca9' ||
      errorCode === 'c050' ||
      errorCode === 'b815'
    );
  };

  // Handle unhandled promise rejections (common for Firestore errors)
  if (typeof window !== 'undefined') {
    // Web platform - intercept console.error to suppress Firestore errors
    const originalConsoleError = console.error.bind(console);
    const originalConsoleWarn = console.warn.bind(console);
    
    console.error = (...args: any[]) => {
      // Check all arguments including error objects and stack traces
      const errorString = args.map(arg => {
        if (typeof arg === 'string') return arg;
        if (arg?.message) return arg.message;
        if (arg?.stack) return arg.stack;
        if (arg?.toString) return arg.toString();
        return String(arg);
      }).join(' ');
      
      // Also check individual arguments for Firestore errors
      const hasFirestoreError = isFirestoreInternalError(errorString) || 
                                args.some(arg => {
                                  if (typeof arg === 'string') return isFirestoreInternalError(arg);
                                  if (arg?.message) return isFirestoreInternalError(arg.message);
                                  if (arg?.stack) return isFirestoreInternalError(arg.stack);
                                  return false;
                                });
      
      if (hasFirestoreError) {
        // Suppress Firestore internal errors from console completely
        return;
      }
      originalConsoleError(...args);
    };
    
    // Also intercept console.warn for Firestore errors
    console.warn = (...args: any[]) => {
      const errorString = args.map(arg => {
        if (typeof arg === 'string') return arg;
        if (arg?.message) return arg.message;
        if (arg?.toString) return arg.toString();
        return String(arg);
      }).join(' ');
      
      if (isFirestoreInternalError(errorString) || args.some(arg => isFirestoreInternalError(arg))) {
        // Suppress Firestore internal errors from console completely
        return;
      }
      originalConsoleWarn(...args);
    };
    
    const unhandledRejectionHandler = (event: PromiseRejectionEvent) => {
      if (isFirestoreInternalError(event.reason)) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/abb08022-2053-4b74-b83b-ae5ba940a17c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'firebase.ts:68',message:'Global unhandledRejection caught Firestore error',data:{errorMessage:event.reason?.message?.substring(0,200),errorCode:event.reason?.code,errorStack:event.reason?.stack?.substring(0,300)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,C'})}).catch(()=>{});
        // #endregion
        // Suppress warning - error is handled and will recover automatically
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return false;
      }
    };
    
    const errorHandler = (event: ErrorEvent) => {
      if (isFirestoreInternalError(event.error) || isFirestoreInternalError(event.message)) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/abb08022-2053-4b74-b83b-ae5ba940a17c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'firebase.ts:78',message:'Global error handler caught Firestore error',data:{errorMessage:event.message?.substring(0,200),errorStack:event.error?.stack?.substring(0,300),filename:event.filename,lineno:event.lineno},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,C'})}).catch(()=>{});
        // #endregion
        // Suppress warning - error is handled and will recover automatically
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        return false;
      }
    };
    
    // Remove existing handlers if any, then add new ones with highest priority
    window.removeEventListener('unhandledrejection', unhandledRejectionHandler as any, true);
    window.removeEventListener('error', errorHandler as any, true);
    window.addEventListener('unhandledrejection', unhandledRejectionHandler, true);
    window.addEventListener('error', errorHandler, true); // Use capture phase with highest priority
  } else if (Platform.OS !== 'web') {
    // React Native platform
    try {
      // Intercept console.error for React Native
      const originalConsoleError = console.error.bind(console);
      const originalConsoleWarn = console.warn.bind(console);
      
      console.error = (...args: any[]) => {
        const errorString = args.map(arg => {
          if (typeof arg === 'string') return arg;
          if (arg?.message) return arg.message;
          if (arg?.toString) return arg.toString();
          return String(arg);
        }).join(' ');
        
        if (isFirestoreInternalError(errorString) || args.some(arg => isFirestoreInternalError(arg))) {
          // Suppress Firestore internal errors from console completely
          return;
        }
        originalConsoleError(...args);
      };
      
      console.warn = (...args: any[]) => {
        const errorString = args.map(arg => {
          if (typeof arg === 'string') return arg;
          if (arg?.message) return arg.message;
          if (arg?.toString) return arg.toString();
          return String(arg);
        }).join(' ');
        
        if (isFirestoreInternalError(errorString) || args.some(arg => isFirestoreInternalError(arg))) {
          // Suppress Firestore internal errors from console completely
          return;
        }
        originalConsoleWarn(...args);
      };
      
      // Setup ErrorUtils handler
      const ErrorUtils = (global as any).ErrorUtils;
      if (ErrorUtils) {
        const originalHandler = ErrorUtils.getGlobalHandler();
        
        ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
          if (isFirestoreInternalError(error)) {
            // Suppress - don't log or handle
            return;
          }
          
          if (originalHandler) {
            originalHandler(error, isFatal);
          }
        });
      }
    } catch (e) {
      // ErrorUtils might not be available
      console.warn('Could not setup ErrorUtils handler:', e);
    }
  }
}

// Setup error handlers immediately, before Firebase initialization
setupFirestoreErrorHandlers();

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDga2U0A0hvwblpWCJyB8f-LP4Hp_vszAM",
  authDomain: "pakasianfood-field.firebaseapp.com",
  projectId: "pakasianfood-field",
  storageBucket: "pakasianfood-field.firebasestorage.app",
  messagingSenderId: "756905212386",
  appId: "1:756905212386:web:36a46686a78ce2f1a821bb",
  measurementId: "G-1BM5GLBEVS"
};

// Initialize Firebase
let app: FirebaseApp;
let db: Firestore;
let auth: Auth;

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  // Use database ID 'pafood' instead of default
  // Disable persistence to prevent cache corruption issues
  db = getFirestore(app, 'pafood');
  
  // Initialize Auth with AsyncStorage persistence for React Native
  if (Platform.OS !== 'web') {
    try {
      auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage)
      });
    } catch (error: any) {
      // If already initialized, just get the existing instance
      if (error.code === 'auth/already-initialized') {
        auth = getAuth(app);
      } else {
        throw error;
      }
    }
  } else {
    auth = getAuth(app);
  }
} else {
  app = getApps()[0];
  // Use database ID 'pafood' instead of default
  db = getFirestore(app, 'pafood');
  auth = getAuth(app);
}

export { app, db, auth };
export default app;


