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
    locationWatcher = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 60000, // 1 minute
        distanceInterval: 50, // Update if moved 50m
      },
      async (location) => {
        await updateLocationToFirebase(location, booker);
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
  } catch (error) {
    console.error('[LocationTracking] Error updating location to Firestore:', error);
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
  } catch (error) {
    console.error('[LocationTracking] Error marking booker offline:', error);
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

