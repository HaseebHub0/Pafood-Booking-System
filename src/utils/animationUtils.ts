import { Platform } from 'react-native';

/**
 * Returns the appropriate useNativeDriver value based on platform
 * On web, native driver is not supported, so always returns false
 * On native platforms, returns the provided value (default: true)
 * 
 * This helps suppress the "useNativeDriver is not supported" warning on web
 */
export const getUseNativeDriver = (preferred: boolean = true): boolean => {
  if (Platform.OS === 'web') {
    return false;
  }
  return preferred;
};

