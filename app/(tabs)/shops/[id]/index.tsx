import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useShopStore, useOrderStore, useAuthStore, useEditRequestStore } from '../../../../src/stores';
import { Button, Card, LoadingSpinner } from '../../../../src/components';
import { colors, typography, spacing, borderRadius, shadows } from '../../../../src/theme';
import { CITIES, AREAS } from '../../../../src/types';

export default function ShopDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getShopById, deleteShop } = useShopStore();
  const { createOrder, orders } = useOrderStore();
  const { user } = useAuthStore();
  const { getRequestsByShop } = useEditRequestStore();
  const [isDeleting, setIsDeleting] = useState(false);
  
  useEffect(() => {
    if (isBooker) {
      useEditRequestStore.getState().loadEditRequests();
    }
  }, []);

  const shop = getShopById(id);
  const shopOrders = orders.filter((o) => o.shopId === id);

  // Role-based access: Only booker can create orders and delete shops
  const isBooker = user?.role === 'booker';
  const isSalesman = user?.role === 'salesman';

  if (!shop) {
    return (
      <View style={styles.notFound}>
        <Ionicons name="alert-circle-outline" size={64} color={colors.gray[300]} />
        <Text style={styles.notFoundText}>Shop not found</Text>
        <Button title="Go Back" onPress={() => router.back()} variant="outline" />
      </View>
    );
  }

  const cityLabel = CITIES.find((c) => c.value === shop.city)?.label || shop.city;
  const areaLabel = AREAS[shop.city]?.find((a) => a.value === shop.area)?.label || shop.area;

  const handleCreateOrder = () => {
    createOrder(shop.id);
    router.push('/(tabs)/orders/create/products');
  };

  const handleViewLedger = () => {
    router.push(`/(tabs)/shops/${id}/ledger`);
  };

  const handleEdit = () => {
    router.push(`/(tabs)/shops/${id}/edit`);
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Shop',
      `Are you sure you want to delete "${shop.shopName}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            await deleteShop(shop.id);
            router.back();
          },
        },
      ]
    );
  };

  const pendingRequests = isBooker ? getRequestsByShop(shop.id).filter((r) => r.status === 'pending') : [];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Shop Header Card */}
        <Card style={styles.headerCard}>
          <View style={styles.shopIconContainer}>
            <Ionicons name="storefront" size={40} color={colors.primary[500]} />
          </View>
          <Text style={styles.shopName}>{shop.shopName}</Text>
          <Text style={styles.shopId}>Shop ID: {shop.shopId}</Text>
          <View style={styles.statusBadge}>
            <View style={[styles.statusDot, { backgroundColor: shop.isActive ? colors.success : colors.error }]} />
            <Text style={styles.statusText}>{shop.isActive ? 'Active' : 'Inactive'}</Text>
          </View>
        </Card>

        {/* Ledger Card - For KPO/Salesman */}
        {!isBooker && (
          <Card style={styles.ledgerCard}>
            <View style={styles.ledgerHeader}>
              <Text style={styles.ledgerTitle}>Transaction History</Text>
              <TouchableOpacity onPress={handleViewLedger} style={styles.viewLedgerButton}>
                <Text style={styles.viewLedgerText}>View Ledger</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.primary[500]} />
              </TouchableOpacity>
            </View>
          </Card>
        )}

        {/* Pending Edit Requests */}
        {isBooker && pendingRequests.length > 0 && (
          <Card style={styles.requestCard}>
            <View style={styles.requestHeader}>
              <Ionicons name="time-outline" size={20} color={colors.warning} />
              <Text style={styles.requestTitle}>
                {pendingRequests.length} Pending Edit Request{pendingRequests.length > 1 ? 's' : ''}
              </Text>
            </View>
            <Text style={styles.requestText}>
              Your edit request is pending KPO approval.
            </Text>
          </Card>
        )}

        {/* Details Section */}
        <View style={styles.detailsHeader}>
          <Text style={styles.sectionTitle}>Shop Details</Text>
          {isBooker && (
            <TouchableOpacity style={styles.editButton} onPress={handleEdit}>
              <Ionicons name="create-outline" size={18} color={colors.primary[500]} />
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>
        <Card style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Ionicons name="person-outline" size={20} color={colors.primary[500]} />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Owner</Text>
              <Text style={styles.detailValue}>{shop.ownerName}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Ionicons name="call-outline" size={20} color={colors.primary[500]} />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Phone</Text>
              <Text style={styles.detailValue}>{shop.phone}</Text>
            </View>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="call" size={18} color={colors.primary[500]} />
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <Ionicons name="location-outline" size={20} color={colors.primary[500]} />
            </View>
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>Address</Text>
              <Text style={styles.detailValue}>{shop.address}</Text>
              <Text style={styles.detailSubvalue}>{areaLabel}, {cityLabel}</Text>
            </View>
          </View>
        </Card>

        {/* Orders Summary - Only for Booker */}
        {isBooker && (
          <>
            <Text style={styles.sectionTitle}>Orders Summary</Text>
            <View style={styles.statsRow}>
              <Card style={styles.statCard}>
                <Text style={styles.statValue}>{shopOrders.length}</Text>
                <Text style={styles.statLabel}>Total Orders</Text>
              </Card>
              <Card style={styles.statCard}>
                <Text style={styles.statValue}>
                  {shopOrders.filter((o) => o.status === 'submitted').length}
                </Text>
                <Text style={styles.statLabel}>Submitted</Text>
              </Card>
              <Card style={styles.statCard}>
                <Text style={styles.statValue}>
                  {shopOrders.filter((o) => o.status === 'draft').length}
                </Text>
                <Text style={styles.statLabel}>Drafts</Text>
              </Card>
            </View>
          </>
        )}

        {/* Recent Orders - Only for Booker */}
        {isBooker && shopOrders.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Recent Orders</Text>
            {shopOrders.slice(0, 3).map((order) => (
              <Card
                key={order.id}
                style={styles.orderCard}
                onPress={() => router.push(`/(tabs)/orders/${order.id}`)}
              >
                <View style={styles.orderHeader}>
                  <Text style={styles.orderNumber}>{order.orderNumber}</Text>
                  <View style={[styles.orderStatus, { backgroundColor: colors.status[order.status === 'draft' ? 'draft' : order.status === 'submitted' ? 'submitted' : 'editRequested'] + '20' }]}>
                    <Text style={[styles.orderStatusText, { color: colors.status[order.status === 'draft' ? 'draft' : order.status === 'submitted' ? 'submitted' : 'editRequested'] }]}>
                      {order.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <View style={styles.orderFooter}>
                  <Text style={styles.orderAmount}>
                    Rs. {order.grandTotal.toLocaleString()}
                  </Text>
                  {order.paymentMode !== 'cash' && (
                    <View style={styles.paymentBadge}>
                      <Text style={styles.paymentBadgeText}>
                        {order.paymentMode === 'credit' ? 'Credit' : 'Partial'}
                      </Text>
                    </View>
                  )}
                </View>
              </Card>
            ))}
          </>
        )}

        {/* Delete Button - Only for Booker */}
        {isBooker && (
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={20} color={colors.error} />
            <Text style={styles.deleteText}>Delete Shop</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Footer Action Button - Role based */}
      <View style={styles.footer}>
        {isBooker ? (
          <Button
            title="Create Order"
            onPress={handleCreateOrder}
            fullWidth
            size="lg"
            icon={<Ionicons name="cart" size={20} color={colors.text.inverse} />}
          />
        ) : (
          <Button
            title="View Ledger"
            onPress={handleViewLedger}
            fullWidth
            size="lg"
            variant="outline"
            icon={<Ionicons name="document-text" size={20} color={colors.primary[500]} />}
          />
        )}
      </View>
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
  headerCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginBottom: spacing.md,
  },
  shopIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  shopName: {
    ...typography.h2,
    color: colors.text.primary,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  shopId: {
    ...typography.caption,
    color: colors.text.muted,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray[100],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  statusText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  
  // Ledger Card Styles
  ledgerCard: {
    marginBottom: spacing.lg,
  },
  ledgerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ledgerTitle: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  viewLedgerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  viewLedgerText: {
    ...typography.caption,
    color: colors.primary[500],
  },

  sectionTitle: {
    ...typography.h4,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  detailsCard: {
    marginBottom: spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
  },
  detailIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    ...typography.caption,
    color: colors.text.muted,
    marginBottom: 2,
  },
  detailValue: {
    ...typography.body,
    color: colors.text.primary,
  },
  detailSubvalue: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: 2,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  statValue: {
    ...typography.h3,
    color: colors.primary[500],
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: 2,
  },
  orderCard: {
    marginBottom: spacing.sm,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  orderNumber: {
    ...typography.captionMedium,
    color: colors.text.secondary,
  },
  orderStatus: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  orderStatusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  orderFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  orderAmount: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  paymentBadge: {
    backgroundColor: colors.info + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  paymentBadgeText: {
    ...typography.caption,
    color: colors.info,
    fontWeight: '600',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  deleteText: {
    ...typography.body,
    color: colors.error,
  },
  requestCard: {
    backgroundColor: colors.warning + '15',
    marginBottom: spacing.lg,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  requestTitle: {
    ...typography.bodyMedium,
    color: colors.warning,
  },
  requestText: {
    ...typography.caption,
    color: colors.text.muted,
  },
  detailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[50],
  },
  editButtonText: {
    ...typography.caption,
    color: colors.primary[500],
  },
  footer: {
    padding: spacing.base,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});

