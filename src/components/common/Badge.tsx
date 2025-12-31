import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { colors, spacing, borderRadius, typography } from '../../theme';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'draft' | 'submitted' | 'editRequested';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  style?: ViewStyle;
}

const variantColors: Record<BadgeVariant, { bg: string; text: string }> = {
  default: { bg: colors.gray[200], text: colors.gray[700] },
  success: { bg: '#D1FAE5', text: '#065F46' },
  warning: { bg: '#FEF3C7', text: '#92400E' },
  error: { bg: '#FEE2E2', text: '#991B1B' },
  info: { bg: '#DBEAFE', text: '#1E40AF' },
  draft: { bg: '#FEF3C7', text: '#92400E' },
  submitted: { bg: '#D1FAE5', text: '#065F46' },
  editRequested: { bg: '#DBEAFE', text: '#1E40AF' },
};

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'default',
  size = 'md',
  style,
}) => {
  const colorScheme = variantColors[variant];

  return (
    <View
      style={[
        styles.base,
        styles[`${size}Size`],
        { backgroundColor: colorScheme.bg },
        style,
      ]}
    >
      <Text style={[styles.text, styles[`${size}Text`], { color: colorScheme.text }]}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    borderRadius: borderRadius.full,
  },
  smSize: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  mdSize: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  text: {
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  smText: {
    fontSize: 10,
  },
  mdText: {
    fontSize: 11,
  },
});

