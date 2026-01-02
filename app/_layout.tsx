import 'react-native-get-random-values'; // Must be imported before uuid
import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, Platform, AppState, AppStateStatus } from 'react-native';
import { useAuthStore } from '../src/stores';
import { useSyncStore } from '../src/stores/syncStore';
import { hybridStorage } from '../src/services/storage/hybridStorage';
import { colors } from '../src/theme';
import { initializeFirebase } from '../src/services/firebase/init';

export default function RootLayout() {
  const { isLoading, checkAuth } = useAuthStore();
  const [ToastComponent, setToastComponent] = useState<React.ComponentType | null>(null);

  // Load Toast component only on native platforms
  useEffect(() => {
    if (Platform.OS !== 'web') {
      try {
        const Toast = require('react-native-toast-message').default;
        setToastComponent(() => Toast);
      } catch (error) {
        // Toast not available
      }
    }
  }, []);

  useEffect(() => {
    // EAS Updates are handled automatically by expo-updates module
    // Updates check on app load (configured in app.json: updates.checkAutomatically)
    // No manual update check needed - expo-updates handles it automatically

    // Setup global error handler for unhandled promise rejections (React Native)
    if (Platform.OS !== 'web') {
      try {
        // Helper function to check if error is a Firestore internal error
        const isFirestoreInternalError = (error: any): boolean => {
          if (!error) return false;
          const errorMessage = typeof error === 'string' ? error : error?.message || '';
          const errorCode = error?.code;
          return (
            errorMessage.includes('INTERNAL ASSERTION FAILED') ||
            errorMessage.includes('Unexpected state') ||
            errorCode === 'ca9' ||
            errorCode === 'c050' ||
            errorCode === 'b815' ||
            errorMessage.includes('ID: ca9') ||
            errorMessage.includes('ID: c050') ||
            errorMessage.includes('ID: b815')
          );
        };
        
        // Intercept console.error and console.warn for React Native
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
        
        // ErrorUtils is available globally in React Native
        const ErrorUtils = (global as any).ErrorUtils;
        if (ErrorUtils) {
          const originalHandler = ErrorUtils.getGlobalHandler();
          
          ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
            if (isFirestoreInternalError(error)) {
              // Suppress - don't log or handle
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
        console.warn('Could not setup ErrorUtils handler:', e);
      }
    }

    // Initialize Firebase first, then check auth
    const initApp = async () => {
      try {
        // Initialize Firebase and ensure network is enabled
        try {
          await initializeFirebase();
          console.log('[App] Firebase initialized, checking auth...');
          
          // Wait a bit more to ensure network is fully ready
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (firebaseError) {
          console.error('[App] Firebase initialization error:', firebaseError);
          // Continue even if Firebase init fails - app should still work
        }
        
        // Now check auth status (with error handling)
        try {
          await checkAuth();
        } catch (authError) {
          console.error('[App] Auth check error:', authError);
          // Don't crash app if auth check fails
        }
      } catch (error) {
        console.error('[App] Unexpected initialization error:', error);
        // Ensure app doesn't crash - try to continue
      }
    };

    // Don't await - let it run in background to avoid blocking
    initApp().catch((error) => {
      console.error('[App] Fatal initialization error:', error);
      // Last resort - don't let app crash
    });

    // Setup network monitoring (only on native platforms)
    let networkCheckInterval: ReturnType<typeof setInterval> | null = null;
    
    const setupNetworkMonitoring = async () => {
      // Skip on web - assume always online
      if (Platform.OS === 'web') {
        useSyncStore.getState().setOnlineStatus(true);
        hybridStorage.setNetworkStatus(true);
        return;
      }

      // Dynamically import Network module for native platforms
      let Network: any;
      try {
        Network = require('expo-network');
      } catch (error) {
        console.warn('[Network] Network module not available');
        useSyncStore.getState().setOnlineStatus(true);
        hybridStorage.setNetworkStatus(true);
        return;
      }

      try {
        // Initial check
        const initialNetworkState = await Network.getNetworkStateAsync();
        const isOnline = initialNetworkState.isConnected ?? false;
        
        useSyncStore.getState().setOnlineStatus(isOnline);
        hybridStorage.setNetworkStatus(isOnline);
        
        console.log(`[Network] Initial network status: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
        
        // Poll network status every 3 seconds
        networkCheckInterval = setInterval(async () => {
          try {
            const networkState = await Network.getNetworkStateAsync();
            const currentlyOnline = networkState.isConnected ?? false;
            const previousOnline = useSyncStore.getState().isOnline;
            
            if (currentlyOnline !== previousOnline) {
              console.log(`[Network] Network status changed: ${previousOnline ? 'ONLINE' : 'OFFLINE'} → ${currentlyOnline ? 'ONLINE' : 'OFFLINE'}`);
              useSyncStore.getState().setOnlineStatus(currentlyOnline);
              hybridStorage.setNetworkStatus(currentlyOnline);
            }
          } catch (error) {
            console.warn('[Network] Error checking network status:', error);
          }
        }, 3000);
      } catch (error) {
        console.warn('[Network] Error setting up network monitoring:', error);
        // Assume online if we can't check
        useSyncStore.getState().setOnlineStatus(true);
        hybridStorage.setNetworkStatus(true);
      }
    };

    setupNetworkMonitoring();

    // Cleanup
    return () => {
      if (networkCheckInterval) {
        clearInterval(networkCheckInterval);
      }
    };
  }, []);

  // Handle app state changes to continue location tracking in background
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      // Location tracking continues in background automatically
      // No action needed, but we log for debugging
      if (nextAppState === 'background' || nextAppState === 'active') {
        console.log('[AppState] App state changed to:', nextAppState);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, []);

  // Start location tracking if user is already logged in (from checkAuth)
  useEffect(() => {
    const { user } = useAuthStore.getState();
    if (user && user.role === 'booker' && Platform.OS !== 'web') {
      // Start location tracking for already logged-in bookers
      const startTracking = async () => {
        try {
          const { useLocationTrackingStore } = await import('../src/stores/locationTrackingStore');
          const { isTracking } = useLocationTrackingStore.getState();
          if (!isTracking) {
            await useLocationTrackingStore.getState().startTracking(user);
          }
        } catch (error) {
          console.warn('Failed to start location tracking on app mount:', error);
        }
      };
      startTracking();
    }
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      {ToastComponent && <ToastComponent />}
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});

