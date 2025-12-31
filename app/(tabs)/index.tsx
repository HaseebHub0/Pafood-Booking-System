import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Animated,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore, useShopStore, useOrderStore, useDeliveryStore, useRouteStore, useOutstandingPaymentStore } from '../../src/stores';
import { Card, Badge, Skeleton, EmptyState } from '../../src/components';
import { colors, typography, spacing, borderRadius, shadows, animations } from '../../src/theme';

export default function DashboardScreen() {
  const { user } = useAuthStore();
  const { shops, loadShops, isLoading: shopsLoading } = useShopStore();
  const { orders, loadOrders, isLoading: ordersLoading } = useOrderStore();
  const { deliveries, loadDeliveries, getPendingDeliveries, isLoading: deliveriesLoading } = useDeliveryStore();
  const { routes, loadRoutes, getActiveRoute, isLoading: routesLoading } = useRouteStore();
  const { outstandingPayments, loadOutstandingPayments, getOutstandingPaymentsBySalesman } = useOutstandingPaymentStore();
  const [refreshing, setRefreshing] = useState(false);
  const [animatedShops, setAnimatedShops] = useState(0);
  const [animatedOrders, setAnimatedOrders] = useState(0);

  const isBooker = user?.role === 'booker';
  const isSalesman = user?.role === 'salesman';
  const isLoading = shopsLoading || ordersLoading;

  // Animation refs for stats
  const shopCardAnim = useRef(new Animated.Value(0)).current;
  const orderCardAnim = useRef(new Animated.Value(0)).current;

  // Filter data by salesman ID if user is salesman
  // Define these BEFORE useEffect that uses them
  // For salesman, orders are already filtered by branch in orderStore
  // So we can use orders directly (they're already filtered to salesman's branch)
  const salesmanOrders = useMemo(() => {
    if (!orders || !Array.isArray(orders)) return [];
    // Orders are already filtered by branch in orderStore for salesmen
    // So we can return them directly
    return orders;
  }, [orders]);

  // Calculate pending deliveries for salesman - only delivery records with pending status
  // Status: pending, assigned, in_transit (NOT delivered, failed, or returned)
  // Also exclude deliveries where the associated order is already delivered
  const pendingDeliveries = useMemo(() => {
    if (!isSalesman || !user?.id) return [];
    
    // Get delivery records assigned to this salesman with pending status
    // Only include: pending, assigned, in_transit
    // Explicitly exclude: delivered, failed, returned
    const deliveryRecords = deliveries || [];
    
    // First filter by salesman
    const salesmanDeliveries = deliveryRecords.filter(d => d.salesmanId === user.id);
    
    // Then filter by pending status AND check associated order status
    // This ensures we don't show deliveries for orders that are already delivered
    const filteredDeliveries = salesmanDeliveries.filter(d => {
      if (!d.status) return false;
      
      const deliveryStatus = String(d.status).toLowerCase().trim();
      
      // EXPLICITLY exclude completed/failed statuses FIRST
      if (deliveryStatus === 'delivered' || 
          deliveryStatus === 'failed' || 
          deliveryStatus === 'returned' ||
          deliveryStatus === 'completed' ||
          deliveryStatus === 'cancelled') {
        return false;
      }
      
      // Also check the associated order status - exclude if order is delivered
      if (d.orderId) {
        const associatedOrder = orders.find(o => o.id === d.orderId);
        if (associatedOrder && associatedOrder.status === 'delivered') {
          return false; // Order is delivered, exclude this delivery
        }
      }
      
      // Only these statuses are considered "pending"
      return deliveryStatus === 'pending' || 
             deliveryStatus === 'assigned' || 
             deliveryStatus === 'in_transit';
    });
    
    // Debug logging (can be removed later)
    if (__DEV__) {
      const deliveredCount = salesmanDeliveries.filter(d => {
        const status = String(d.status || '').toLowerCase().trim();
        return status === 'delivered';
      }).length;
      
      const ordersDeliveredCount = salesmanDeliveries.filter(d => {
        if (!d.orderId) return false;
        const order = orders.find(o => o.id === d.orderId);
        return order && order.status === 'delivered';
      }).length;
      
      console.log('[Pending Deliveries] Filter Debug:', {
        totalDeliveriesInStore: deliveryRecords.length,
        salesmanTotalDeliveries: salesmanDeliveries.length,
        deliveredDeliveryCount: deliveredCount,
        ordersDeliveredCount: ordersDeliveredCount,
        pendingDeliveriesCount: filteredDeliveries.length,
        statusBreakdown: salesmanDeliveries.reduce((acc, d) => {
          const status = String(d.status || 'unknown').toLowerCase().trim();
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        pendingStatuses: filteredDeliveries.map(d => d.status),
        excludedDeliveries: salesmanDeliveries
          .filter(d => {
            const status = String(d.status || '').toLowerCase().trim();
            const order = d.orderId ? orders.find(o => o.id === d.orderId) : null;
            return status === 'delivered' || 
                   status === 'failed' || 
                   status === 'returned' ||
                   (order && order.status === 'delivered');
          })
          .map(d => ({ 
            id: d.id, 
            deliveryStatus: d.status,
            orderStatus: d.orderId ? orders.find(o => o.id === d.orderId)?.status : 'unknown'
          }))
      });
    }
    
    return filteredDeliveries;
  }, [isSalesman, user?.id, deliveries, orders]);

  // Filter shops for salesman by their assigned area/branch
  const salesmanShops = useMemo(() => {
    if (!shops || !Array.isArray(shops)) return [];
    if (isSalesman && user?.id) {
      return shops.filter(shop => 
        shop.branch === user.branch || 
        shop.area === user.area ||
        (user.branch && shop.branch === user.branch)
      );
    }
    return shops;
  }, [shops, isSalesman, user?.id, user?.branch, user?.area]);

  useEffect(() => {
    loadShops();
    loadOrders();
    if (isSalesman) {
      loadDeliveries();
      loadOutstandingPayments();
    }
    if (isBooker) {
      loadRoutes();
    }
  }, []);

  // Calculate outstanding payments stats for salesman
  const outstandingPaymentsStats = useMemo(() => {
    if (!isSalesman || !user?.id) return { count: 0, totalAmount: 0 };
    
    const salesmanOutstanding = getOutstandingPaymentsBySalesman(user.id);
    const totalAmount = salesmanOutstanding.reduce((sum, payment) => sum + payment.remainingBalance, 0);
    
    return {
      count: salesmanOutstanding.length,
      totalAmount,
    };
  }, [isSalesman, user?.id, outstandingPayments, getOutstandingPaymentsBySalesman]);

  // Animate stats when data loads
  useEffect(() => {
    if (!isLoading) {
      // Animate shop count
      Animated.timing(shopCardAnim, {
        toValue: 1,
        duration: animations.duration.slow,
        useNativeDriver: true,
      }).start();

      // Animate order count
      Animated.timing(orderCardAnim, {
        toValue: 1,
        duration: animations.duration.slow,
        delay: 100,
        useNativeDriver: true,
      }).start();

      // Count up animation for numbers - with safe checks
      const shopsArray = isSalesman ? salesmanShops : (shops || []);
      const ordersArray = isSalesman ? salesmanOrders : (orders || []);
      const shopsCount = Array.isArray(shopsArray) ? shopsArray.length : 0;
      const ordersCount = Array.isArray(ordersArray) ? ordersArray.length : 0;
      animateValue(0, shopsCount, setAnimatedShops, 600);
      animateValue(0, ordersCount, setAnimatedOrders, 700);
    }
  }, [isLoading, shops, orders, isSalesman, salesmanShops, salesmanOrders]);

  const animateValue = (start: number, end: number, setter: (val: number) => void, duration: number) => {
    const steps = 30;
    const stepDuration = duration / steps;
    const stepValue = (end - start) / steps;
    let current = start;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      current = Math.min(start + stepValue * step, end);
      setter(Math.round(current));
      if (step >= steps) {
        setter(end);
        clearInterval(timer);
      }
    }, stepDuration);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    const promises = [loadShops(), loadOrders()];
    if (isSalesman) {
      promises.push(loadDeliveries());
      promises.push(loadOutstandingPayments());
    }
    if (isBooker) promises.push(loadRoutes());
    await Promise.all(promises);
    setRefreshing(false);
  };

  const recentOrders = isSalesman 
    ? (salesmanOrders || []).slice(0, 3) 
    : (orders || []).slice(0, 3);
  const activeRoute = isBooker ? (getActiveRoute && getActiveRoute()) : null;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary[500]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.userName}>{user?.name || 'Booker'} 👋</Text>
          </View>
          <View style={styles.avatarContainer}>
            <Ionicons name="person-circle" size={48} color={colors.primary[500]} />
          </View>
        </View>

        {/* Stats Cards */}
        {isLoading ? (
          <View style={styles.statsRow}>
            <View style={[styles.statCard, styles.statCardSkeleton]}>
              <Skeleton width={44} height={44} variant="rectangular" borderRadius={12} />
              <Skeleton width={60} height={32} style={{ marginTop: spacing.md }} />
              <Skeleton width={80} height={16} style={{ marginTop: spacing.xs }} />
            </View>
            <View style={[styles.statCard, styles.statCardSkeleton]}>
              <Skeleton width={44} height={44} variant="rectangular" borderRadius={12} />
              <Skeleton width={60} height={32} style={{ marginTop: spacing.md }} />
              <Skeleton width={80} height={16} style={{ marginTop: spacing.xs }} />
            </View>
          </View>
        ) : (
          <View style={styles.statsRow}>
            <Animated.View
              style={{
                flex: 1,
                opacity: shopCardAnim,
                transform: [
                  {
                    translateY: shopCardAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [20, 0],
                    }),
                  },
                ],
              }}
            >
              <TouchableOpacity
                style={[styles.statCard, { backgroundColor: colors.primary[500] }]}
                onPress={() => router.push('/(tabs)/shops')}
                activeOpacity={0.8}
              >
                <View style={styles.statIcon}>
                  <Ionicons name="storefront" size={24} color={colors.primary[500]} />
                </View>
                  <Text style={styles.statNumber}>
                    {isSalesman ? salesmanShops.length : animatedShops}
                  </Text>
                  <Text style={styles.statLabel}>Total Shops</Text>
              </TouchableOpacity>
            </Animated.View>

            <Animated.View
              style={{
                flex: 1,
                opacity: orderCardAnim,
                transform: [
                  {
                    translateY: orderCardAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [20, 0],
                    }),
                  },
                ],
              }}
            >
              {isBooker ? (
                <TouchableOpacity
                  style={[styles.statCard, { backgroundColor: colors.secondary[500] }]}
                  onPress={() => router.push('/(tabs)/orders')}
                  activeOpacity={0.8}
                >
                  <View style={styles.statIcon}>
                    <Ionicons name="document-text" size={24} color={colors.secondary[500]} />
                  </View>
                  <Text style={styles.statNumber}>{animatedOrders}</Text>
                  <Text style={styles.statLabel}>Total Orders</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.statCard, { backgroundColor: colors.secondary[500] }]}
                  onPress={() => router.push('/(tabs)/deliveries')}
                  activeOpacity={0.8}
                >
                  <View style={styles.statIcon}>
                    <Ionicons name="cube" size={24} color={colors.secondary[500]} />
                  </View>
                  <Text style={styles.statNumber}>{pendingDeliveries.length}</Text>
                  <Text style={styles.statLabel}>Pending Deliveries</Text>
                </TouchableOpacity>
              )}
            </Animated.View>
          </View>
        )}

        {/* Outstanding Payments Stat Card - For Salesmen */}
        {isSalesman && outstandingPaymentsStats.count > 0 && (
          <View style={styles.statsRow}>
            <TouchableOpacity
              style={[styles.statCard, { backgroundColor: colors.warning }]}
              onPress={() => router.push('/(tabs)/payments')}
              activeOpacity={0.8}
            >
              <View style={styles.statIcon}>
                <Ionicons name="cash-outline" size={24} color={colors.warning} />
              </View>
              <Text style={styles.statNumber}>{outstandingPaymentsStats.count}</Text>
              <Text style={styles.statLabel}>Outstanding Payments</Text>
              <Text style={styles.statSubLabel}>
                Rs. {outstandingPaymentsStats.totalAmount.toLocaleString()}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsRow}>
          {isBooker ? (
            <>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => router.push('/(tabs)/shops/add')}
              >
                <View style={[styles.actionIcon, { backgroundColor: colors.primary[50] }]}>
                  <Ionicons name="add-circle" size={28} color={colors.primary[500]} />
                </View>
                <Text style={styles.actionText}>Add Shop</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => router.push('/(tabs)/orders/create')}
              >
                <View style={[styles.actionIcon, { backgroundColor: colors.secondary[50] }]}>
                  <Ionicons name="cart" size={28} color={colors.secondary[500]} />
                </View>
                <Text style={styles.actionText}>New Order</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => router.push('/(tabs)/work')}
              >
                <View style={[styles.actionIcon, { backgroundColor: colors.info + '20' }]}>
                  <Ionicons name="briefcase" size={28} color={colors.info} />
                </View>
                <Text style={styles.actionText}>Work</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => router.push('/(tabs)/deliveries')}
              >
                <View style={[styles.actionIcon, { backgroundColor: colors.primary[50] }]}>
                  <Ionicons name="cube" size={28} color={colors.primary[500]} />
                </View>
                <Text style={styles.actionText}>Deliveries</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => router.push('/(tabs)/payments')}
              >
                <View style={[styles.actionIcon, { backgroundColor: colors.success + '20' }]}>
                  <Ionicons name="cash" size={28} color={colors.success} />
                </View>
                <Text style={styles.actionText}>Payments</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => router.push('/(tabs)/work')}
              >
                <View style={[styles.actionIcon, { backgroundColor: colors.info + '20' }]}>
                  <Ionicons name="briefcase" size={28} color={colors.info} />
                </View>
                <Text style={styles.actionText}>Work</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Recent Orders / Deliveries */}
        {isBooker ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Orders</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/orders')}>
                <Text style={styles.seeAll}>See All</Text>
              </TouchableOpacity>
            </View>

            {recentOrders.length > 0 ? (
              recentOrders.map((order) => (
                <Card
                  key={order.id}
                  style={styles.orderCard}
                  onPress={() => router.push(`/(tabs)/orders/${order.id}`)}
                >
                  <View style={styles.orderHeader}>
                    <View style={styles.orderInfo}>
                      <Text style={styles.orderShop} numberOfLines={1} ellipsizeMode="tail">
                        {order.shopName}
                      </Text>
                      <Text style={styles.orderNumber} numberOfLines={1} ellipsizeMode="tail">
                        {order.orderNumber}
                      </Text>
                    </View>
                    <Badge
                      label={order.status.toUpperCase().replace('_', ' ')}
                      variant={order.status === 'draft' ? 'draft' : order.status === 'submitted' ? 'submitted' : 'editRequested'}
                      size="sm"
                    />
                  </View>
                  <View style={styles.orderFooter}>
                    <Text style={styles.orderAmount}>
                      Rs. {order.grandTotal.toLocaleString()}
                    </Text>
                    <Text style={styles.orderDate}>
                      {new Date(order.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                </Card>
              ))
            ) : (
              <EmptyState
                icon="document-text-outline"
                title="No orders yet"
                description="Create your first order to get started"
                actionLabel="Create Order"
                onAction={() => router.push('/(tabs)/orders/create')}
              />
            )}
          </>
        ) : (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Pending Deliveries</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/deliveries')}>
                <Text style={styles.seeAll}>See All</Text>
              </TouchableOpacity>
            </View>

            {pendingDeliveries.length > 0 ? (
              pendingDeliveries.slice(0, 3).map((delivery) => {
                // Salesmen should always go to delivery detail screen (not order detail)
                // This ensures they see the delivery-specific view and can't edit orders
                const navigateRoute = `/(tabs)/deliveries/${delivery.id}`;
                
                return (
                  <Card
                    key={delivery.id}
                    style={styles.orderCard}
                    onPress={() => router.push(navigateRoute as any)}
                  >
                    <View style={styles.orderHeader}>
                      <View style={styles.orderInfo}>
                        <Text style={styles.orderShop} numberOfLines={1} ellipsizeMode="tail">
                          {delivery.shopName}
                        </Text>
                        <Text style={styles.orderNumber} numberOfLines={1} ellipsizeMode="tail">
                          {delivery.orderNumber}
                        </Text>
                      </View>
                      <Badge
                        label={delivery.status.replace('_', ' ').toUpperCase()}
                        variant={delivery.status === 'delivered' ? 'success' : delivery.status === 'failed' ? 'error' : 'default'}
                        size="sm"
                      />
                    </View>
                    <View style={styles.orderFooter}>
                      <Text style={styles.orderAmount}>
                        Rs. {(delivery.totalAmount || 0).toLocaleString()}
                      </Text>
                      <Text style={styles.orderDate}>
                        {delivery.scheduledDeliveryDate 
                          ? new Date(delivery.scheduledDeliveryDate).toLocaleDateString()
                          : delivery.createdAt 
                          ? new Date(delivery.createdAt).toLocaleDateString()
                          : 'No date'}
                      </Text>
                    </View>
                  </Card>
                );
              })
            ) : (
              <EmptyState
                icon="cube-outline"
                title="No pending deliveries"
                description="All deliveries have been completed"
              />
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.base,
    paddingBottom: 100, // Space for floating tab bar
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  greeting: {
    ...typography.body,
    color: colors.text.muted,
  },
  userName: {
    ...typography.h2,
    color: colors.text.primary,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.md,
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.text.inverse,
    marginBottom: 2,
  },
  statLabel: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  statSubLabel: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: spacing.xs,
    fontWeight: '600',
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    marginTop: spacing.lg,
  },
  seeAll: {
    ...typography.bodyMedium,
    color: colors.primary[500],
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  actionText: {
    ...typography.captionMedium,
    color: colors.text.primary,
  },
  orderCard: {
    marginBottom: spacing.md,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  orderInfo: {
    flex: 1,
    marginRight: spacing.md,
    minWidth: 0, // Allows text to shrink below content size
  },
  orderShop: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  orderNumber: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: 2,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  orderAmount: {
    ...typography.h4,
    color: colors.primary[500],
  },
  orderDate: {
    ...typography.caption,
    color: colors.text.muted,
  },
  statCardSkeleton: {
    backgroundColor: colors.surface,
    alignItems: 'flex-start',
  },
});

