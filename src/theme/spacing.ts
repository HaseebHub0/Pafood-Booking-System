export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
  '4xl': 64,
};

import { createShadowStyle } from '../utils/shadowUtils';

export const borderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 24,
  full: 9999,
};

export const shadows = {
  none: createShadowStyle('transparent', { width: 0, height: 0 }, 0, 0, 0),
  sm: createShadowStyle('#000', { width: 0, height: 1 }, 0.05, 2, 1),
  md: createShadowStyle('#000', { width: 0, height: 2 }, 0.1, 4, 3),
  lg: createShadowStyle('#000', { width: 0, height: 4 }, 0.15, 8, 5),
  xl: createShadowStyle('#000', { width: 0, height: 8 }, 0.2, 16, 8),
  // Enhanced shadows with color
  primary: createShadowStyle('#DC2626', { width: 0, height: 4 }, 0.3, 8, 5),
  secondary: createShadowStyle('#22C55E', { width: 0, height: 4 }, 0.3, 8, 5),
};

// Animation timing constants
export const animations = {
  // Durations (in milliseconds)
  duration: {
    fast: 150,
    normal: 300,
    slow: 500,
    slower: 800,
  },
  // Easing functions
  easing: {
    easeIn: 'ease-in',
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out',
    linear: 'linear',
  },
  // Common animation values
  scale: {
    pressed: 0.95,
    hover: 1.02,
  },
  opacity: {
    disabled: 0.5,
    pressed: 0.8,
    hover: 0.9,
  },
};

