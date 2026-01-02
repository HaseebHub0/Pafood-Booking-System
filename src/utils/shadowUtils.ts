import { Platform, ViewStyle, TextStyle } from 'react-native';

/**
 * Converts React Native shadow props to CSS boxShadow for web compatibility
 * Maintains native shadow props for iOS/Android
 * 
 * On web, returns only boxShadow to avoid deprecated prop warnings
 * On native, returns shadow* props and elevation
 */
export const createShadowStyle = (
  shadowColor: string = '#000',
  shadowOffset: { width: number; height: number } = { width: 0, height: 0 },
  shadowOpacity: number = 0,
  shadowRadius: number = 0,
  elevation?: number
): ViewStyle => {
  const isWeb = Platform.OS === 'web';
  
  if (isWeb) {
    // Convert to CSS boxShadow format: offset-x offset-y blur-radius spread-radius color
    const offsetX = shadowOffset.width;
    const offsetY = shadowOffset.height;
    const blur = shadowRadius;
    const spread = 0; // React Native doesn't have spread, use 0
    
    // Convert shadowColor with opacity to rgba
    let color = shadowColor;
    if (shadowOpacity !== undefined && shadowOpacity !== 1) {
      // Try to extract RGB from hex color
      if (shadowColor.startsWith('#')) {
        const hex = shadowColor.slice(1);
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        color = `rgba(${r}, ${g}, ${b}, ${shadowOpacity})`;
      } else if (shadowColor.startsWith('rgba')) {
        // Already rgba, just update opacity
        color = shadowColor.replace(/rgba?\([^)]+\)/, (match) => {
          const values = match.match(/\d+/g);
          if (values && values.length >= 3) {
            return `rgba(${values[0]}, ${values[1]}, ${values[2]}, ${shadowOpacity})`;
          }
          return match;
        });
      }
    }
    
    // On web, return ONLY boxShadow - no native shadow props
    return {
      boxShadow: `${offsetX}px ${offsetY}px ${blur}px ${spread}px ${color}`,
    } as ViewStyle;
  }
  
  // Native platforms: use original shadow props (no boxShadow)
  return {
    shadowColor,
    shadowOffset,
    shadowOpacity,
    shadowRadius,
    ...(elevation !== undefined && { elevation }),
  };
};

/**
 * Converts React Native text shadow props to CSS textShadow for web compatibility
 * 
 * On web, returns only textShadow to avoid deprecated prop warnings
 * On native, returns textShadow* props
 */
export const createTextShadowStyle = (
  textShadowColor: string = '#000',
  textShadowOffset: { width: number; height: number } = { width: 0, height: 0 },
  textShadowRadius: number = 0
): TextStyle => {
  const isWeb = Platform.OS === 'web';
  
  if (isWeb) {
    const offsetX = textShadowOffset.width;
    const offsetY = textShadowOffset.height;
    const blur = textShadowRadius;
    
    // On web, return ONLY textShadow - no native textShadow* props
    return {
      textShadow: `${offsetX}px ${offsetY}px ${blur}px ${textShadowColor}`,
    } as TextStyle;
  }
  
  // Native platforms: use original text shadow props (no textShadow)
  return {
    textShadowColor,
    textShadowOffset,
    textShadowRadius,
  };
};


