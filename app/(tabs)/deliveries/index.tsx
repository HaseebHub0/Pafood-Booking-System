import React, { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Animated,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore, useOrderStore, useDeliveryStore } from '../../../src/stores';
import { Card, EmptyState, LoadingSpinner, Badge, Skeleton, Button } from '../../../src/components';
import { colors, typography, spacing, borderRadius, shadows, animations } from '../../../src/theme';
import { Order, OrderStatus } from '../../../src/types/order';

// Map order status to display-friendly status
type DisplayStatus = 'pending' | 'approved' | 'ready' | 'delivered';

const getDisplayStatus = (status: OrderStatus): DisplayStatus => {
  switch (status) {
    case 'submitted':
    case 'draft':
      return 'pending';
    case 'finalized':
      return 'approved';
    case 'billed':
    case 'load_form_ready':
    case 'assigned':
      return 'ready';
    case 'delivered':
      return 'delivered';
    default:
      return 'pending';
  }
};

// Check if order can be delivered (KPO has approved and generated load form)
const canDeliver = (status: OrderStatus): boolean => {
  return status === 'load_form_ready' || status === 'assigned';
};

export default function DeliveriesScreen() {
  const { orders, loadOrders, isLoading } = useOrderStore();
  const { user } = useAuthStore();
  const { deliveries, getDeliveryById, loadDeliveries } = useDeliveryStore();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | DisplayStatus>('all');
  
  // Animation refs
  const headerAnim = useRef(new Animated.Value(0)).current;
  const statsAnim = useRef(new Animated.Value(0)).current;
  const filterAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadOrders();
    loadDeliveries(); // Load deliveries so we can map orders to deliveries for navigation
    
    // Animate header and stats
    Animated.parallel([
      Animated.timing(headerAnim, {
        toValue: 1,
        duration: animations.duration.normal,
        useNativeDriver: true,
      }),
      Animated.timing(statsAnim, {
        toValue: 1,
        duration: animations.duration.slow,
        delay: 100,
        useNativeDriver: true,
      }),
      Animated.timing(filterAnim, {
        toValue: 1,
        duration: animations.duration.normal,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadOrders(), loadDeliveries()]);
    setRefreshing(false);
  };

  // Only show for salesman
  if (user?.role?.toLowerCase() !== 'salesman') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.notAuthorized}>
          <Ionicons name="lock-closed" size={64} color={colors.gray[300]} />
          <Text style={styles.notAuthorizedText}>
            Delivery management is only available for Salesman
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Filter orders: exclude drafts, show submitted and above
  // Orders are loaded from orders collection, filtered by salesman's branch/region
  const salesmanOrders = useMemo(() => {
    return orders.filter(order => order.status !== 'draft');
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return salesmanOrders.filter((order) => {
      if (filter === 'all') return true;
      return getDisplayStatus(order.status) === filter;
    }).sort((a, b) => {
      // Sort by status priority (ready first), then by date
      const statusOrder: Record<DisplayStatus, number> = {
        ready: 0,
        approved: 1,
        pending: 2,
        delivered: 3,
      };
      const aStatus = getDisplayStatus(a.status);
      const bStatus = getDisplayStatus(b.status);
      const statusDiff = (statusOrder[aStatus] || 99) - (statusOrder[bStatus] || 99);
      if (statusDiff !== 0) return statusDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [salesmanOrders, filter]);

  // Calculate stats from orders
  const stats = useMemo(() => {
    const total = salesmanOrders.length;
    const pending = salesmanOrders.filter(o => o.status === 'submitted').length;
    const approved = salesmanOrders.filter(o => o.status === 'finalized').length;
    const ready = salesmanOrders.filter(o => canDeliver(o.status)).length;
    const delivered = salesmanOrders.filter(o => o.status === 'delivered').length;
    
    return {
      totalOrders: total,
      pendingApproval: pending,
      approvedOrders: approved,
      readyForDelivery: ready,
      deliveredCount: delivered,
    };
  }, [salesmanOrders]);

  const handleOrderPress = (orderId: string, order: Order) => {
    // For salesmen, find the delivery record and navigate to delivery detail
    // For other roles, navigate to order detail
    if (user?.role?.toLowerCase() === 'salesman') {
      const delivery = deliveries.find(d => d.orderId === orderId);
      
      if (delivery) {
        router.push(`/(tabs)/deliveries/${delivery.id}`);
      } else {
        // Fallback to order detail if delivery not found (shouldn't happen for salesmen)
        // But redirect to home instead to prevent access issues
        router.replace('/(tabs)/');
      }
    } else {
      // Non-salesmen go to order detail screen
      router.push(`/(tabs)/orders/${orderId}`);
    }
  };

  const getStatusColor = (status: DisplayStatus) => {
    switch (status) {
      case 'delivered':
        return colors.success;
      case 'ready':
        return colors.info;
      case 'approved':
        return colors.warning;
      case 'pending':
        return colors.gray[500];
      default:
        return colors.gray[500];
    }
  };

  const getStatusLabel = (status: OrderStatus): string => {
    switch (status) {
      case 'submitted':
        return 'PENDING APPROVAL';
      case 'finalized':
        return 'APPROVED';
      case 'billed':
        return 'BILLED';
      case 'load_form_ready':
      case 'assigned':
        return 'READY TO DELIVER';
      case 'delivered':
        return 'DELIVERED';
      default:
        return status.toUpperCase();
    }
  };

  const renderHeader = () => (
    <View>
      {/* Header */}
      <Animated.View
        style={[
          styles.header,
          {
            opacity: headerAnim,
            transform: [
              {
                translateY: headerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-10, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.title}>My Deliveries</Text>
            <Text style={styles.subtitle}>Manage your delivery assignments</Text>
          </View>
        </View>
      </Animated.View>

      {/* Stats */}
      {isLoading && orders.length === 0 ? (
        <View style={styles.statsRow}>
          <View style={[styles.statCard, styles.statCardSkeleton]}>
            <Skeleton width={40} height={40} variant="rectangular" borderRadius={12} />
            <Skeleton width={50} height={28} style={{ marginTop: spacing.md }} />
            <Skeleton width={60} height={14} style={{ marginTop: spacing.xs }} />
          </View>
          <View style={[styles.statCard, styles.statCardSkeleton]}>
            <Skeleton width={40} height={40} variant="rectangular" borderRadius={12} />
            <Skeleton width={50} height={28} style={{ marginTop: spacing.md }} />
            <Skeleton width={60} height={14} style={{ marginTop: spacing.xs }} />
          </View>
          <View style={[styles.statCard, styles.statCardSkeleton]}>
            <Skeleton width={40} height={40} variant="rectangular" borderRadius={12} />
            <Skeleton width={50} height={28} style={{ marginTop: spacing.md }} />
            <Skeleton width={60} height={14} style={{ marginTop: spacing.xs }} />
          </View>
        </View>
      ) : (
        <Animated.View
          style={[
            styles.statsRow,
            {
              opacity: statsAnim,
              transform: [
                {
                  translateY: statsAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={[styles.statCard, { backgroundColor: colors.primary[500] }]}>
            <View style={styles.statIconContainer}>
              <Ionicons name="cube-outline" size={24} color={colors.text.inverse} />
            </View>
            <Text style={styles.statValue}>{stats.totalOrders}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.info }]}>
            <View style={styles.statIconContainer}>
              <Ionicons name="rocket-outline" size={24} color={colors.text.inverse} />
            </View>
            <Text style={styles.statValue}>{stats.readyForDelivery}</Text>
            <Text style={styles.statLabel}>Ready</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.secondary[500] }]}>
            <View style={styles.statIconContainer}>
              <Ionicons name="checkmark-circle-outline" size={24} color={colors.text.inverse} />
            </View>
            <Text style={styles.statValue}>{stats.deliveredCount}</Text>
            <Text style={styles.statLabel}>Delivered</Text>
          </View>
        </Animated.View>
      )}

      {/* Filters */}
      <Animated.View
        style={[
          styles.filtersContainer,
          {
            opacity: filterAnim,
            transform: [
              {
                translateY: filterAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-10, 0],
                }),
              },
            ],
          },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          {(['all', 'ready', 'pending', 'approved', 'delivered'] as const).map((filterOption) => (
            <TouchableOpacity
              key={filterOption}
              style={[
                styles.filterButton,
                filter === filterOption && styles.filterButtonActive,
              ]}
              onPress={() => setFilter(filterOption)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  filter === filterOption && styles.filterButtonTextActive,
                ]}
              >
                {filterOption === 'all'
                  ? 'All'
                  : filterOption === 'ready'
                  ? 'Ready to Deliver'
                  : filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Animated.View>
    </View>
  );

  const OrderCard = React.memo(({ order, index }: { order: Order; index: number }) => {
    const cardAnim = useRef(new Animated.Value(0)).current;
    const isReady = canDeliver(order.status);
    const displayStatus = getDisplayStatus(order.status);

    useEffect(() => {
      Animated.timing(cardAnim, {
        toValue: 1,
        duration: animations.duration.normal,
        delay: index * 50,
        useNativeDriver: true,
      }).start();
    }, []);

    return (
      <Animated.View
        style={{
          opacity: cardAnim,
          transform: [
            {
              translateY: cardAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            },
          ],
        }}
      >
        <Card style={styles.deliveryCard} onPress={() => handleOrderPress(order.id, order)}>
          <View style={styles.deliveryHeader}>
            <View style={styles.deliveryInfo}>
              <View style={styles.orderNumberRow}>
                <Ionicons name="receipt-outline" size={14} color={colors.primary[500]} />
                <Text style={styles.orderNumber} numberOfLines={1} ellipsizeMode="tail">
                  {order.orderNumber}
                </Text>
              </View>
              <Text style={styles.shopName} numberOfLines={1} ellipsizeMode="tail">
                {order.shopName}
              </Text>
            </View>
            <Badge
              label={getStatusLabel(order.status)}
              variant={
                displayStatus === 'delivered'
                  ? 'success'
                  : displayStatus === 'ready'
                  ? 'info'
                  : displayStatus === 'approved'
                  ? 'warning'
                  : 'default'
              }
              size="sm"
            />
          </View>

          {/* Compact details in a single row */}
          <View style={styles.compactDetailsRow}>
            <View style={styles.compactDetailItem}>
              <Ionicons name="cube-outline" size={14} color={colors.text.muted} />
              <Text style={styles.compactDetailText}>
                {order.items.length} items
              </Text>
            </View>
            <View style={styles.compactDetailItem}>
              <Ionicons name="cash-outline" size={14} color={colors.primary[500]} />
              <Text style={styles.compactDetailTextBold}>
                Rs. {order.grandTotal.toLocaleString()}
              </Text>
            </View>
            <View style={styles.compactDetailItem}>
              <Ionicons name="calendar-outline" size={14} color={colors.text.muted} />
              <Text style={styles.compactDetailText}>
                {new Date(order.createdAt).toLocaleDateString('en-PK', {
                  day: 'numeric',
                  month: 'short',
                })}
              </Text>
            </View>
          </View>

          {/* Status indicator bar */}
          {displayStatus === 'pending' && (
            <View style={styles.statusIndicator}>
              <Ionicons name="time-outline" size={12} color={colors.warning} />
              <Text style={styles.statusIndicatorText}>
                Waiting for KPO approval
              </Text>
            </View>
          )}

          {order.status === 'delivered' && (
            <View style={[styles.statusIndicator, styles.statusIndicatorSuccess]}>
              <Ionicons name="checkmark-circle" size={12} color={colors.success} />
              <Text style={[styles.statusIndicatorText, { color: colors.success }]}>
                Delivered • {order.paymentMode === 'cash' ? 'Cash' : order.paymentMode === 'credit' ? 'Credit' : 'Partial'}
              </Text>
            </View>
          )}

          {/* Action button */}
          {isReady && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleOrderPress(order.id, order)}
              activeOpacity={0.8}
            >
              <Text style={styles.actionButtonText}>Start Delivery</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.text.inverse} />
            </TouchableOpacity>
          )}
          
          {!isReady && displayStatus !== 'pending' && (
            <TouchableOpacity
              style={styles.viewButtonCompact}
              onPress={() => handleOrderPress(order.id, order)}
              activeOpacity={0.7}
            >
              <Text style={styles.viewButtonTextCompact}>View Details</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primary[500]} />
            </TouchableOpacity>
          )}
        </Card>
      </Animated.View>
    );
  });

  const renderOrder = ({ item: order, index }: { item: Order; index: number }) => (
    <OrderCard order={order} index={index} />
  );

  if (isLoading && orders.length === 0) {
    return <LoadingSpinner fullScreen message="Loading orders..." />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={filteredOrders}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => renderOrder({ item, index })}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary[500]}
            colors={[colors.primary[500]]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <EmptyState
              icon="cube-outline"
              title={filter === 'all' ? 'No orders yet' : `No ${filter} orders`}
              description={
                filter === 'all'
                  ? 'Orders will appear here once bookers create them'
                  : 'No orders match this filter'
              }
            />
          </View>
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
  notAuthorized: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  notAuthorizedText: {
    ...typography.body,
    color: colors.text.muted,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  header: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.text.muted,
    fontSize: 13,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.base,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    ...shadows.md,
    minHeight: 120,
    justifyContent: 'center',
  },
  statCardSkeleton: {
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text.inverse,
    marginBottom: spacing.xs,
  },
  statLabel: {
    ...typography.captionMedium,
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 11,
    fontWeight: '600',
  },
  filtersContainer: {
    marginBottom: spacing.lg,
  },
  filters: {
    flexDirection: 'row',
    paddingHorizontal: spacing.base,
    gap: spacing.sm,
  },
  filterButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    ...shadows.sm,
  },
  filterButtonActive: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
    ...shadows.primary,
  },
  filterButtonText: {
    ...typography.captionMedium,
    color: colors.text.secondary,
    fontWeight: '600',
    fontSize: 12,
  },
  filterButtonTextActive: {
    color: colors.text.inverse,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: spacing.base,
    paddingBottom: 120,
    paddingTop: spacing.sm,
  },
  emptyContainer: {
    paddingVertical: spacing['3xl'],
  },
  deliveryCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
    ...shadows.sm,
  },
  deliveryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  deliveryInfo: {
    flex: 1,
    marginRight: spacing.sm,
    minWidth: 0, // Allow text to shrink
  },
  orderNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 4,
  },
  orderNumber: {
    ...typography.captionMedium,
    color: colors.primary[500],
    fontWeight: '600',
    fontSize: 12,
    flex: 1,
  },
  shopName: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    fontWeight: '700',
    fontSize: 14,
    flex: 1,
  },
  compactDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  compactDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  compactDetailText: {
    ...typography.caption,
    color: colors.text.secondary,
    fontSize: 11,
  },
  compactDetailTextBold: {
    ...typography.captionMedium,
    color: colors.primary[500],
    fontWeight: '700',
    fontSize: 12,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning + '10',
    borderRadius: borderRadius.sm,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  statusIndicatorSuccess: {
    backgroundColor: colors.success + '10',
  },
  statusIndicatorText: {
    ...typography.caption,
    color: colors.warning,
    fontSize: 10,
    fontWeight: '500',
    flex: 1,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
    gap: spacing.xs,
    ...shadows.sm,
  },
  actionButtonText: {
    ...typography.bodyMedium,
    color: colors.text.inverse,
    fontWeight: '600',
    fontSize: 13,
  },
  viewButtonCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  viewButtonTextCompact: {
    ...typography.captionMedium,
    color: colors.primary[500],
    fontWeight: '600',
    fontSize: 11,
  },
});

