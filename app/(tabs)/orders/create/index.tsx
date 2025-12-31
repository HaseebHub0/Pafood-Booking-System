import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useShopStore, useOrderStore, useAuthStore } from '../../../../src/stores';
import { SearchBar, LoadingSpinner, Button, Card } from '../../../../src/components';
import { colors, typography, spacing, borderRadius, shadows } from '../../../../src/theme';
import { Shop } from '../../../../src/types';
import { CITIES, AREAS } from '../../../../src/types/common';

export default function SelectShopScreen() {
  const { shops, loadShops, isLoading } = useShopStore();
  const { createOrder } = useOrderStore();
  const { user } = useAuthStore();
  
  useEffect(() => {
    // Redirect if not booker
    if (user?.role !== 'booker') {
      router.replace('/(tabs)/orders');
    }
  }, [user]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);

  useEffect(() => {
    loadShops();
  }, []);

  const filteredShops = searchQuery
    ? shops.filter(
        (shop) =>
          shop.shopName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          shop.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          shop.phone?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : shops;

  const handleShopSelect = (shop: Shop) => {
    setSelectedShopId(shop.id);
  };

  const handleNext = () => {
    if (selectedShopId) {
      createOrder(selectedShopId);
      router.push('/(tabs)/orders/create/products');
    }
  };

  const renderShop = ({ item }: { item: Shop }) => {
    const isSelected = selectedShopId === item.id;
    const cityLabel = CITIES.find((c) => c.value === item.city)?.label || item.city;
    const areaLabel = AREAS[item.city]?.find((a) => a.value === item.area)?.label || item.area;

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => handleShopSelect(item)}
      >
        <Card style={[styles.shopCard, isSelected && styles.shopCardSelected]}>
          <View style={styles.shopCardContent}>
            {/* Shop Icon */}
            <View style={[styles.shopIcon, isSelected && styles.shopIconSelected]}>
              <Ionicons 
                name="storefront" 
                size={24} 
                color={isSelected ? colors.text.inverse : colors.primary[500]} 
              />
            </View>

            {/* Shop Info */}
            <View style={styles.shopInfo}>
              <View style={styles.shopHeader}>
                <Text style={styles.shopName} numberOfLines={1} ellipsizeMode="tail">
                  {item.shopName}
                </Text>
                {isSelected && (
                  <View style={styles.selectedBadge}>
                    <Ionicons name="checkmark-circle" size={20} color={colors.primary[500]} />
                  </View>
                )}
              </View>
              
              <View style={styles.shopDetails}>
                <View style={styles.detailRow}>
                  <Ionicons name="person-outline" size={14} color={colors.text.muted} />
                  <Text style={styles.detailText} numberOfLines={1} ellipsizeMode="tail">
                    {item.ownerName}
                  </Text>
                </View>
                
                <View style={styles.detailRow}>
                  <Ionicons name="location-outline" size={14} color={colors.text.muted} />
                  <Text style={styles.detailText} numberOfLines={1} ellipsizeMode="tail">
                    {areaLabel}, {cityLabel}
                  </Text>
                </View>
                
                {item.phone && (
                  <View style={styles.detailRow}>
                    <Ionicons name="call-outline" size={14} color={colors.text.muted} />
                    <Text style={styles.detailText}>{item.phone}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Radio Indicator */}
            <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
          {isSelected && <View style={styles.radioInner} />}
        </View>
        </View>
        </Card>
      </TouchableOpacity>
    );
  };

  if (isLoading && shops.length === 0) {
    return <LoadingSpinner fullScreen message="Loading shops..." />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Step Indicator */}
      <View style={styles.stepIndicator}>
        <View style={styles.stepItem}>
          <View style={[styles.stepCircle, styles.stepCircleActive]}>
            <Text style={styles.stepNumberActive}>1</Text>
          </View>
          <Text style={styles.stepTextActive}>Shop</Text>
        </View>
        <View style={[styles.stepLine, styles.stepLineActive]} />
        <View style={styles.stepItem}>
          <View style={styles.stepCircle}>
            <Text style={styles.stepNumber}>2</Text>
          </View>
          <Text style={styles.stepText}>Products</Text>
        </View>
        <View style={styles.stepLine} />
        <View style={styles.stepItem}>
          <View style={styles.stepCircle}>
            <Text style={styles.stepNumber}>3</Text>
          </View>
          <Text style={styles.stepText}>Summary</Text>
        </View>
      </View>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Select Shop</Text>
        <Text style={styles.subtitle}>
          Choose a shop to create an order for
        </Text>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by shop name, owner, or phone..."
        />
      </View>

      {/* Results Count */}
      {filteredShops.length > 0 && (
        <View style={styles.resultsCount}>
          <Text style={styles.resultsText}>
            {filteredShops.length} {filteredShops.length === 1 ? 'shop' : 'shops'} found
          </Text>
        </View>
      )}

      {/* Shops List */}
      <FlatList
        data={filteredShops}
        keyExtractor={(item) => item.id}
        renderItem={renderShop}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="storefront-outline" size={64} color={colors.gray[300]} />
            <Text style={styles.emptyTitle}>No shops found</Text>
            <Text style={styles.emptyText}>
              {searchQuery 
                ? 'Try adjusting your search terms' 
                : 'No shops available at the moment'}
            </Text>
          </View>
        }
      />

      {/* Next Button */}
      <View style={styles.footer}>
        <Button
          title={selectedShopId ? "Continue to Products" : "Select a shop to continue"}
          onPress={handleNext}
          disabled={!selectedShopId}
          fullWidth
          size="lg"
          icon={<Ionicons name="arrow-forward" size={20} color={colors.text.inverse} />}
          iconPosition="right"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stepItem: {
    alignItems: 'center',
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.gray[200],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  stepCircleActive: {
    backgroundColor: colors.primary[500],
  },
  stepNumber: {
    ...typography.captionMedium,
    color: colors.text.muted,
    fontWeight: '600',
  },
  stepNumberActive: {
    ...typography.captionMedium,
    color: colors.text.inverse,
    fontWeight: '700',
  },
  stepText: {
    ...typography.caption,
    color: colors.text.muted,
    fontSize: 11,
  },
  stepTextActive: {
    ...typography.captionMedium,
    color: colors.primary[500],
    fontWeight: '600',
    fontSize: 11,
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: colors.gray[200],
    marginHorizontal: spacing.sm,
    marginBottom: spacing.lg,
  },
  stepLineActive: {
    backgroundColor: colors.primary[300],
  },
  header: {
    padding: spacing.base,
    paddingTop: spacing.md,
  },
  title: {
    ...typography.h3,
    color: colors.text.primary,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.text.muted,
    fontSize: 13,
  },
  searchContainer: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
  },
  resultsCount: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
  },
  resultsText: {
    ...typography.caption,
    color: colors.text.muted,
    fontSize: 12,
  },
  listContent: {
    padding: spacing.base,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  shopCard: {
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
    ...shadows.sm,
  },
  shopCardSelected: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
    ...shadows.md,
  },
  shopCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shopIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  shopIconSelected: {
    backgroundColor: colors.primary[500],
  },
  shopInfo: {
    flex: 1,
    minWidth: 0,
  },
  shopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  shopName: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    fontWeight: '700',
    flex: 1,
    fontSize: 15,
  },
  selectedBadge: {
    marginLeft: spacing.xs,
  },
  shopDetails: {
    gap: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  detailText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 12,
    flex: 1,
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.gray[300],
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  radioOuterSelected: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  radioInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.primary[500],
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing['3xl'],
    paddingTop: spacing['4xl'],
  },
  emptyTitle: {
    ...typography.h4,
    color: colors.text.primary,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  emptyText: {
    ...typography.body,
    color: colors.text.muted,
    textAlign: 'center',
    fontSize: 13,
  },
  footer: {
    padding: spacing.base,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...shadows.lg,
  },
});

