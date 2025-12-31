import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useShopStore, useLedgerStore, useAuthStore } from '../../../../src/stores';
import {
  Card,
  Button,
  EmptyState,
  TransactionRow,
} from '../../../../src/components';
import { colors, typography, spacing, borderRadius, shadows } from '../../../../src/theme';
import { LedgerTransaction, TransactionType } from '../../../../src/types/ledger';

type FilterType = 'all' | TransactionType;

export default function ShopLedgerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getShopById } = useShopStore();
  const { getShopTransactions, loadTransactions } = useLedgerStore();
  const { user } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');

  const shop = getShopById(id);
  const allTransactions = getShopTransactions(id);

  // Role-based restrictions: Bookers cannot access ledger
  const isBooker = user?.role === 'booker';
  const isSalesman = user?.role === 'salesman';

  // Block bookers from accessing ledger
  if (isBooker) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.notFound}>
          <Ionicons name="lock-closed" size={64} color={colors.gray[300]} />
          <Text style={styles.notFoundText}>Access Restricted</Text>
          <Text style={styles.notFoundSubtext}>
            Bookers cannot access ledger information. Please contact your administrator.
          </Text>
          <Button title="Go Back" onPress={() => router.back()} variant="outline" />
        </View>
      </SafeAreaView>
    );
  }

  useEffect(() => {
    loadTransactions();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTransactions();
    setRefreshing(false);
  };

  const filteredTransactions = useMemo(() => {
    let transactions = allTransactions.filter(t => {
      // Handle both old shopId and new party_id field
      const transactionShopId = (t as any).shopId || (t as any).party_id;
      return transactionShopId === id;
    });

    if (filter !== 'all') {
      transactions = transactions.filter(t => {
        // Handle both old and new transaction types
        if (filter === 'SALE_DELIVERED') {
          return t.type === 'SALE_DELIVERED' || t.type === 'SALE';
        }
        return t.type === filter;
      });
    }

    return transactions;
  }, [allTransactions, id, filter]);


  const filterOptions: { value: FilterType; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'SALE_DELIVERED', label: 'Sales' },
    { value: 'RETURN', label: 'Returns' },
    { value: 'ADJUSTMENT', label: 'Adjustments' },
  ];

  // Calculate cash-only stats from transactions
  const shopStats = useMemo(() => {
    const shopTransactions = allTransactions.filter(t => {
      // Handle both old shopId and new party_id field
      const transactionShopId = (t as any).shopId || (t as any).party_id;
      return transactionShopId === id;
    });

    const totalSales = shopTransactions
      .filter(t => t.type === 'SALE_DELIVERED' || t.type === 'SALE')
      .reduce((sum, t) => sum + ((t as any).net_cash || Math.abs((t as any).amount || 0)), 0);

    const totalReturns = shopTransactions
      .filter(t => t.type === 'RETURN')
      .reduce((sum, t) => sum + Math.abs((t as any).net_cash || Math.abs((t as any).amount || 0)), 0);

    const netCash = totalSales - totalReturns;

    return {
      totalSales,
      totalReturns,
      netCash,
      transactionCount: shopTransactions.length,
    };
  }, [allTransactions, id]);

  if (!shop) {
    return (
      <View style={styles.notFound}>
        <Ionicons name="alert-circle-outline" size={64} color={colors.gray[300]} />
        <Text style={styles.notFoundText}>Shop not found</Text>
        <Button title="Go Back" onPress={() => router.back()} variant="outline" />
      </View>
    );
  }

  const renderHeader = () => (
    <View>
      {/* Transaction Summary Card */}
      <Card style={styles.summaryCard}>
        <View style={styles.shopHeader}>
          <View style={styles.shopInfo}>
            <Text style={styles.shopName} numberOfLines={1} ellipsizeMode="tail">
              {shop.shopName}
            </Text>
            <Text style={styles.shopOwner} numberOfLines={1} ellipsizeMode="tail">
              {shop.ownerName}
            </Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Total Sales</Text>
            <Text style={styles.statValue}>
              Rs. {(shopStats.totalSales || 0).toLocaleString()}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Total Returns</Text>
            <Text style={[styles.statValue, shopStats.totalReturns > 0 && styles.statValueRed]}>
              Rs. {(shopStats.totalReturns || 0).toLocaleString()}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Net Cash</Text>
            <Text style={[styles.statValue, shopStats.netCash >= 0 ? styles.statValueGreen : styles.statValueRed]}>
              Rs. {(shopStats.netCash || 0).toLocaleString()}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Transactions</Text>
            <Text style={styles.statValue}>
              {shopStats.transactionCount || 0}
            </Text>
          </View>
        </View>
      </Card>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <Text style={styles.sectionTitle}>Transaction History</Text>
        <View style={styles.filterTabs}>
          {filterOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.filterTab,
                filter === option.value && styles.filterTabActive,
              ]}
              onPress={() => setFilter(option.value)}
            >
              <Text
                style={[
                  styles.filterTabText,
                  filter === option.value && styles.filterTabTextActive,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  const renderTransaction = ({ item }: { item: LedgerTransaction }) => (
    <TransactionRow transaction={item} />
  );

  const renderEmpty = () => (
    <EmptyState
      icon="receipt-outline"
      title="No Transactions"
      message={
        filter === 'all'
          ? 'No transactions recorded for this shop yet.'
          : `No ${filter.toLowerCase()} transactions found.`
      }
    />
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={filteredTransactions}
        renderItem={renderTransaction}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary[500]}
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
  listContent: {
    padding: spacing.base,
    paddingBottom: spacing['2xl'],
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  notFoundText: {
    ...typography.h4,
    color: colors.text.muted,
    marginVertical: spacing.lg,
  },
  notFoundSubtext: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  summaryCard: {
    marginBottom: spacing.lg,
  },
  shopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  shopInfo: {
    flex: 1,
  },
  shopName: {
    ...typography.h3,
    color: colors.text.primary,
  },
  shopOwner: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  statItem: {
    width: '45%',
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.muted,
    marginBottom: 2,
  },
  statValue: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  statValueGreen: {
    color: colors.success,
  },
  statValueRed: {
    color: colors.error,
  },
  filterContainer: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  filterTabs: {
    flexDirection: 'row',
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.lg,
    padding: 4,
  },
  filterTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.md,
  },
  filterTabActive: {
    backgroundColor: colors.surface,
    ...shadows.sm,
  },
  filterTabText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  filterTabTextActive: {
    color: colors.text.primary,
    fontWeight: '600',
  },
});

