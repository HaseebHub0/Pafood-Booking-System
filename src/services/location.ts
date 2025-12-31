import * as Location from 'expo-location';
import { Alert, Platform } from 'react-native';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  heading?: number;
  speed?: number;
}

export interface LocationPermissionStatus {
  granted: boolean;
  canAskAgain: boolean;
  status: Location.PermissionStatus;
}

/**
 * Request location permissions
 */
export const requestLocationPermission = async (): Promise<LocationPermissionStatus> => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    
    return {
      granted: status === 'granted',
      canAskAgain: status !== 'denied',
      status,
    };
  } catch (error) {
    console.error('Error requesting location permission:', error);
    return {
      granted: false,
      canAskAgain: false,
      status: 'denied' as Location.PermissionStatus,
    };
  }
};

/**
 * Check current location permission status
 */
export const checkLocationPermission = async (): Promise<LocationPermissionStatus> => {
  try {
    const { status, canAskAgain } = await Location.getForegroundPermissionsAsync();
    
    return {
      granted: status === 'granted',
      canAskAgain,
      status,
    };
  } catch (error) {
    console.error('Error checking location permission:', error);
    return {
      granted: false,
      canAskAgain: false,
      status: 'denied' as Location.PermissionStatus,
    };
  }
};

/**
 * Get current location coordinates
 */
export const getCurrentLocation = async (): Promise<LocationCoordinates | null> => {
  try {
    // Check permission first
    const permission = await checkLocationPermission();
    if (!permission.granted) {
      const requested = await requestLocationPermission();
      if (!requested.granted) {
        Alert.alert(
          'Location Permission Required',
          'Please enable location access in settings to track visits.',
          [{ text: 'OK' }]
        );
        return null;
      }
    }

    // Get current location
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 5000,
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy || undefined,
      altitude: location.coords.altitude || undefined,
      heading: location.coords.heading || undefined,
      speed: location.coords.speed || undefined,
    };
  } catch (error) {
    console.error('Error getting current location:', error);
    Alert.alert(
      'Location Error',
      'Unable to get your current location. Please check your GPS settings.',
      [{ text: 'OK' }]
    );
    return null;
  }
};

/**
 * Calculate distance between two coordinates (in meters)
 * Uses Haversine formula
 */
export const calculateDistance = (
  coord1: LocationCoordinates,
  coord2: LocationCoordinates
): number => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (coord1.latitude * Math.PI) / 180;
  const φ2 = (coord2.latitude * Math.PI) / 180;
  const Δφ = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
  const Δλ = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};

/**
 * Format distance for display
 */
export const formatDistance = (distanceInMeters: number): string => {
  if (distanceInMeters < 1000) {
    return `${Math.round(distanceInMeters)}m`;
  }
  return `${(distanceInMeters / 1000).toFixed(2)}km`;
};

/**
 * Check if location is within radius of target (in meters)
 */
export const isWithinRadius = (
  currentLocation: LocationCoordinates,
  targetLocation: LocationCoordinates,
  radiusMeters: number
): boolean => {
  const distance = calculateDistance(currentLocation, targetLocation);
  return distance <= radiusMeters;
};

/**
 * Request background location permissions
 */
export const requestBackgroundLocationPermission = async (): Promise<LocationPermissionStatus> => {
  try {
    // First request foreground permission
    const foregroundStatus = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus.status !== 'granted') {
      return {
        granted: false,
        canAskAgain: foregroundStatus.canAskAgain,
        status: foregroundStatus.status,
      };
    }

    // Then request background permission
    const backgroundStatus = await Location.requestBackgroundPermissionsAsync();
    
    return {
      granted: backgroundStatus.status === 'granted',
      canAskAgain: backgroundStatus.canAskAgain,
      status: backgroundStatus.status,
    };
  } catch (error) {
    console.error('Error requesting background location permission:', error);
    return {
      granted: false,
      canAskAgain: false,
      status: 'denied' as Location.PermissionStatus,
    };
  }
};

/**
 * Check background location permission status
 */
export const checkBackgroundLocationPermission = async (): Promise<LocationPermissionStatus> => {
  try {
    const { status, canAskAgain } = await Location.getBackgroundPermissionsAsync();
    
    return {
      granted: status === 'granted',
      canAskAgain,
      status,
    };
  } catch (error) {
    console.error('Error checking background location permission:', error);
    return {
      granted: false,
      canAskAgain: false,
      status: 'denied' as Location.PermissionStatus,
    };
  }
};

