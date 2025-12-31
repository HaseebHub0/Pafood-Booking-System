import { create } from 'zustand';
import { LocationCoordinates } from '../services/location';
import * as locationTrackingService from '../services/locationTracking';
import { User } from '../types/auth';

interface LocationTrackingState {
  isTracking: boolean;
  lastLocation: LocationCoordinates | null;
  error: string | null;
}

interface LocationTrackingActions {
  startTracking: (booker: User) => Promise<boolean>;
  stopTracking: () => Promise<void>;
  updateLocation: (location: LocationCoordinates) => void;
  clearError: () => void;
}

type LocationTrackingStore = LocationTrackingState & LocationTrackingActions;

export const useLocationTrackingStore = create<LocationTrackingStore>((set, get) => ({
  // Initial state
  isTracking: false,
  lastLocation: null,
  error: null,

  // Actions
  startTracking: async (booker: User) => {
    try {
      set({ error: null });
      const success = await locationTrackingService.startLocationTracking(booker);
      
      if (success) {
        set({ isTracking: true });
      } else {
        set({ 
          error: 'Failed to start location tracking. Please check location permissions.',
          isTracking: false 
        });
      }
      
      return success;
    } catch (error: any) {
      console.error('[LocationTrackingStore] Error starting tracking:', error);
      set({ 
        error: error.message || 'Failed to start location tracking',
        isTracking: false 
      });
      return false;
    }
  },

  stopTracking: async () => {
    try {
      await locationTrackingService.stopLocationTracking();
      set({ 
        isTracking: false,
        lastLocation: null,
        error: null 
      });
    } catch (error: any) {
      console.error('[LocationTrackingStore] Error stopping tracking:', error);
      set({ error: error.message || 'Failed to stop location tracking' });
    }
  },

  updateLocation: (location: LocationCoordinates) => {
    set({ lastLocation: location });
  },

  clearError: () => {
    set({ error: null });
  },
}));




