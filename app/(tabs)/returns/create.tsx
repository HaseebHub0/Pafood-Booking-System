import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  FlatList,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useShopStore, useProductStore, useReturnStore } from '../../../src/stores';
import { Card, Button, LoadingSpinner, SearchBar } from '../../../src/components';
import { colors, typography, spacing, borderRadius, shadows } from '../../../src/theme';
import { ReturnReason } from '../../../src/types/return';
import { Shop } from '../../../src/types/shop';
import { Product } from '../../../src/types';
import { CITIES, AREAS } from '../../../src/types/common';

const RETURN_REASONS: { label: string; value: ReturnReason; icon: string }[] = [
  { label: 'Expired', value: 'expired', icon: 'time-outline' },
  { label: 'Damaged', value: 'damaged', icon: 'warning-outline' },
  { label: 'Wrong Product', value: 'wrong_product', icon: 'swap-horizontal-outline' },
  { label: 'Defective', value: 'defective', icon: 'close-circle-outline' },
  { label: 'Other', value: 'other', icon: 'ellipsis-horizontal-outline' },
];

interface ReturnItem {
  productId: string;
  product: Product;
  quantity: number;
  unitPrice: number;
  returnReason: ReturnReason;
  condition?: string;
}

export default function CreateReturnScreen() {
  const { shops, loadShops, isLoading: shopsLoading } = useShopStore();
  const { products, loadProducts, isLoading: productsLoading } = useProductStore();
  const { createReturn, isLoading: returnLoading } = useReturnStore();

  const [step, setStep] = useState<'shop' | 'products' | 'summary'>('shop');
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [notes, setNotes] = useState('');
  const [shopNotes, setShopNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadShops();
    loadProducts();
  }, []);

  const handleSelectShop = (shop: Shop) => {
    setSelectedShop(shop);
    setStep('products');
  };

  const handleAddProduct = (product: Product) => {
    const existingItem = returnItems.find((item) => item.productId === product.id);
    if (existingItem) {
      setReturnItems(
        returnItems.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      setReturnItems([
        ...returnItems,
        {
          productId: product.id,
          product,
          quantity: 1,
          unitPrice: product.price,
          returnReason: 'expired',
        },
      ]);
    }
  };

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      setReturnItems(returnItems.filter((item) => item.productId !== productId));
    } else {
      setReturnItems(
        returnItems.map((item) =>
          item.productId === productId ? { ...item, quantity } : item
        )
      );
    }
  };

  const handleUpdateReason = (productId: string, reason: ReturnReason) => {
    setReturnItems(
      returnItems.map((item) =>
        item.productId === productId ? { ...item, returnReason: reason } : item
      )
    );
  };

  const handleRemoveItem = (productId: string) => {
    setReturnItems(returnItems.filter((item) => item.productId !== productId));
  };

  const handleNext = () => {
    if (step === 'shop' && selectedShop) {
      setStep('products');
    } else if (step === 'products' && returnItems.length > 0) {
      setStep('summary');
    }
  };

  const handleBack = () => {
    if (step === 'products') {
      setStep('shop');
    } else if (step === 'summary') {
      setStep('products');
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return; // Prevent duplicate submits
    
    if (!selectedShop || returnItems.length === 0) {
      Alert.alert('Error', 'Please select a shop and add at least one item');
      return;
    }

    setIsSubmitting(true);
    try {
      const returnData = {
        shopId: selectedShop.id,
        items: returnItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unit: item.product.unit,
          unitPrice: item.unitPrice,
          returnReason: item.returnReason,
          condition: item.condition,
        })),
        notes: notes.trim() || undefined,
        shopNotes: shopNotes.trim() || undefined,
      };

      const newReturn = await createReturn(returnData);
      
      // Show success toast and navigate back
      if (Platform.OS !== 'web') {
        try {
          const Toast = require('react-native-toast-message').default;
          Toast.show({
            type: 'success',
            text1: 'Return Created',
            text2: `Return ${newReturn.returnNumber} has been submitted successfully`,
            position: 'top',
            visibilityTime: 3000,
          });
        } catch (error) {
          // Toast not available, just navigate
        }
      }
      
      // Navigate back to returns list
      router.replace('/(tabs)/returns');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create return');
      setIsSubmitting(false);
    }
  };

  const filteredShops = shops.filter((shop) =>
    shop.shopName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    shop.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    shop.phone?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredProducts = products.filter((product) =>
    product.isActive &&
    (product.name.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
      product.sku.toLowerCase().includes(productSearchQuery.toLowerCase()))
  );

  const totalValue = returnItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  );

  const renderShopSelection = () => (
    <View style={styles.stepContainer}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Select Shop</Text>
          <Text style={styles.subtitle}>Choose shop for stock return</Text>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by shop name, owner, or phone..."
        />
      </View>

      {filteredShops.length > 0 && (
        <View style={styles.resultsCount}>
          <Text style={styles.resultsText}>
            {filteredShops.length} {filteredShops.length === 1 ? 'shop' : 'shops'} found
          </Text>
        </View>
      )}

      <FlatList
        data={filteredShops}
        keyExtractor={(item) => item.id}
        renderItem={({ item: shop }) => {
          const cityLabel = CITIES.find((c) => c.value === shop.city)?.label || shop.city;
          const areaLabel = AREAS[shop.city]?.find((a) => a.value === shop.area)?.label || shop.area;

          return (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => handleSelectShop(shop)}
            >
              <Card style={styles.shopCard}>
                <View style={styles.shopCardContent}>
                  {/* Shop Icon */}
                  <View style={styles.shopIcon}>
                    <Ionicons name="storefront" size={24} color={colors.primary[500]} />
                  </View>

                  {/* Shop Info */}
                  <View style={styles.shopInfo}>
                    <View style={styles.shopHeader}>
                      <Text style={styles.shopName} numberOfLines={1} ellipsizeMode="tail">
                        {shop.shopName}
                      </Text>
                    </View>
                    
                    <View style={styles.shopDetails}>
                      <View style={styles.detailRow}>
                        <Ionicons name="person-outline" size={14} color={colors.text.muted} />
                        <Text style={styles.detailText} numberOfLines={1} ellipsizeMode="tail">
                          {shop.ownerName}
                        </Text>
                      </View>
                      
                      <View style={styles.detailRow}>
                        <Ionicons name="location-outline" size={14} color={colors.text.muted} />
                        <Text style={styles.detailText} numberOfLines={1} ellipsizeMode="tail">
                          {areaLabel}, {cityLabel}
                        </Text>
                      </View>
                      
                      {shop.phone && (
                        <View style={styles.detailRow}>
                          <Ionicons name="call-outline" size={14} color={colors.text.muted} />
                          <Text style={styles.detailText}>{shop.phone}</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Arrow */}
                  <Ionicons name="chevron-forward" size={20} color={colors.text.muted} />
                </View>
              </Card>
            </TouchableOpacity>
          );
        }}
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
    </View>
  );

  const renderProductSelection = () => (
    <View style={styles.stepContainer}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Add Products</Text>
          <Text style={styles.subtitle}>{selectedShop?.shopName}</Text>
        </View>
      </View>

      {/* Shop Info Badge */}
      {selectedShop && (
        <View style={styles.shopInfoBadge}>
          <Ionicons name="storefront" size={16} color={colors.primary[500]} />
          <Text style={styles.shopInfoText} numberOfLines={1} ellipsizeMode="tail">
            {selectedShop.shopName}
          </Text>
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
            value={productSearchQuery}
            onChangeText={setProductSearchQuery}
          />
          {productSearchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setProductSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={colors.text.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Selected Items Summary */}
      {returnItems.length > 0 && (
        <View style={styles.selectedItemsSummary}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryInfo}>
              <Ionicons name="cube" size={18} color={colors.primary[500]} />
              <Text style={styles.summaryLabel}>
                {returnItems.length} {returnItems.length === 1 ? 'item' : 'items'} selected
              </Text>
            </View>
            <Text style={styles.summaryValue}>Rs. {totalValue.toLocaleString()}</Text>
          </View>
        </View>
      )}

      {/* Products List */}
      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        renderItem={({ item: product }) => {
          const returnItem = returnItems.find((i) => i.productId === product.id);
          const isInReturn = !!returnItem;

          return (
            <Card style={styles.productCard}>
              <View style={styles.productContent}>
                {/* Product Icon */}
                <View style={[styles.productIcon, isInReturn && styles.productIconActive]}>
                  <Ionicons 
                    name="cube" 
                    size={28} 
                    color={isInReturn ? colors.text.inverse : colors.primary[500]} 
                  />
                </View>

                {/* Product Info */}
                <View style={styles.productInfo}>
                  <Text style={styles.productName} numberOfLines={2}>
                    {product.name}
                  </Text>
                  <View style={styles.productMeta}>
                    <Text style={styles.productUnit}>{product.unit}</Text>
                    <Text style={styles.productPrice}>
                      Rs. {product.price.toLocaleString()}
                    </Text>
                  </View>
                  {isInReturn && (
                    <View style={styles.returnReasonBadge}>
                      <Ionicons
                        name={RETURN_REASONS.find((r) => r.value === returnItem.returnReason)?.icon || 'help-circle'}
                        size={12}
                        color={colors.warning}
                      />
                      <Text style={styles.returnReasonText}>
                        {RETURN_REASONS.find((r) => r.value === returnItem.returnReason)?.label}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Quantity Controls */}
                <View style={styles.quantityContainer}>
                  {isInReturn ? (
                    <View style={styles.quantityControls}>
                      <TouchableOpacity
                        style={[styles.quantityButton, styles.quantityButtonDecrease]}
                        onPress={() => handleUpdateQuantity(product.id, returnItem.quantity - 1)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="remove" size={18} color={colors.text.inverse} />
                      </TouchableOpacity>
                      <View style={styles.quantityDisplay}>
                        <Text style={styles.quantityText}>{returnItem.quantity}</Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.quantityButton, styles.quantityButtonIncrease]}
                        onPress={() => handleUpdateQuantity(product.id, returnItem.quantity + 1)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="add" size={18} color={colors.text.inverse} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.addButton}
                      onPress={() => handleAddProduct(product)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="add" size={24} color={colors.text.inverse} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Return Reason Selector - Show when product is added */}
              {isInReturn && (
                <View style={styles.returnReasonSection}>
                  <Text style={styles.returnReasonLabel}>Return Reason:</Text>
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.returnReasonOptions}
                  >
                    {RETURN_REASONS.map((reason) => (
                      <TouchableOpacity
                        key={reason.value}
                        style={[
                          styles.returnReasonButton,
                          returnItem.returnReason === reason.value && styles.returnReasonButtonActive,
                        ]}
                        onPress={() => handleUpdateReason(product.id, reason.value)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={reason.icon as any}
                          size={16}
                          color={
                            returnItem.returnReason === reason.value
                              ? colors.text.inverse
                              : colors.text.secondary
                          }
                        />
                        <Text
                          style={[
                            styles.returnReasonButtonText,
                            returnItem.returnReason === reason.value &&
                              styles.returnReasonButtonTextActive,
                          ]}
                        >
                          {reason.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <TouchableOpacity
                    style={styles.removeItemButton}
                    onPress={() => handleRemoveItem(product.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={16} color={colors.error} />
                    <Text style={styles.removeItemText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              )}
            </Card>
          );
        }}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={64} color={colors.gray[300]} />
            <Text style={styles.emptyTitle}>No products found</Text>
            <Text style={styles.emptyText}>
              {productSearchQuery 
                ? 'Try adjusting your search' 
                : 'No products available'}
            </Text>
          </View>
        }
      />

      {/* Footer with Cart Summary */}
      {returnItems.length > 0 && (
        <View style={styles.footer}>
          <View style={styles.cartSummary}>
            <View style={styles.cartInfo}>
              <View style={styles.cartRow}>
                <Ionicons name="cube" size={18} color={colors.primary[500]} />
                <Text style={styles.cartLabel}>
                  {returnItems.reduce((sum, item) => sum + item.quantity, 0)}{' '}
                  {returnItems.reduce((sum, item) => sum + item.quantity, 0) === 1 ? 'item' : 'items'}
                </Text>
              </View>
              <Text style={styles.cartTotal}>Rs. {totalValue.toLocaleString()}</Text>
            </View>
          </View>
          <Button
            title="Review Return"
            onPress={handleNext}
            fullWidth
            size="lg"
            variant="secondary"
            icon={<Ionicons name="arrow-forward" size={20} color={colors.text.inverse} />}
            iconPosition="right"
          />
        </View>
      )}
    </View>
  );

  const renderSummary = () => (
    <ScrollView style={styles.stepContainer} contentContainerStyle={styles.summaryContent}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Review Return</Text>
          <Text style={styles.subtitle}>Confirm return details</Text>
        </View>
      </View>

      {/* Shop Info */}
      <Card style={styles.summaryCard}>
        <View style={styles.shopRow}>
          <Ionicons name="storefront" size={24} color={colors.primary[500]} />
          <View style={styles.shopInfo}>
            <Text style={styles.shopLabel}>Return for</Text>
            <Text style={styles.shopName}>{selectedShop?.shopName}</Text>
            <Text style={styles.shopOwner}>{selectedShop?.ownerName}</Text>
          </View>
        </View>
      </Card>

      {/* Return Items */}
      <Text style={styles.sectionTitle}>Return Items ({returnItems.length})</Text>
      {returnItems.map((item) => (
        <Card key={item.productId} style={styles.itemCard}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemName}>{item.product.name}</Text>
            <Text style={styles.itemValue}>
              Rs. {(item.quantity * item.unitPrice).toLocaleString()}
            </Text>
          </View>
          <View style={styles.itemDetails}>
            <Text style={styles.itemDetail}>
              {item.quantity} {item.product.unit} × Rs. {item.unitPrice.toLocaleString()}
            </Text>
            <View style={styles.reasonBadge}>
              <Ionicons
                name={RETURN_REASONS.find((r) => r.value === item.returnReason)?.icon || 'help-circle'}
                size={14}
                color={colors.primary[500]}
              />
              <Text style={styles.reasonText}>
                {RETURN_REASONS.find((r) => r.value === item.returnReason)?.label}
              </Text>
            </View>
          </View>
        </Card>
      ))}

      {/* Notes */}
      <Card style={styles.notesCard}>
        <Text style={styles.inputLabel}>Internal Notes (Optional)</Text>
        <TextInput
          style={styles.notesInput}
          value={notes}
          onChangeText={setNotes}
          placeholder="Add internal notes..."
          placeholderTextColor={colors.text.muted}
          multiline
          numberOfLines={3}
        />
      </Card>

      <Card style={styles.notesCard}>
        <Text style={styles.inputLabel}>Shop Notes (Optional)</Text>
        <TextInput
          style={styles.notesInput}
          value={shopNotes}
          onChangeText={setShopNotes}
          placeholder="Notes from shopkeeper..."
          placeholderTextColor={colors.text.muted}
          multiline
          numberOfLines={3}
        />
      </Card>

      {/* Total */}
      <Card style={styles.totalCard}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total Return Value</Text>
          <Text style={styles.totalValue}>Rs. {totalValue.toLocaleString()}</Text>
        </View>
      </Card>

      <View style={styles.footer}>
        <Button
          title={isSubmitting || returnLoading ? 'Submitting...' : 'Submit Return'}
          onPress={handleSubmit}
          disabled={isSubmitting || returnLoading}
          fullWidth
          size="lg"
          variant="secondary"
          icon={<Ionicons name="checkmark-circle" size={24} color={colors.text.inverse} />}
          style={styles.submitButton}
        />
      </View>
    </ScrollView>
  );

  if (shopsLoading || productsLoading) {
    return <LoadingSpinner fullScreen message="Loading..." />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {step === 'shop' && renderShopSelection()}
      {step === 'products' && renderProductSelection()}
      {step === 'summary' && renderSummary()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  stepContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  headerContent: {
    flex: 1,
  },
  title: {
    ...typography.h3,
    color: colors.text.primary,
    fontWeight: '700',
  },
  subtitle: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: 2,
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
    paddingBottom: 100,
  },
  shopCard: {
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  shopCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  shopIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopInfo: {
    flex: 1,
    minWidth: 0,
  },
  shopHeader: {
    marginBottom: spacing.xs,
  },
  shopName: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    fontWeight: '700',
    fontSize: 15,
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
  shopInfoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginHorizontal: spacing.base,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
    alignSelf: 'flex-start',
  },
  shopInfoText: {
    ...typography.bodyMedium,
    color: colors.primary[700],
    fontWeight: '600',
    fontSize: 13,
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
  selectedItemsSummary: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.primary[50],
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primary[100],
  },
  summaryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  summaryLabel: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
    fontWeight: '600',
    fontSize: 13,
  },
  summaryValue: {
    ...typography.h4,
    color: colors.primary[500],
    fontWeight: '800',
    fontSize: 18,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.base,
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
  productPrice: {
    ...typography.bodyMedium,
    color: colors.primary[500],
    fontWeight: '700',
    fontSize: 14,
  },
  returnReasonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.warning + '15',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    gap: 4,
    marginTop: 4,
  },
  returnReasonText: {
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
  returnReasonSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  returnReasonLabel: {
    ...typography.captionMedium,
    color: colors.text.secondary,
    fontWeight: '600',
    marginBottom: spacing.sm,
    fontSize: 12,
  },
  returnReasonOptions: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  returnReasonButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    backgroundColor: colors.gray[100],
    gap: spacing.xs,
    marginRight: spacing.xs,
  },
  returnReasonButtonActive: {
    backgroundColor: colors.primary[500],
  },
  returnReasonButtonText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '600',
    fontSize: 11,
  },
  returnReasonButtonTextActive: {
    color: colors.text.inverse,
  },
  removeItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    backgroundColor: colors.error + '15',
    gap: spacing.xs,
  },
  removeItemText: {
    ...typography.caption,
    color: colors.error,
    fontWeight: '600',
    fontSize: 11,
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.md,
    backgroundColor: colors.error + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs,
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
  nextButton: {
    ...shadows.md,
  },
  submitButton: {
    ...shadows.md,
  },
  summaryContent: {
    padding: spacing.base,
    paddingBottom: 100,
  },
  summaryCard: {
    marginBottom: spacing.lg,
    padding: spacing.md,
  },
  shopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  shopLabel: {
    ...typography.caption,
    color: colors.text.muted,
  },
  itemCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  itemName: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    fontWeight: '600',
    flex: 1,
  },
  itemValue: {
    ...typography.bodyMedium,
    color: colors.primary[500],
    fontWeight: '700',
  },
  itemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemDetail: {
    ...typography.caption,
    color: colors.text.muted,
  },
  reasonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  reasonText: {
    ...typography.caption,
    color: colors.primary[500],
    fontWeight: '600',
    fontSize: 11,
  },
  notesCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  inputLabel: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  notesInput: {
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...typography.body,
    color: colors.text.primary,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  totalCard: {
    marginBottom: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.primary[50],
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    ...typography.h4,
    color: colors.text.primary,
    fontWeight: '600',
  },
  totalValue: {
    ...typography.h3,
    color: colors.primary[500],
    fontWeight: '800',
  },
});



