import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Image, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/stores';
import { colors, typography, spacing } from '../src/theme';

export default function SplashScreen() {
  const { isAuthenticated, isLoading } = useAuthStore();
  
  // Animation values
  const logoScale = useRef(new Animated.Value(0.5)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoRotation = useRef(new Animated.Value(0)).current;
  const appNameOpacity = useRef(new Animated.Value(0)).current;
  const appNameTranslateY = useRef(new Animated.Value(20)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const taglineTranslateY = useRef(new Animated.Value(20)).current;
  const loadingOpacity = useRef(new Animated.Value(0)).current;
  const gradientAnim = useRef(new Animated.Value(0)).current;
  const fadeOutOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Start all animations
    const animations = [
      // Logo scale and fade in with bounce
      Animated.parallel([
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(logoRotation, {
          toValue: 1,
          duration: 800,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      // App name fade in and slide up
      Animated.parallel([
        Animated.timing(appNameOpacity, {
          toValue: 1,
          duration: 400,
          delay: 300,
          useNativeDriver: true,
        }),
        Animated.timing(appNameTranslateY, {
          toValue: 0,
          duration: 400,
          delay: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      // Tagline fade in and slide up
      Animated.parallel([
        Animated.timing(taglineOpacity, {
          toValue: 1,
          duration: 400,
          delay: 500,
          useNativeDriver: true,
        }),
        Animated.timing(taglineTranslateY, {
          toValue: 0,
          duration: 400,
          delay: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      // Loading indicator fade in
      Animated.timing(loadingOpacity, {
        toValue: 1,
        duration: 300,
        delay: 700,
        useNativeDriver: true,
      }),
    ];

    Animated.sequence(animations).start();

    // Continuous gradient animation
    Animated.loop(
      Animated.timing(gradientAnim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    ).start();
  }, []);

  // Fade out animation before navigation
  useEffect(() => {
    if (!isLoading) {
      Animated.timing(fadeOutOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isLoading]);

  if (!isLoading && isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  if (!isLoading && !isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  const logoRotationInterpolate = logoRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Gradient background using multiple layers
  const gradientOpacity = gradientAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 0.6, 0.3],
  });

  return (
    <Animated.View style={[styles.container, { opacity: fadeOutOpacity }]}>
      {/* Base Background */}
      <View style={styles.baseBackground} />
      
      {/* Animated Gradient Overlay */}
      <Animated.View 
        style={[
          styles.gradientOverlay,
          { opacity: gradientOpacity }
        ]} 
      />

      {/* Animated Background Pattern */}
      <View style={styles.backgroundPattern}>
        {[...Array(20)].map((_, i) => (
          <View
            key={i}
            style={[
              styles.patternCircle,
              {
                left: `${(i % 5) * 25}%`,
                top: `${Math.floor(i / 5) * 20}%`,
                opacity: 0.03 + (i % 3) * 0.02,
              },
            ]}
          />
        ))}
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {/* Logo with rotation animation */}
        <Animated.View
          style={[
            styles.logoContainer,
            {
              transform: [
                { scale: logoScale },
                { rotate: logoRotationInterpolate },
              ],
              opacity: logoOpacity,
            },
          ]}
        >
          <View style={styles.logoWrapper}>
            <Image 
              source={require('../assets/logo.webp')} 
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
        </Animated.View>

        {/* App Name */}
        <Animated.View
          style={[
            styles.textContainer,
            {
              opacity: appNameOpacity,
              transform: [{ translateY: appNameTranslateY }],
            },
          ]}
        >
          <Text style={styles.appName}>PAFood</Text>
        </Animated.View>

        {/* Tagline */}
        <Animated.View
          style={[
            styles.textContainer,
            {
              opacity: taglineOpacity,
              transform: [{ translateY: taglineTranslateY }],
            },
          ]}
        >
          <Text style={styles.tagline}>Order Booking System</Text>
        </Animated.View>
      </View>

      {/* Loading Indicator */}
      <Animated.View style={[styles.footer, { opacity: loadingOpacity }]}>
        <ActivityIndicator 
          size="small" 
          color={colors.text.inverse} 
          style={styles.loader}
        />
        <Text style={styles.footerText}>Loading...</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary[500],
  },
  baseBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.primary[500],
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.primary[600],
  },
  backgroundPattern: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  patternCircle: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: colors.text.inverse,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrapper: {
    width: 200,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  textContainer: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  appName: {
    fontSize: 48,
    fontWeight: '800',
    color: colors.text.inverse,
    letterSpacing: -1.5,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  tagline: {
    ...typography.h4,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  footer: {
    position: 'absolute',
    bottom: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loader: {
    marginBottom: spacing.sm,
  },
  footerText: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
    fontSize: 12,
  },
});

