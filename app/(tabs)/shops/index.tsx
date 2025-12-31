import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Animated,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useShopStore, useOrderStore, useAuthStore } from '../../../src/stores';
import { ShopCard, SearchBar, EmptyState, LoadingSpinner } from '../../../src/components';
import { colors, typography, spacing, borderRadius, shadows, animations } from '../../../src/theme';
import { Shop } from '../../../src/types';

export default function ShopsListScreen() {
  const { shops, loadShops, isLoading } = useShopStore();
  const { createOrder } = useOrderStore();
  const { user } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const searchAnim = useRef(new Animated.Value(0)).current;

  // Role-based visibility
  const isBooker = user?.role === 'booker';
  const isSalesman = user?.role === 'salesman';

  useEffect(() => {
    loadShops();
    
    // Animate search bar
    Animated.timing(searchAnim, {
      toValue: 1,
      duration: animations.duration.slow,
      useNativeDriver: true,
    }).start();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadShops();
    setRefreshing(false);
  };

  const filteredShops = searchQuery
    ? shops.filter(
        (shop) =>
          shop.shopName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          shop.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          shop.city.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : shops;

  const handleShopPress = (shop: Shop) => {
    router.push(`/(tabs)/shops/${shop.id}`);
  };

  const handleCreateOrder = (shop: Shop) => {
    createOrder(shop.id);
    router.push('/(tabs)/orders/create/products');
  };


  const renderShop = ({ item }: { item: Shop }) => (
    <ShopCard
      shop={item}
      onPress={() => handleShopPress(item)}
      onCreateOrder={isBooker ? () => handleCreateOrder(item) : undefined}
    />
  );

  if (isLoading && shops.length === 0) {
    return <LoadingSpinner fullScreen message="Loading shops..." />;
  }

  // Count shops with due balance
  const shopsWithDue = shops.filter((s) => s.currentBalance > 0).length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>My Shops</Text>
        {isBooker && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => router.push('/(tabs)/shops/add')}
          >
            <Ionicons name="add" size={24} color={colors.text.inverse} />
          </TouchableOpacity>
        )}
      </View>

      {/* Search */}
      <Animated.View
        style={[
          styles.searchContainer,
          {
            opacity: searchAnim,
            transform: [
              {
                translateY: searchAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-10, 0],
                }),
              },
            ],
          },
        ]}
      >
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search shops..."
        />
      </Animated.View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{shops.length}</Text>
          <Text style={styles.statLabel}>Total Shops</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.primary[500] }]}>
            {shops.filter((s) => s.isActive).length}
          </Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
      </View>

      {/* Shops List */}
      <FlatList
        data={filteredShops}
        keyExtractor={(item) => item.id}
        renderItem={renderShop}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary[500]}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="storefront-outline"
            title={searchQuery ? 'No shops found' : 'No shops yet'}
            description={
              searchQuery
                ? 'Try a different search term'
                : 'Add your first shop to get started'
            }
            actionLabel={searchQuery || !isBooker ? undefined : 'Add Shop'}
            onAction={searchQuery || !isBooker ? undefined : () => router.push('/(tabs)/shops/add')}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  searchContainer: {
    paddingHorizontal: spacing.base,
    marginBottom: spacing.md,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: spacing.base,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    ...typography.h3,
    color: colors.primary[500],
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
    marginHorizontal: spacing.sm,
  },
  listContent: {
    padding: spacing.base,
    paddingTop: 0,
    paddingBottom: 100, // Space for floating tab bar
  },
});
