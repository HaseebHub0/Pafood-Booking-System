import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Image, ActivityIndicator } from 'react-native';
import { UserRole } from '../../types';
import { colors, typography, spacing } from '../../theme';

interface RoleBasedSplashProps {
  role: UserRole;
  onFinish: () => void;
}

export const RoleBasedSplash: React.FC<RoleBasedSplashProps> = ({ role, onFinish }) => {
  const fadeIn = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  const fadeOut = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Fade in animation
    Animated.parallel([
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 4,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto hide after 2 seconds
    const timer = setTimeout(() => {
      Animated.timing(fadeOut, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        onFinish();
      });
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  // Determine splash screen content based on role
  const getSplashContent = () => {
    switch (role) {
      case 'booker':
        return {
          title: 'PAFood Booker',
          subtitle: 'Order Booking System',
          backgroundColor: colors.primary[500], // Red
        };
      case 'salesman':
        return {
          title: 'PAFood Salesman',
          subtitle: 'Delivery Management',
          backgroundColor: colors.secondary[500], // Green
        };
      default:
        return {
          title: 'PAFood',
          subtitle: 'Order Booking System',
          backgroundColor: colors.primary[500],
        };
    }
  };

  const splashContent = getSplashContent();

  return (
    <Animated.View style={[styles.container, { backgroundColor: splashContent.backgroundColor, opacity: fadeOut }]}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeIn,
            transform: [{ scale }],
          },
        ]}
      >
        {/* Logo Image */}
        <View style={styles.imageContainer}>
          <Image
            source={require('../../../assets/logo.webp')}
            style={styles.splashImage}
            resizeMode="contain"
          />
        </View>

        {/* Title */}
        <Text style={styles.title}>{splashContent.title}</Text>

        {/* Subtitle */}
        <Text style={styles.subtitle}>{splashContent.subtitle}</Text>

        {/* Loading Indicator */}
        <ActivityIndicator
          size="small"
          color={colors.white}
          style={styles.loader}
        />
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  imageContainer: {
    width: 200,
    height: 200,
    marginBottom: spacing.xl,
  },
  splashImage: {
    width: '100%',
    height: '100%',
  },
  title: {
    ...typography.h1,
    color: colors.white,
    fontWeight: 'bold',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.white,
    opacity: 0.9,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  loader: {
    marginTop: spacing.lg,
  },
});

