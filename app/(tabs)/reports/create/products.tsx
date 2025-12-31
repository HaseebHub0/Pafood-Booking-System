import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useDailyReportStore } from '../../../../src/stores';
import { Button, ProductSaleRow } from '../../../../src/components';
import { colors, typography, spacing, borderRadius, shadows } from '../../../../src/theme';
import { ProductSaleEntry } from '../../../../src/types';

export default function ProductSalesScreen() {
  const { currentReport, updateProductSale } = useDailyReportStore();
  const [searchQuery, setSearchQuery] = useState('');

  if (!currentReport) {
    router.replace('/(tabs)/reports/create');
    return null;
  }

  const filteredProducts = searchQuery
    ? currentReport.productSales.filter(
        (sale) =>
          sale.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          sale.productNameUrdu.includes(searchQuery)
      )
    : currentReport.productSales;

  const totalSale = currentReport.productSales.reduce(
    (sum, sale) => sum + sale.amount,
    0
  );
  const itemsWithQuantity = currentReport.productSales.filter(
    (sale) => sale.quantity > 0
  ).length;

  const handleNext = () => {
    router.push('/(tabs)/reports/create/shops');
  };

  const handleBack = () => {
    router.back();
  };

  const renderProduct = ({ item, index }: { item: ProductSaleEntry; index: number }) => (
    <ProductSaleRow
      sale={item}
      index={index}
      onQuantityChange={updateProductSale}
    />
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={colors.text.muted} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search products..."
          placeholderTextColor={colors.text.muted}
        />
        {searchQuery ? (
          <Ionicons
            name="close-circle"
            size={20}
            color={colors.text.muted}
            onPress={() => setSearchQuery('')}
          />
        ) : null}
      </View>

      {/* Summary */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{itemsWithQuantity}</Text>
          <Text style={styles.summaryLabel}>Items</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>
            Rs. {totalSale.toLocaleString()}
          </Text>
          <Text style={styles.summaryLabel}>Total Sale</Text>
        </View>
      </View>

      {/* Products List */}
      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.productId}
        renderItem={renderProduct}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text style={styles.listHeaderText}>#</Text>
            <Text style={[styles.listHeaderText, styles.listHeaderProduct]}>
              Product
            </Text>
            <Text style={styles.listHeaderText}>Qty</Text>
            <Text style={[styles.listHeaderText, styles.listHeaderAmount]}>
              Amount
            </Text>
          </View>
        }
        stickyHeaderIndices={[0]}
      />

      {/* Footer */}
      <View style={styles.footer}>
        <Button
          title="Back"
          onPress={handleBack}
          variant="outline"
          style={styles.backButton}
        />
        <Button
          title="Next: Shop Records"
          onPress={handleNext}
          style={styles.nextButton}
          icon="arrow-forward"
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: spacing.base,
    marginVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    height: 44,
    ...shadows.sm,
  },
  searchInput: {
    flex: 1,
    marginLeft: spacing.sm,
    ...typography.body,
    color: colors.text.primary,
  },
  summaryBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    marginHorizontal: spacing.base,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    ...typography.h4,
    color: colors.primary[500],
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.text.muted,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  listContent: {
    paddingBottom: 100,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray[100],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  listHeaderText: {
    ...typography.captionMedium,
    color: colors.text.muted,
    width: 30,
    textAlign: 'center',
  },
  listHeaderProduct: {
    flex: 1,
    textAlign: 'left',
  },
  listHeaderAmount: {
    width: 80,
    textAlign: 'right',
  },
  footer: {
    flexDirection: 'row',
    padding: spacing.base,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  backButton: {
    flex: 1,
  },
  nextButton: {
    flex: 2,
  },
});

