import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ViewStyle,
  TextInputProps,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, animations } from '../../theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  required?: boolean;
  helperText?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  containerStyle?: ViewStyle;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  required,
  helperText,
  leftIcon,
  rightIcon,
  onRightIconPress,
  containerStyle,
  secureTextEntry,
  ...textInputProps
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isSecure, setIsSecure] = useState(secureTextEntry);

  const hasError = !!error;
  const borderColorAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (hasError) {
      Animated.timing(borderColorAnim, {
        toValue: 2,
        duration: animations.duration.fast,
        useNativeDriver: false,
      }).start();
    } else if (isFocused) {
      Animated.timing(borderColorAnim, {
        toValue: 1,
        duration: animations.duration.fast,
        useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(borderColorAnim, {
        toValue: 0,
        duration: animations.duration.fast,
        useNativeDriver: false,
      }).start();
    }
  }, [isFocused, hasError]);

  const borderColor = borderColorAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [colors.border, colors.primary[500], colors.error],
  });

  const backgroundColor = borderColorAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [colors.surface, colors.primary[50], '#FEF2F2'],
  });

  const inputContainerStyles = [
    styles.inputContainer,
    isFocused && styles.inputFocused,
    hasError && styles.inputError,
  ].filter(Boolean);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <View style={styles.labelContainer}>
          <Text style={styles.label}>{label}</Text>
          {required && <Text style={styles.required}>*</Text>}
        </View>
      )}

      <Animated.View
        style={[
          inputContainerStyles,
          {
            borderColor,
            backgroundColor,
          },
        ]}
      >
        {leftIcon && (
          <Animated.View>
            <Ionicons
              name={leftIcon}
              size={20}
              color={hasError ? colors.error : isFocused ? colors.primary[500] : colors.gray[400]}
              style={styles.leftIcon}
            />
          </Animated.View>
        )}

        <TextInput
          style={[
            styles.input,
            leftIcon && styles.inputWithLeftIcon,
            (rightIcon || secureTextEntry) && styles.inputWithRightIcon,
          ]}
          placeholderTextColor={colors.gray[400]}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          secureTextEntry={isSecure}
          {...textInputProps}
        />

        {secureTextEntry && (
          <TouchableOpacity
            onPress={() => setIsSecure(!isSecure)}
            style={styles.rightIconButton}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isSecure ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.gray[400]}
            />
          </TouchableOpacity>
        )}

        {rightIcon && !secureTextEntry && (
          <TouchableOpacity
            onPress={onRightIconPress}
            style={styles.rightIconButton}
            disabled={!onRightIconPress}
            activeOpacity={0.7}
          >
            <Ionicons name={rightIcon} size={20} color={colors.gray[400]} />
          </TouchableOpacity>
        )}
      </Animated.View>

      {(error || helperText) && (
        <Text style={[styles.helperText, hasError && styles.errorText]}>
          {error || helperText}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.base,
  },
  labelContainer: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  label: {
    ...typography.label,
    color: colors.text.primary,
  },
  required: {
    ...typography.label,
    color: colors.error,
    marginLeft: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.base,
  },
  inputFocused: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  inputError: {
    borderColor: colors.error,
    backgroundColor: '#FEF2F2',
  },
  input: {
    flex: 1,
    height: 48,
    ...typography.body,
    color: colors.text.primary,
  },
  inputWithLeftIcon: {
    paddingLeft: spacing.sm,
  },
  inputWithRightIcon: {
    paddingRight: spacing.sm,
  },
  leftIcon: {
    marginRight: spacing.xs,
  },
  rightIconButton: {
    padding: spacing.xs,
  },
  helperText: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
  errorText: {
    color: colors.error,
  },
});

