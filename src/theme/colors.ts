+68// PAFood Brand Colors - Red & Green Theme
export const colors = {
  // Primary - Vibrant Red
  primary: {
    50: '#FEF2F2',
    100: '#FEE2E2',
    200: '#FECACA',
    300: '#FCA5A5',
    400: '#F87171',
    500: '#DC2626', // Main brand red
    600: '#B91C1C',
    700: '#991B1B',
    800: '#7F1D1D',
    900: '#450A0A',
  },

  // Secondary - Fresh Green
  secondary: {
    50: '#F0FDF4',
    100: '#DCFCE7',
    200: '#BBF7D0',
    300: '#86EFAC',
    400: '#4ADE80',
    500: '#22C55E', // Main brand green
    600: '#16A34A',
    700: '#15803D',
  },

  // Accent - Deep Green for highlights
  accent: {
    500: '#059669',
    600: '#047857',
  },

  // Neutral - Cool grays
  gray: {
    50: '#FAFAFA',
    100: '#F5F5F5',
    200: '#E5E5E5',
    300: '#D4D4D4',
    400: '#A3A3A3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
  },

  // Status Colors
  status: {
    draft: '#F59E0B',      // Amber
    submitted: '#22C55E',  // Green
    editRequested: '#3B82F6', // Blue
    approved: '#22C55E',   // Green
    rejected: '#DC2626',   // Red
  },

  // Semantic
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#DC2626',
  info: '#3B82F6',

  // Background
  background: '#FAFAFA',
  surface: '#FFFFFF',
  card: '#FFFFFF',

  // Text
  text: {
    primary: '#171717',
    secondary: '#525252',
    muted: '#737373',
    inverse: '#FFFFFF',
  },

  // Border
  border: '#E5E5E5',
  borderFocused: '#DC2626',
};

export type ColorTheme = typeof colors;
