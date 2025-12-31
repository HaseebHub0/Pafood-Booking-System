import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useProductStore, useOrderStore } from '../../../../src/stores';
import { LoadingSpinner, Button, Card } from '../../../../src/components';
import { colors, typography, spacing, borderRadius, shadows } from '../../../../src/theme';
import { Product, ProductCategory } from '../../../../src/types';

const CATEGORIES: { label: string; value: ProductCategory | 'all'; icon: string }[] = [
  { label: 'All', value: 'all', icon: 'grid-outline' },
  { label: 'Rice', value: 'rice', icon: 'cube-outline' },
  { label: 'Oil', value: 'oil', icon: 'water-outline' },
  { label: 'Flour', value: 'flour', icon: 'basket-outline' },
  { label: 'Beverages', value: 'beverages', icon: 'wine-outline' },
  { label: 'Spices', value: 'spices', icon: 'leaf-outline' },
];

export default function ProductSelectionScreen() {
  const { products, loadProducts, isLoading, selectedCategory, setSelectedCategory } = useProductStore();
  const { currentOrder, addItem, updateItemQuantity } = useOrderStore();
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    // Redirect if no current order
    if (!currentOrder) {
      router.replace('/(tabs)/orders/create');
    }
  }, [currentOrder]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      if (!product.isActive) return false;
      if (selectedCategory !== 'all' && product.category !== selectedCategory) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          product.name.toLowerCase().includes(query) ||
          product.sku.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [products, selectedCategory, searchQuery]);

  const getQuantityInCart = (productId: string): number => {
    const item = currentOrder?.items.find((i) => i.productId === productId);
    return item?.quantity || 0;
  };

  const handleIncrease = (product: Product) => {
    const item = currentOrder?.items.find((i) => i.productId === product.id);
    if (item) {
      updateItemQuantity(item.id, item.quantity + 1);
    } else {
      addItem(product, 1);
    }
  };

  const handleDecrease = (product: Product) => {
    const item = currentOrder?.items.find((i) => i.productId === product.id);
    if (item && item.quantity > 0) {
      updateItemQuantity(item.id, item.quantity - 1);
    }
  };

  const handleNext = () => {
    if ((currentOrder?.items.reduce((sum, item) => sum + item.quantity, 0) || 0) > 0) {
      router.push('/(tabs)/orders/create/summary');
    }
  };

  const totalItems = currentOrder?.items.reduce((sum, item) => sum + item.quantity, 0) || 0;
  const totalAmount = currentOrder?.grandTotal || 0;

  const renderProduct = ({ item }: { item: Product }) => {
    const quantity = getQuantityInCart(item.id);
    const isInCart = quantity > 0;

    return (
      <Card style={styles.productCard}>
        <View style={styles.productContent}>
          {/* Product Icon/Image */}
          <View style={[styles.productIcon, isInCart && styles.productIconActive]}>
            <Ionicons 
              name="cube" 
              size={28} 
              color={isInCart ? colors.text.inverse : colors.primary[500]} 
            />
          </View>

          {/* Product Info */}
          <View style={styles.productInfo}>
            <Text style={styles.productName} numberOfLines={2}>
              {item.name}
            </Text>
            <View style={styles.productMeta}>
              <Text style={styles.productUnit}>{item.unit}</Text>
              <View style={styles.priceContainer}>
                <Text style={styles.productPrice}>
                  Rs. {item.price.toLocaleString()}
                </Text>
              </View>
            </View>
            {item.maxDiscount > 0 && (
              <View style={styles.discountBadge}>
                <Ionicons name="pricetag-outline" size={12} color={colors.warning} />
                <Text style={styles.discountText}>
                  Max {item.maxDiscount}% discount
                </Text>
              </View>
            )}
          </View>

          {/* Quantity Controls */}
          <View style={styles.quantityContainer}>
            {isInCart ? (
              <View style={styles.quantityControls}>
                <TouchableOpacity
                  style={[styles.quantityButton, styles.quantityButtonDecrease]}
                  onPress={() => handleDecrease(item)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="remove" size={18} color={colors.text.inverse} />
                </TouchableOpacity>
                <View style={styles.quantityDisplay}>
                  <Text style={styles.quantityText}>{quantity}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.quantityButton, styles.quantityButtonIncrease]}
                  onPress={() => handleIncrease(item)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={18} color={colors.text.inverse} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => handleIncrease(item)}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={24} color={colors.text.inverse} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Card>
    );
  };

  if (isLoading && products.length === 0) {
    return <LoadingSpinner fullScreen message="Loading products..." />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Step Indicator */}
      <View style={styles.stepIndicator}>
        <View style={styles.stepItem}>
          <View style={[styles.stepCircle, styles.stepCircleCompleted]}>
            <Ionicons name="checkmark" size={16} color={colors.text.inverse} />
          </View>
          <Text style={styles.stepTextCompleted}>Shop</Text>
        </View>
        <View style={[styles.stepLine, styles.stepLineActive]} />
        <View style={styles.stepItem}>
          <View style={[styles.stepCircle, styles.stepCircleActive]}>
            <Text style={styles.stepNumberActive}>2</Text>
          </View>
          <Text style={styles.stepTextActive}>Products</Text>
        </View>
        <View style={styles.stepLine} />
        <View style={styles.stepItem}>
          <View style={styles.stepCircle}>
            <Text style={styles.stepNumber}>3</Text>
          </View>
          <Text style={styles.stepText}>Summary</Text>
        </View>
      </View>

      {/* Header with Shop Info */}
      {currentOrder && (
        <View style={styles.header}>
          <View style={styles.shopInfoBadge}>
            <Ionicons name="storefront" size={16} color={colors.primary[500]} />
            <Text style={styles.shopInfoText} numberOfLines={1} ellipsizeMode="tail">
              {currentOrder.shopName}
            </Text>
          </View>
        </View>
      )}

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={colors.text.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products..."
            placeholderTextColor={colors.text.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={colors.text.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Categories */}
      <View style={styles.categoriesContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesList}
        >
          {CATEGORIES.map((category) => {
            const isActive = selectedCategory === category.value;
            return (
              <TouchableOpacity
                key={category.value}
                style={[
                  styles.categoryButton,
                  isActive && styles.categoryButtonActive,
                ]}
                onPress={() => setSelectedCategory(category.value)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={category.icon as any}
                  size={18}
                  color={isActive ? colors.text.inverse : colors.text.secondary}
                />
                <Text
                  style={[
                    styles.categoryText,
                    isActive && styles.categoryTextActive,
                  ]}
                >
                  {category.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Products List */}
      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        renderItem={renderProduct}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={64} color={colors.gray[300]} />
            <Text style={styles.emptyTitle}>No products found</Text>
            <Text style={styles.emptyText}>
              {searchQuery 
                ? 'Try adjusting your search or filter' 
                : 'No products available in this category'}
            </Text>
          </View>
        }
      />

      {/* Cart Summary & Next Button */}
      <View style={styles.footer}>
        {totalItems > 0 && (
          <View style={styles.cartSummary}>
            <View style={styles.cartInfo}>
              <View style={styles.cartRow}>
                <Ionicons name="cart" size={18} color={colors.primary[500]} />
                <Text style={styles.cartLabel}>{totalItems} {totalItems === 1 ? 'item' : 'items'}</Text>
              </View>
              <Text style={styles.cartTotal}>Rs. {totalAmount.toLocaleString()}</Text>
            </View>
          </View>
        )}
        <Button
          title={totalItems > 0 ? "Review Order" : "Add products to continue"}
          onPress={handleNext}
          disabled={totalItems === 0}
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
  stepCircleCompleted: {
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
  stepTextCompleted: {
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
    backgroundColor: colors.primary[500],
  },
  header: {
    padding: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  shopInfoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
    alignSelf: 'flex-start',
  },
  shopInfoText: {
    ...typography.bodyMedium,
    color: colors.primary[700],
    fontWeight: '600',
    fontSize: 13,
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.text.primary,
    fontSize: 14,
    padding: 0,
  },
  categoriesContainer: {
    marginBottom: spacing.sm,
  },
  categoriesList: {
    paddingHorizontal: spacing.base,
    gap: spacing.sm,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray[100],
    gap: spacing.xs,
    marginRight: spacing.sm,
  },
  categoryButtonActive: {
    backgroundColor: colors.primary[500],
    ...shadows.sm,
  },
  categoryText: {
    ...typography.captionMedium,
    color: colors.text.secondary,
    fontWeight: '600',
    fontSize: 12,
  },
  categoryTextActive: {
    color: colors.text.inverse,
  },
  listContent: {
    padding: spacing.base,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  productCard: {
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  productContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  productIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  productIconActive: {
    backgroundColor: colors.primary[500],
  },
  productInfo: {
    flex: 1,
    minWidth: 0,
  },
  productName: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    fontWeight: '600',
    fontSize: 15,
    marginBottom: spacing.xs,
  },
  productMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  productUnit: {
    ...typography.caption,
    color: colors.text.muted,
    fontSize: 12,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  productPrice: {
    ...typography.bodyMedium,
    color: colors.primary[500],
    fontWeight: '700',
    fontSize: 14,
  },
  discountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.warning + '15',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    gap: 4,
    marginTop: 2,
  },
  discountText: {
    ...typography.caption,
    color: colors.warning,
    fontSize: 10,
    fontWeight: '600',
  },
  quantityContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.md,
    padding: 2,
    gap: 2,
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButtonDecrease: {
    backgroundColor: colors.primary[600],
  },
  quantityButtonIncrease: {
    backgroundColor: colors.primary[400],
  },
  quantityDisplay: {
    minWidth: 36,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityText: {
    ...typography.bodyMedium,
    color: colors.text.inverse,
    fontWeight: '700',
    fontSize: 14,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
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
  cartSummary: {
    marginBottom: spacing.md,
  },
  cartInfo: {
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray[100],
  },
  cartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  cartLabel: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
    fontWeight: '600',
    fontSize: 13,
  },
  cartTotal: {
    ...typography.h3,
    color: colors.primary[500],
    fontWeight: '800',
    fontSize: 20,
  },
});
