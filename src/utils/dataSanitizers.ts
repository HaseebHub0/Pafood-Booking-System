/**
 * Utility functions for sanitizing data before sending to external services
 */

/**
 * Recursively removes undefined values from an object and its nested objects
 * This is necessary for Firebase Firestore which doesn't allow undefined values
 */
export function removeUndefinedValues<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(removeUndefinedValues) as T;
  }

  if (typeof obj === 'object') {
    const cleanedObj: any = {};

    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleanedObj[key] = removeUndefinedValues(value);
      }
    }

    return cleanedObj;
  }

  return obj;
}

/**
 * Sanitizes an object for Firebase by removing undefined values and converting
 * nested objects/arrays appropriately
 */
export function sanitizeForFirebase<T extends Record<string, any>>(data: T): Partial<T> {
  return removeUndefinedValues(data);
}