import { create } from 'zustand';
import { User, LoginCredentials, UserRole } from '../types';
import { storage, STORAGE_KEYS } from '../services/storage/asyncStorage';
import { firebaseAuthService } from '../services/firebase';
import { auth } from '../config/firebase';

// Helper function to normalize user role (supports booker, salesman, admin, kpo)
const normalizeRole = (role: any): UserRole => {
  if (!role || typeof role !== 'string') {
    return 'booker'; // Default fallback
  }
  
  const roleLower = role.toLowerCase().trim();
  
  if (roleLower === 'booker') {
    return 'booker';
  } else if (roleLower === 'salesman') {
    return 'salesman';
  } else if (roleLower === 'admin' || roleLower === 'administrator') {
    return 'admin';
  } else if (roleLower === 'kpo' || roleLower === 'k.p.o' || roleLower === 'k.p.o.') {
    return 'kpo';
  }
  
  // Default fallback
  console.warn(`Unknown role "${role}", defaulting to "booker"`);
  return 'booker';
};

// Helper to normalize user data with correct role
const normalizeUser = (user: User): User => {
  return {
    ...user,
    role: normalizeRole(user.role),
  };
};

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface AuthActions {
  login: (credentials: LoginCredentials) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<boolean>;
  updateProfile: (data: Partial<User>) => Promise<boolean>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  clearError: () => void;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>((set, get) => ({
  // Initial state
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  // Actions
  login: async (credentials: LoginCredentials) => {
    set({ isLoading: true, error: null });

    try {
      // Authenticate with Firebase
      const authenticatedUser = await firebaseAuthService.signIn(
        credentials.email,
        credentials.password
      );

      if (authenticatedUser) {
        const firebaseUser = auth.currentUser;
        const token = await firebaseUser?.getIdToken() || null;

        // Ensure role is normalized (firebaseAuthService should do this, but double-check)
        const normalizedUser = normalizeUser(authenticatedUser);
        
        console.log('Login - Auth role:', authenticatedUser.role, 'Normalized role:', normalizedUser.role);

        // Store normalized user data locally
        await storage.set(STORAGE_KEYS.CURRENT_USER, normalizedUser);
        if (token) {
          await storage.set(STORAGE_KEYS.AUTH_TOKEN, token);
        }

        set({
          user: normalizedUser,
          token,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });

        // Start location tracking for bookers
        if (normalizedUser.role === 'booker') {
          try {
            const { useLocationTrackingStore } = await import('./locationTrackingStore');
            await useLocationTrackingStore.getState().startTracking(normalizedUser);
          } catch (error) {
            console.warn('Failed to start location tracking:', error);
            // Don't block login if location tracking fails
          }
        }

        return true;
      } else {
        set({
          isLoading: false,
          error: 'Invalid email or password',
        });
        return false;
      }
    } catch (error: any) {
      console.error('Login error:', error);
      
      // Provide user-friendly error message
      let errorMessage = 'Invalid email or password';
      
      if (error.message) {
        errorMessage = error.message;
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network connection failed. Please check your internet connection and try again.';
      }
      
      set({
        isLoading: false,
        error: errorMessage,
      });
      return false;
    }
  },

  logout: async () => {
    set({ isLoading: true });

    try {
      // Stop location tracking before logout
      try {
        const { useLocationTrackingStore } = await import('./locationTrackingStore');
        await useLocationTrackingStore.getState().stopTracking();
      } catch (error) {
        console.warn('Failed to stop location tracking:', error);
        // Continue with logout even if location tracking stop fails
      }

      // Sign out from Firebase
      await firebaseAuthService.signOut();

      // Clear local storage
      await storage.remove(STORAGE_KEYS.AUTH_TOKEN);
      await storage.remove(STORAGE_KEYS.CURRENT_USER);

      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      set({ isLoading: false });
    }
  },

  checkAuth: async () => {
    set({ isLoading: true });

    try {
      const firebaseUser = auth.currentUser;
      
      if (firebaseUser) {
        // Get user data from Firestore (already normalized by firebaseAuthService)
        const userData = await firebaseAuthService.getUserData(firebaseUser.uid);
        
        if (userData) {
          const token = await firebaseUser.getIdToken();
          
          // Ensure role is normalized (firebaseAuthService should do this, but double-check)
          const normalizedUser = normalizeUser(userData);
          
          console.log('CheckAuth - Firestore role:', userData.role, 'Normalized role:', normalizedUser.role);
          
          // Update local storage with normalized user
          await storage.set(STORAGE_KEYS.CURRENT_USER, normalizedUser);
          await storage.set(STORAGE_KEYS.AUTH_TOKEN, token);

          set({
            user: normalizedUser,
            token,
            isAuthenticated: true,
            isLoading: false,
          });

          // Start location tracking for bookers if not already tracking
          if (normalizedUser.role === 'booker') {
            try {
              const { useLocationTrackingStore } = await import('./locationTrackingStore');
              const { isTracking } = useLocationTrackingStore.getState();
              if (!isTracking) {
                await useLocationTrackingStore.getState().startTracking(normalizedUser);
              }
            } catch (error) {
              console.warn('Failed to start location tracking in checkAuth:', error);
              // Don't block auth check if location tracking fails
            }
          }

          return true;
        }
      }

      // Fallback to local storage if Firebase user not found
      const token = await storage.get<string>(STORAGE_KEYS.AUTH_TOKEN);
      const cachedUser = await storage.get<User>(STORAGE_KEYS.CURRENT_USER);

      if (token && cachedUser) {
        // Normalize role from cached user data
        const normalizedUser = normalizeUser(cachedUser);
        
        console.log('CheckAuth - Cached role:', cachedUser.role, 'Normalized role:', normalizedUser.role);
        
        set({
          user: normalizedUser,
          token,
          isAuthenticated: true,
          isLoading: false,
        });

        // Start location tracking for bookers if not already tracking
        if (normalizedUser.role === 'booker') {
          try {
            const { useLocationTrackingStore } = await import('./locationTrackingStore');
            const { isTracking } = useLocationTrackingStore.getState();
            if (!isTracking) {
              await useLocationTrackingStore.getState().startTracking(normalizedUser);
            }
          } catch (error) {
            console.warn('Failed to start location tracking in checkAuth (cached):', error);
            // Don't block auth check if location tracking fails
          }
        }

        return true;
      }

      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      });
      return false;
    } catch (error) {
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      });
      return false;
    }
  },

  updateProfile: async (data: Partial<User>) => {
    set({ isLoading: true, error: null });
    try {
      const { user } = get();
      if (!user) {
        set({ error: 'User not found', isLoading: false });
        return false;
      }

      const updatedUser = { ...user, ...data, updatedAt: new Date().toISOString() };
      
      // Update in Firestore
      const { firestoreService } = await import('../services/firebase');
      const { COLLECTIONS } = await import('../services/firebase/collections');
      await firestoreService.setDoc(COLLECTIONS.USERS, updatedUser);

      // Update local storage
      await storage.set(STORAGE_KEYS.CURRENT_USER, updatedUser);
      set({ user: updatedUser, isLoading: false });
      return true;
    } catch (error: any) {
      set({ error: error.message || 'Failed to update profile', isLoading: false });
      return false;
    }
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    set({ isLoading: true, error: null });
    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        set({ error: 'User not authenticated', isLoading: false });
        return false;
      }

      // Re-authenticate user
      const { EmailAuthProvider, reauthenticateWithCredential, updatePassword } = await import('firebase/auth');
      const credential = EmailAuthProvider.credential(firebaseUser.email || '', currentPassword);
      await reauthenticateWithCredential(firebaseUser, credential);

      // Update password
      await updatePassword(firebaseUser, newPassword);
      
      set({ isLoading: false });
      return true;
    } catch (error: any) {
      set({ error: error.message || 'Failed to change password', isLoading: false });
      return false;
    }
  },

  clearError: () => set({ error: null }),
}));
