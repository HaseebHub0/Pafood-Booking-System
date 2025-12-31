import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import { Shop } from '../../types';
import { CITIES, AREAS } from '../../types/common';

interface ShopCardProps {
  shop: Shop;
  onPress: () => void;
  onCreateOrder?: () => void;
}

export const ShopCard: React.FC<ShopCardProps> = ({
  shop,
  onPress,
  onCreateOrder,
}) => {
  const cityLabel = CITIES.find((c) => c.value === shop.city)?.label || shop.city;
  const areaLabel = AREAS[shop.city]?.find((a) => a.value === shop.area)?.label || shop.area;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.iconContainer}>
        <Ionicons name="storefront" size={28} color={colors.primary[500]} />
      </View>

      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.shopName} numberOfLines={1}>
            {shop.shopName}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="person-outline" size={14} color={colors.gray[500]} />
          <Text style={styles.infoText}>{shop.ownerName}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={14} color={colors.gray[500]} />
          <Text style={styles.infoText} numberOfLines={1}>
            {areaLabel}, {cityLabel}
          </Text>
        </View>
        {shop.phone && (
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={14} color={colors.gray[500]} />
            <Text style={styles.infoText}>{shop.phone}</Text>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        {onCreateOrder && (
          <TouchableOpacity
            style={[styles.actionButton, styles.orderButton]}
            onPress={(e) => {
              e.stopPropagation();
              onCreateOrder();
            }}
          >
            <Ionicons name="cart-outline" size={18} color={colors.primary[500]} />
          </TouchableOpacity>
        )}
        <Ionicons name="chevron-forward" size={20} color={colors.gray[400]} />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  content: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  shopName: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    flex: 1,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  infoText: {
    ...typography.caption,
    color: colors.text.secondary,
    marginLeft: spacing.xs,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderButton: {
    backgroundColor: colors.primary[50],
  },
});
