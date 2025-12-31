export { colors } from './colors';
export { typography, fontFamily, fontSize, lineHeight } from './typography';
export { spacing, borderRadius, shadows, animations } from './spacing';

import { colors } from './colors';
import { typography, fontFamily, fontSize, lineHeight } from './typography';
import { spacing, borderRadius, shadows, animations } from './spacing';

export const theme = {
  colors,
  typography,
  fontFamily,
  fontSize,
  lineHeight,
  spacing,
  borderRadius,
  shadows,
  animations,
};

export type Theme = typeof theme;

