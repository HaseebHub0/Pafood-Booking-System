import React, { useRef } from 'react';
import { View, StyleSheet, ViewStyle, TouchableOpacity, StyleProp, Animated } from 'react-native';
import { colors, spacing, borderRadius, shadows, animations } from '../../theme';

interface CardProps {
  children: React.ReactNode;
  variant?: 'elevated' | 'outlined' | 'filled';
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  padding?: keyof typeof spacing;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'elevated',
  onPress,
  style,
  padding = 'base',
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (!onPress) return;
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: animations.scale.pressed,
        useNativeDriver: true,
        friction: 4,
        tension: 40,
      }),
      Animated.timing(opacityAnim, {
        toValue: animations.opacity.pressed,
        duration: animations.duration.fast,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    if (!onPress) return;
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 4,
        tension: 40,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: animations.duration.fast,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const cardStyles = [
    styles.base,
    styles[variant],
    { padding: spacing[padding] },
    style,
  ];

  const animatedStyle = {
    transform: [{ scale: scaleAnim }],
    opacity: opacityAnim,
  };

  if (onPress) {
    return (
      <Animated.View style={animatedStyle}>
        <TouchableOpacity
          style={cardStyles}
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={1}
        >
          {children}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return <View style={cardStyles}>{children}</View>;
};

const styles = StyleSheet.create({
  base: {
    borderRadius: borderRadius.lg,
    backgroundColor: colors.card,
  },
  elevated: {
    ...shadows.md,
  },
  outlined: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  filled: {
    backgroundColor: colors.gray[50],
  },
});

