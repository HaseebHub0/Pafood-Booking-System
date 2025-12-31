import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import { Product } from '../../types';

interface ProductCardProps {
  product: Product;
  quantity?: number;
  onAdd?: () => void;
  onIncrease?: () => void;
  onDecrease?: () => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  quantity = 0,
  onAdd,
  onIncrease,
  onDecrease,
}) => {
  const isInCart = quantity > 0;

  return (
    <View style={styles.container}>
      <View style={styles.imageContainer}>
        <Ionicons name="cube-outline" size={40} color={colors.primary[500]} />
      </View>

      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>
        <Text style={styles.unit}>{product.unit}</Text>
        <Text style={styles.price}>Rs. {product.price.toLocaleString()}</Text>
        <View style={styles.discountBadge}>
          <Text style={styles.discountText}>Max discount: {product.maxDiscount}%</Text>
        </View>
      </View>

      <View style={styles.actions}>
        {isInCart ? (
          <View style={styles.quantityControls}>
            <TouchableOpacity style={styles.controlButton} onPress={onDecrease}>
              <Ionicons name="remove" size={18} color={colors.primary[500]} />
            </TouchableOpacity>
            <Text style={styles.quantity}>{quantity}</Text>
            <TouchableOpacity style={styles.controlButton} onPress={onIncrease}>
              <Ionicons name="add" size={18} color={colors.primary[500]} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.addButton} onPress={onAdd}>
            <Ionicons name="add" size={20} color={colors.text.inverse} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  imageContainer: {
    width: 70,
    height: 70,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    marginBottom: 2,
  },
  unit: {
    ...typography.caption,
    color: colors.text.muted,
    marginBottom: spacing.xs,
  },
  price: {
    ...typography.h4,
    color: colors.primary[500],
  },
  discountBadge: {
    backgroundColor: colors.gray[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
  },
  discountText: {
    ...typography.caption,
    color: colors.text.muted,
    fontSize: 10,
  },
  actions: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  controlButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary[200],
  },
  quantity: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    minWidth: 32,
    textAlign: 'center',
  },
});

