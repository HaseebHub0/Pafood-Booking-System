import * as Location from 'expo-location';
import { LocationCoordinates } from './location';
import { firestoreService } from './firebase';
import { COLLECTIONS } from './firebase/collections';
import { BookerLocation } from '../types/location';
import { User } from '../types/auth';

let locationWatcher: Location.LocationSubscription | null = null;
let currentBooker: User | null = null;

/**
 * Start continuous location tracking for a booker
 */
export const startLocationTracking = async (booker: User): Promise<boolean> => {
  try {
    // Only allow bookers to track their location
    // Salesmen don't have permission to write to booker_locations collection
    const normalizedRole = booker.role?.toLowerCase();
    if (normalizedRole !== 'booker') {
      console.log('[LocationTracking] Location tracking is only available for bookers. Current role:', booker.role);
      return false;
    }

    // Stop any existing tracking
    if (locationWatcher) {
      await stopLocationTracking();
    }

    currentBooker = booker;

    // Check and request background location permission
    const { checkBackgroundLocationPermission, requestBackgroundLocationPermission } = await import('./location');
    const permission = await checkBackgroundLocationPermission();
    
    if (!permission.granted) {
      const requested = await requestBackgroundLocationPermission();
      if (!requested.granted) {
        console.warn('Background location permission not granted. Tracking may not work in background.');
        // Continue with foreground permission for now
      }
    }

    // Start watching position
    // Use currentBooker in callback to ensure we always use the latest booker reference
    locationWatcher = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 60000, // 1 minute
        distanceInterval: 50, // Update if moved 50m
      },
      async (location) => {
        // Use currentBooker to ensure we have the latest reference
        // If currentBooker is null or not a booker, the update will be skipped
        if (currentBooker) {
          await updateLocationToFirebase(location, currentBooker);
        }
      }
    );

    console.log('[LocationTracking] Started location tracking for booker:', booker.id);
    return true;
  } catch (error) {
    console.error('[LocationTracking] Error starting location tracking:', error);
    return false;
  }
};

/**
 * Stop location tracking
 */
export const stopLocationTracking = async (): Promise<void> => {
  try {
    if (locationWatcher) {
      locationWatcher.remove();
      locationWatcher = null;
    }

    // Mark as offline in Firestore if we have a current booker
    if (currentBooker) {
      await markBookerOffline(currentBooker.id);
      currentBooker = null;
    }

    console.log('[LocationTracking] Stopped location tracking');
  } catch (error) {
    console.error('[LocationTracking] Error stopping location tracking:', error);
  }
};

/**
 * Update location to Firestore
 */
const updateLocationToFirebase = async (
  location: Location.LocationObject,
  booker: User
): Promise<void> => {
  try {
    // Double-check role before attempting to write
    const normalizedRole = booker.role?.toLowerCase();
    if (normalizedRole !== 'booker') {
      // Silently skip - this shouldn't happen if startLocationTracking was called correctly
      return;
    }

    const now = new Date().toISOString();
    
    // Get existing document to preserve createdAt
    const existingDoc = await firestoreService.getDoc<BookerLocation>(
      COLLECTIONS.BOOKER_LOCATIONS,
      booker.id
    );

    const locationData: BookerLocation = {
      id: booker.id,
      bookerId: booker.id,
      bookerName: booker.name,
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      lastUpdated: now,
      isOnline: true,
      regionId: booker.regionId,
      branch: booker.branch,
      createdAt: existingDoc?.createdAt || now,
      updatedAt: now,
      syncStatus: 'synced',
    };

    // Only include optional fields if they have valid values (not null/undefined)
    if (location.coords.accuracy != null) {
      locationData.accuracy = location.coords.accuracy;
    }
    if (location.coords.heading != null) {
      locationData.heading = location.coords.heading;
    }
    if (location.coords.speed != null) {
      locationData.speed = location.coords.speed;
    }

    // Use setDoc with merge to create or update the location document
    await firestoreService.setDoc(COLLECTIONS.BOOKER_LOCATIONS, locationData, true);

    console.log('[LocationTracking] Updated location for booker:', booker.id);
  } catch (error: any) {
    // Handle permission errors gracefully - don't spam console
    if (error?.code === 'permission-denied' || 
        error?.message?.includes('Missing or insufficient permissions') ||
        error?.message?.includes('permission')) {
      // Silently handle permission errors - this is expected for non-booker roles
      // or when security rules don't allow the write
      return;
    }
    
    // Log other errors (network issues, etc.) but don't spam
    console.warn('[LocationTracking] Error updating location to Firestore:', error?.message || error);
  }
};

/**
 * Mark booker as offline in Firestore
 */
const markBookerOffline = async (bookerId: string): Promise<void> => {
  try {
    const locationDoc = await firestoreService.getDoc<BookerLocation>(
      COLLECTIONS.BOOKER_LOCATIONS,
      bookerId
    );

    if (locationDoc) {
      await firestoreService.updateDoc(COLLECTIONS.BOOKER_LOCATIONS, bookerId, {
        isOnline: false,
        lastUpdated: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      console.log('[LocationTracking] Marked booker as offline:', bookerId);
    }
  } catch (error: any) {
    // Handle permission errors gracefully
    if (error?.code === 'permission-denied' || 
        error?.message?.includes('Missing or insufficient permissions') ||
        error?.message?.includes('permission')) {
      // Silently handle permission errors
      return;
    }
    
    // Log other errors
    console.warn('[LocationTracking] Error marking booker offline:', error?.message || error);
  }
};

/**
 * Get current location coordinates (for immediate use)
 */
export const getCurrentLocationCoordinates = async (): Promise<LocationCoordinates | null> => {
  try {
    const { getCurrentLocation } = await import('./location');
    return await getCurrentLocation();
  } catch (error) {
    console.error('[LocationTracking] Error getting current location:', error);
    return null;
  }
};

