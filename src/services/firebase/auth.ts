import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  updateProfile,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { enableNetwork } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { firestoreService } from './firestore';
import { COLLECTIONS } from './collections';
import { User, UserRole } from '../../types/auth';

/**
 * Firebase Auth Service
 */
class FirebaseAuthService {
  /**
   * Normalize user role to ensure it matches UserRole type
   * Supports: booker, salesman, admin, kpo
   */
  private normalizeRole(role: any): UserRole {
    if (!role || typeof role !== 'string') {
      return 'booker'; // Default fallback
    }
    
    const roleLower = role.toLowerCase().trim();
    
    // Map to correct role values
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
  }

  /**
   * Sign in with email and password
   * Includes retry logic for network errors
   */
  async signIn(email: string, password: string, retryCount: number = 0): Promise<User> {
    const maxRetries = 2;
    const retryDelay = 1000; // 1 second
    
    try {
      // Force enable Firestore network before login
      try {
        await enableNetwork(db);
        console.log('[Auth] Firestore network enabled');
      } catch (networkError: any) {
        // If already enabled, that's fine
        if (networkError.code !== 'failed-precondition') {
          console.warn('[Auth] Network enable warning:', networkError.message);
        }
      }

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      // Get user data from Firestore with retry logic
      let userData: User | null = null;
      let firestoreError: any = null;
      
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          // Ensure network is enabled before each attempt
          if (attempt > 0) {
            try {
              await enableNetwork(db);
              console.log(`[Auth] Re-enabled network for retry ${attempt}`);
            } catch (e) {
              // Ignore if already enabled
            }
          }

          userData = await firestoreService.getDoc<User>(
            COLLECTIONS.USERS,
            firebaseUser.uid
          );
          break; // Success, exit retry loop
        } catch (error: any) {
          firestoreError = error;
          const isOfflineError = error.message?.includes('offline') || 
                                error.message?.includes('Failed to get document') ||
                                error.message?.includes('client is offline') ||
                                error.code === 'unavailable';
          
          if (isOfflineError && attempt < maxRetries) {
            console.log(`[Auth] Firestore offline error, retrying... (${attempt + 1}/${maxRetries})`);
            console.log(`[Auth] Error details: ${error.message}`);
            await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
            continue;
          } else {
            throw error; // Re-throw if not offline error or max retries reached
          }
        }
      }
      
      if (!userData) {
        const errorMsg = firestoreError?.message || 'User data not found';
        throw new Error(`User data not found in Firestore: ${errorMsg}`);
      }
      
      // Map maxDiscount to maxDiscountPercent if needed (for dashboard compatibility)
      if ((userData as any).maxDiscount !== undefined && (userData as any).maxDiscount !== null && !userData.maxDiscountPercent) {
        userData.maxDiscountPercent = (userData as any).maxDiscount;
      }
      
      // Normalize role to ensure it matches UserRole type (admin, kpo, booker, salesman)
      const normalizedRole = this.normalizeRole(userData.role);
      const normalizedUser: User = {
        ...userData,
        role: normalizedRole,
      };
      
      console.log('[Auth] Login successful');
      console.log('[Auth] Raw role from DB:', userData.role, 'Type:', typeof userData.role);
      console.log('[Auth] Normalized role:', normalizedRole);
      console.log('[Auth] User ID:', firebaseUser.uid);
      console.log('[Auth] User email:', firebaseUser.email);
      
      return normalizedUser;
    } catch (error: any) {
      console.error('Error signing in:', error);
      
      // Handle network errors with retry logic
      if (error.code === 'auth/network-request-failed' && retryCount < maxRetries) {
        console.log(`Network error, retrying... (${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, retryDelay * (retryCount + 1)));
        return this.signIn(email, password, retryCount + 1);
      }
      
      // Provide user-friendly error messages
      let errorMessage = 'Failed to sign in';
      
      if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network connection failed. Please check your internet connection and try again.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address. Please check and try again.';
      } else if (error.code === 'auth/user-disabled') {
        errorMessage = 'This account has been disabled. Please contact support.';
      } else if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email address.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password. Please try again.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed login attempts. Please try again later.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      throw new Error(errorMessage);
    }
  }

  /**
   * Sign up new user
   */
  async signUp(
    email: string,
    password: string,
    userData: Omit<User, 'id' | 'email'>
  ): Promise<User> {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      // Create user document in Firestore
      const newUser: User = {
        id: firebaseUser.uid,
        email: firebaseUser.email || email,
        ...userData,
      };
      
      await firestoreService.setDoc(COLLECTIONS.USERS, newUser);
      
      // Update Firebase Auth profile
      if (userData.name) {
        await updateProfile(firebaseUser, {
          displayName: userData.name,
        });
      }
      
      return newUser;
    } catch (error: any) {
      console.error('Error signing up:', error);
      throw new Error(error.message || 'Failed to sign up');
    }
  }

  /**
   * Sign out
   */
  async signOut(): Promise<void> {
    try {
      await signOut(auth);
    } catch (error: any) {
      console.error('Error signing out:', error);
      throw new Error(error.message || 'Failed to sign out');
    }
  }

  /**
   * Get current user
   */
  getCurrentUser(): FirebaseUser | null {
    return auth.currentUser;
  }

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChanged(callback: (user: FirebaseUser | null) => void): () => void {
    return onAuthStateChanged(auth, callback);
  }

  /**
   * Reset password
   */
  async resetPassword(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
      console.error('Error sending password reset email:', error);
      throw new Error(error.message || 'Failed to send password reset email');
    }
  }

  /**
   * Get user data from Firestore
   */
  async getUserData(userId: string): Promise<User | null> {
    try {
      const userData = await firestoreService.getDoc<User>(COLLECTIONS.USERS, userId);
      
      if (!userData) {
        return null;
      }
      
      // Map maxDiscount to maxDiscountPercent if needed (for dashboard compatibility)
      if ((userData as any).maxDiscount !== undefined && (userData as any).maxDiscount !== null && !userData.maxDiscountPercent) {
        userData.maxDiscountPercent = (userData as any).maxDiscount;
      }
      
      // Normalize role to ensure it's lowercase (booker or salesman)
      return {
        ...userData,
        role: this.normalizeRole(userData.role),
      };
    } catch (error) {
      console.error('Error getting user data:', error);
      return null;
    }
  }
}

export const firebaseAuthService = new FirebaseAuthService();
export default firebaseAuthService;


