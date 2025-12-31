import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useShopStore, useLedgerStore, useAuthStore, useOutstandingPaymentStore, useBillStore } from '../../../src/stores';
import { Card, EmptyState, SearchBar, CreditBadge } from '../../../src/components';
import { colors, typography, spacing, borderRadius, shadows } from '../../../src/theme';
import { Shop } from '../../../src/types/shop';

export default function PaymentsScreen() {
  const { shops, loadShops } = useShopStore();
  const { getLedgerStats, loadTransactions } = useLedgerStore();
  const { user } = useAuthStore();
  const { outstandingPayments, loadOutstandingPayments, getOutstandingPaymentsBySalesman } = useOutstandingPaymentStore();
  const { bills, loadBills, getPendingCreditBills } = useBillStore();
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyDue, setShowOnlyDue] = useState(true);
  const [activeTab, setActiveTab] = useState<'shops' | 'outstanding'>('outstanding');

  const isSalesman = user?.role === 'salesman';

  useEffect(() => {
    loadShops();
    loadTransactions();
    loadOutstandingPayments();
    loadBills();
  }, []);

  // Get outstanding payments for current salesman
  const salesmanOutstandingPayments = user?.id ? getOutstandingPaymentsBySalesman(user.id) : [];
  
  // Get pending credit bills for current salesman
  const pendingCreditBills = user?.id ? getPendingCreditBills(user.id) : [];

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadShops(), loadTransactions(), loadOutstandingPayments(), loadBills()]);
    setRefreshing(false);
  };

  const handleCollectOutstanding = (orderId: string) => {
    // Find the bill for this order
    const bill = bills.find(b => b.orderId === orderId);
    if (bill) {
      router.push({
        pathname: '/(tabs)/payments/collect',
        params: { billId: bill.id, orderId },
      });
    } else {
      // Fallback to orderId if bill not found
      router.push({
        pathname: '/(tabs)/payments/collect',
        params: { orderId },
      });
    }
  };

  const stats = getLedgerStats();

  // Filter shops based on search and due filter
  const filteredShops = shops.filter((shop) => {
    // Search filter
    const matchesSearch =
      !searchQuery ||
      shop.shopName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shop.ownerName.toLowerCase().includes(searchQuery.toLowerCase());

    // Due filter
    const matchesDue = !showOnlyDue || shop.currentBalance > 0;

    return matchesSearch && matchesDue;
  });

  // Sort by balance descending
  const sortedShops = [...filteredShops].sort(
    (a, b) => b.currentBalance - a.currentBalance
  );

  const handleCollectPayment = (shopId: string) => {
    router.push({
      pathname: '/(tabs)/payments/collect',
      params: { shopId },
    });
  };

  const handleViewLedger = (shopId: string) => {
    router.push(`/(tabs)/shops/${shopId}/ledger`);
  };

  const renderHeader = () => (
    <View>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Payment Collection</Text>
          <Text style={styles.userName}>{user?.name || 'Salesman'}</Text>
        </View>
        <View style={styles.todayStats}>
          <Text style={styles.todayLabel}>Today</Text>
          <Text style={styles.todayValue}>
            Rs. {stats.todayCollections.toLocaleString()}
          </Text>
        </View>
      </View>

      {/* Credit Reminder Banner - Show for salesmen */}
      {isSalesman && pendingCreditBills.length > 0 && (
        <Card style={styles.creditReminderBanner}>
          <View style={styles.creditReminderContent}>
            <Ionicons name="alert-circle" size={24} color={colors.warning} />
            <View style={styles.creditReminderText}>
              <Text style={styles.creditReminderTitle}>
                You have {pendingCreditBills.length} pending credit bill{pendingCreditBills.length > 1 ? 's' : ''}
              </Text>
              <Text style={styles.creditReminderSubtitle}>
                Total remaining: Rs. {pendingCreditBills.reduce((sum, bill) => sum + bill.remainingCredit, 0).toLocaleString()}
              </Text>
            </View>
          </View>
        </Card>
      )}

      {/* Tab Selector - Show for salesmen */}
      {isSalesman && (
        <View style={styles.tabSelector}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'outstanding' && styles.tabActive]}
            onPress={() => setActiveTab('outstanding')}
          >
            <Text style={[styles.tabText, activeTab === 'outstanding' && styles.tabTextActive]}>
              Credit Bills ({pendingCreditBills.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'shops' && styles.tabActive]}
            onPress={() => setActiveTab('shops')}
          >
            <Text style={[styles.tabText, activeTab === 'shops' && styles.tabTextActive]}>
              Shop Dues
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Stats Cards */}
      <View style={styles.statsRow}>
        <Card style={[styles.statCard, { backgroundColor: colors.primary[500] }]}>
          <View style={styles.statIcon}>
            <Ionicons name="wallet" size={20} color={colors.primary[500]} />
          </View>
          <Text style={styles.statValue}>
            Rs. {(stats.totalOutstanding / 1000).toFixed(1)}k
          </Text>
          <Text style={styles.statLabel}>Total Due</Text>
        </Card>

        <Card style={[styles.statCard, { backgroundColor: colors.secondary[500] }]}>
          <View style={styles.statIcon}>
            <Ionicons name="storefront" size={20} color={colors.secondary[500]} />
          </View>
          <Text style={styles.statValue}>{stats.shopsWithCredit}</Text>
          <Text style={styles.statLabel}>Shops with Due</Text>
        </Card>
      </View>

      {/* Pending Credit Bills Section - For Salesmen */}
      {isSalesman && activeTab === 'outstanding' && pendingCreditBills.length > 0 && (
        <View style={styles.outstandingSection}>
          <Text style={styles.sectionTitle}>Pending Credit Bills</Text>
          {pendingCreditBills.map((bill) => (
            <Card key={bill.id} style={styles.outstandingCard}>
              <View style={styles.outstandingHeader}>
                <View style={styles.outstandingInfo}>
                  <Text style={styles.outstandingOrderNumber}>{bill.billNumber}</Text>
                  <Text style={styles.outstandingShopName}>{bill.customerName}</Text>
                  <Text style={styles.outstandingOrderRef}>Order: {bill.orderNumber}</Text>
                </View>
                <View style={styles.outstandingAmount}>
                  <Text style={styles.outstandingRemaining}>
                    Rs. {bill.remainingCredit.toLocaleString()}
                  </Text>
                  <Text style={styles.outstandingLabel}>Remaining</Text>
                </View>
              </View>
              <View style={styles.outstandingDetails}>
                <View style={styles.outstandingDetailRow}>
                  <Text style={styles.outstandingDetailLabel}>Total Bill:</Text>
                  <Text style={styles.outstandingDetailValue}>
                    Rs. {bill.totalAmount.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.outstandingDetailRow}>
                  <Text style={styles.outstandingDetailLabel}>Paid:</Text>
                  <Text style={[styles.outstandingDetailValue, { color: colors.success }]}>
                    Rs. {bill.paidAmount.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.outstandingDetailRow}>
                  <Text style={styles.outstandingDetailLabel}>Status:</Text>
                  <Text style={[styles.outstandingDetailValue, { 
                    color: bill.paymentStatus === 'PAID' ? colors.success : 
                           bill.paymentStatus === 'PARTIALLY_PAID' ? colors.warning : colors.error 
                  }]}>
                    {bill.paymentStatus === 'PAID' ? 'PAID' : 
                     bill.paymentStatus === 'PARTIALLY_PAID' ? 'PARTIAL' : 'UNPAID'}
                  </Text>
                </View>
                <View style={styles.outstandingDetailRow}>
                  <Text style={styles.outstandingDetailLabel}>Bill Date:</Text>
                  <Text style={styles.outstandingDetailValue}>
                    {new Date(bill.billedAt).toLocaleDateString('en-PK')}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.collectOutstandingButton}
                onPress={() => handleCollectOutstanding(bill.orderId)}
              >
                <Ionicons name="cash" size={18} color={colors.text.inverse} />
                <Text style={styles.collectOutstandingButtonText}>Collect Payment</Text>
              </TouchableOpacity>
            </Card>
          ))}
        </View>
      )}

      {/* Empty State for Credit Bills */}
      {isSalesman && activeTab === 'outstanding' && pendingCreditBills.length === 0 && (
        <View style={styles.emptyOutstanding}>
          <EmptyState
            icon="checkmark-circle-outline"
            title="No Pending Credit Bills"
            message="All credit bills have been paid. Great work!"
          />
        </View>
      )}

      {/* Shop Dues Section */}
      {(!isSalesman || activeTab === 'shops') && (
        <>
      {/* Search and Filter */}
      <View style={styles.filterSection}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search shops..."
        />
        <View style={styles.filterToggle}>
          <TouchableOpacity
            style={[styles.filterButton, showOnlyDue && styles.filterButtonActive]}
            onPress={() => setShowOnlyDue(true)}
          >
            <Text
              style={[
                styles.filterButtonText,
                showOnlyDue && styles.filterButtonTextActive,
              ]}
            >
              Due Only
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, !showOnlyDue && styles.filterButtonActive]}
            onPress={() => setShowOnlyDue(false)}
          >
            <Text
              style={[
                styles.filterButtonText,
                !showOnlyDue && styles.filterButtonTextActive,
              ]}
            >
              All Shops
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Results Count */}
      <Text style={styles.resultsCount}>
        {sortedShops.length} {sortedShops.length === 1 ? 'shop' : 'shops'}
        {showOnlyDue ? ' with outstanding balance' : ''}
      </Text>
        </>
      )}
    </View>
  );

  const renderShopItem = ({ item: shop }: { item: Shop }) => (
    <Card style={styles.shopCard}>
      <TouchableOpacity
        style={styles.shopHeader}
        onPress={() => handleViewLedger(shop.id)}
      >
        <View style={styles.shopInfo}>
          <Text style={styles.shopName}>{shop.shopName}</Text>
          <Text style={styles.shopOwner}>{shop.ownerName}</Text>
        </View>
        <CreditBadge
          balance={shop.currentBalance}
          creditLimit={shop.creditLimit}
          size="md"
        />
      </TouchableOpacity>

      <View style={styles.shopDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="location-outline" size={14} color={colors.text.muted} />
          <Text style={styles.detailText} numberOfLines={1}>
            {shop.address}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="call-outline" size={14} color={colors.text.muted} />
          <Text style={styles.detailText}>{shop.phone}</Text>
        </View>
      </View>

      {shop.currentBalance > 0 && (
        <TouchableOpacity
          style={styles.collectButton}
          onPress={() => handleCollectPayment(shop.id)}
        >
          <Ionicons name="cash" size={18} color={colors.text.inverse} />
          <Text style={styles.collectButtonText}>Collect Payment</Text>
        </TouchableOpacity>
      )}

      {shop.currentBalance < 0 && (
        <View style={styles.advanceNote}>
          <Ionicons name="information-circle" size={16} color={colors.info} />
          <Text style={styles.advanceText}>
            Shop has advance of Rs. {Math.abs(shop.currentBalance).toLocaleString()}
          </Text>
        </View>
      )}

      {shop.currentBalance === 0 && (
        <View style={styles.clearedNote}>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={styles.clearedText}>All dues cleared</Text>
        </View>
      )}
    </Card>
  );

  const renderEmpty = () => (
    <EmptyState
      icon="wallet-outline"
      title={showOnlyDue ? 'No Outstanding Dues' : 'No Shops Found'}
      message={
        showOnlyDue
          ? 'All shops have cleared their dues. Great work!'
          : searchQuery
          ? 'No shops match your search criteria.'
          : 'No shops available.'
      }
    />
  );

  // Render list based on active tab
  const renderListContent = () => {
    if (isSalesman && activeTab === 'outstanding') {
      // For outstanding payments, show them in the header, so return empty list
      return null;
    }
    
    // For shops tab, show shop list
    return (
      <FlatList
        data={sortedShops}
        renderItem={renderShopItem}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary[500]}
          />
        }
      />
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={isSalesman && activeTab === 'outstanding' ? [] : sortedShops}
        renderItem={renderShopItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={isSalesman && activeTab === 'outstanding' ? null : renderEmpty}
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
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  greeting: {
    ...typography.body,
    color: colors.text.muted,
  },
  userName: {
    ...typography.h2,
    color: colors.text.primary,
  },
  todayStats: {
    alignItems: 'flex-end',
    backgroundColor: colors.secondary[50],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
  },
  todayLabel: {
    ...typography.caption,
    color: colors.secondary[600],
  },
  todayValue: {
    ...typography.h4,
    color: colors.secondary[600],
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.xl,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.inverse,
  },
  statLabel: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  filterSection: {
    marginBottom: spacing.md,
  },
  filterToggle: {
    flexDirection: 'row',
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.lg,
    padding: 4,
    marginTop: spacing.md,
  },
  filterButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.md,
  },
  filterButtonActive: {
    backgroundColor: colors.surface,
    ...shadows.sm,
  },
  filterButtonText: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
  },
  filterButtonTextActive: {
    color: colors.text.primary,
  },
  resultsCount: {
    ...typography.caption,
    color: colors.text.muted,
    marginBottom: spacing.md,
  },
  shopCard: {
    marginBottom: spacing.md,
  },
  shopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  shopInfo: {
    flex: 1,
  },
  shopName: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  shopOwner: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: 2,
  },
  shopDetails: {
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  detailText: {
    ...typography.caption,
    color: colors.text.muted,
    flex: 1,
  },
  collectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondary[500],
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  collectButtonText: {
    ...typography.bodyMedium,
    color: colors.text.inverse,
  },
  advanceNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.info + '15',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  advanceText: {
    ...typography.caption,
    color: colors.info,
    flex: 1,
  },
  clearedNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success + '15',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  clearedText: {
    ...typography.caption,
    color: colors.success,
  },
  tabSelector: {
    flexDirection: 'row',
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.lg,
    padding: 4,
    marginBottom: spacing.lg,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.md,
  },
  tabActive: {
    backgroundColor: colors.surface,
    ...shadows.sm,
  },
  tabText: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
  },
  tabTextActive: {
    color: colors.text.primary,
    fontWeight: '600',
  },
  outstandingSection: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  outstandingCard: {
    marginBottom: spacing.md,
  },
  outstandingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  outstandingInfo: {
    flex: 1,
  },
  outstandingOrderNumber: {
    ...typography.bodyMedium,
    fontWeight: '600',
    color: colors.text.primary,
  },
  outstandingShopName: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: 2,
  },
  outstandingAmount: {
    alignItems: 'flex-end',
  },
  outstandingRemaining: {
    ...typography.h4,
    color: colors.warning,
    fontWeight: '700',
  },
  outstandingLabel: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: 2,
  },
  outstandingDetails: {
    marginBottom: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  outstandingDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  outstandingDetailLabel: {
    ...typography.body,
    color: colors.text.secondary,
  },
  outstandingDetailValue: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    fontWeight: '600',
  },
  collectOutstandingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.warning,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  collectOutstandingButtonText: {
    ...typography.bodyMedium,
    color: colors.text.inverse,
    fontWeight: '600',
  },
  emptyOutstanding: {
    marginTop: spacing.xl,
  },
  creditReminderBanner: {
    backgroundColor: colors.warning + '15',
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
    marginBottom: spacing.md,
  },
  creditReminderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  creditReminderText: {
    flex: 1,
  },
  creditReminderTitle: {
    ...typography.bodyMedium,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  creditReminderSubtitle: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  outstandingOrderRef: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: 2,
    fontSize: 11,
  },
});

