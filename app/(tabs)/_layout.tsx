import React from 'react';
import { Platform } from 'react-native';
import { Tabs, useSegments } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../src/theme';
import { useAuthStore } from '../../src/stores';
import { createShadowStyle } from '../../src/utils/shadowUtils';

export default function TabsLayout() {
  const segments = useSegments();
  const { user } = useAuthStore();
  
  // Role-based visibility
  const isBooker = user?.role === 'booker';
  const isSalesman = user?.role === 'salesman';
  
  // Hide tab bar on form screens
  const hideTabBar = () => {
    // Check if we're on any of these screens
    const hiddenRoutes = [
      'add',      // Add Shop
      'create',   // Create Order/Report/Return flow
      'collect',  // Collect Payment
      'products', // Order products
      'summary',  // Order summary
      'cash',     // Report cash
      'expenses', // Report expenses
      'shops',    // Report shops
      'ledger',   // Shop ledger
    ];
    
    // Check if current segment matches any hidden route
    const hasHiddenRoute = segments.some(segment => hiddenRoutes.includes(segment));
    
    // Hide for [id] routes but NOT for shops/[id] (shops detail page should show navbar)
    const isIdRoute = segments.includes('[id]');
    const isShopsIdRoute = segments.includes('shops') && segments.includes('[id]');
    
    return hasHiddenRoute || (isIdRoute && !isShopsIdRoute);
  };

  const tabBarStyle = hideTabBar() 
    ? { display: 'none' as const }
    : {
        backgroundColor: colors.surface,
        borderTopColor: colors.border,
        borderTopWidth: 0,
        height: Platform.OS === 'ios' ? 85 : 70,
        paddingBottom: Platform.OS === 'ios' ? 25 : 12,
        paddingTop: 10,
        marginHorizontal: spacing.sm,
        marginBottom: spacing.md,
        borderRadius: borderRadius.xl,
        position: 'absolute' as const,
        ...createShadowStyle('#000', { width: 0, height: -4 }, 0.1, 8, 10),
      };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary[500],
        tabBarInactiveTintColor: colors.gray[400],
        tabBarStyle,
        tabBarLabelStyle: {
          ...typography.caption,
          fontWeight: '600',
          fontSize: 10,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="shops"
        options={{
          title: 'Shops',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="storefront" size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="deliveries"
        options={{
          title: 'Deliveries',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cube" size={size - 2} color={color} />
          ),
          href: isSalesman ? undefined : null, // Show for salesmen, hide for others
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cart" size={size - 2} color={color} />
          ),
          href: isBooker ? undefined : null, // Hide for salesmen
        }}
      />
      <Tabs.Screen
        name="work"
        options={{
          title: 'Work',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="briefcase" size={size - 2} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="ellipsis-horizontal" size={size - 2} color={color} />
          ),
        }}
      />
      {/* Hidden tabs - accessible via Work menu */}
      <Tabs.Screen
        name="routes"
        options={{
          href: null, // Hidden from tab bar
        }}
      />
      <Tabs.Screen
        name="visits"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="targets"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="invoices"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="returns"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
