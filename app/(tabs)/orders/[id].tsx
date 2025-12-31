import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useOrderStore, useAuthStore } from '../../../src/stores';
import { Button, Card, Badge, LoadingSpinner, OrderItemRow } from '../../../src/components';
import { colors, typography, spacing, borderRadius, shadows } from '../../../src/theme';
import { OrderStatus } from '../../../src/types';

export default function OrderDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getOrderById, setCurrentOrder, requestEdit, loadOrders } = useOrderStore();
  const { user } = useAuthStore();
  const [isRequesting, setIsRequesting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  
  const isSalesman = user?.role === 'salesman';
  const isKPO = user?.role === 'kpo';
  const isBooker = user?.role === 'booker';

  // Reload orders when screen comes into focus to get latest status
  useFocusEffect(
    React.useCallback(() => {
      loadOrders();
    }, [id])
  );

  const order = getOrderById(id);

  // Redirect salesmen to delivery detail screen (they should not access order detail)
  useEffect(() => {
    if (isSalesman && order) {
      // Find delivery for this order
      const { useDeliveryStore } = require('../../../src/stores');
      const deliveryStore = useDeliveryStore.getState();
      const delivery = deliveryStore.deliveries.find(d => d.orderId === order.id);
      
      if (delivery) {
        // Redirect to delivery detail screen
        router.replace(`/(tabs)/deliveries/${delivery.id}`);
      } else {
        // No delivery found, go back to home
        router.replace('/(tabs)/');
      }
    }
  }, [isSalesman, order]);

  if (!order) {
    return (
      <View style={styles.notFound}>
        <Ionicons name="alert-circle-outline" size={64} color={colors.gray[300]} />
        <Text style={styles.notFoundText}>Order not found</Text>
        <Button 
          title="Go Back" 
          onPress={() => {
            // Role-based back navigation
            if (isSalesman) {
              router.replace('/(tabs)/');
            } else {
              router.back();
            }
          }} 
          variant="outline" 
        />
      </View>
    );
  }

  // Block salesmen from viewing order detail screen
  if (isSalesman) {
    return (
      <View style={styles.notFound}>
        <Ionicons name="lock-closed" size={64} color={colors.gray[300]} />
        <Text style={styles.notFoundText}>Access Restricted</Text>
        <Text style={styles.notFoundSubtext}>
          Salesmen cannot access order details. Please use the Deliveries screen.
        </Text>
        <Button 
          title="Go to Home" 
          onPress={() => router.replace('/(tabs)/')} 
          variant="outline" 
        />
      </View>
    );
  }

  const statusConfig: Partial<Record<OrderStatus, { label: string; color: string; icon: string }>> = {
    draft: { label: 'DRAFT', color: colors.status.draft, icon: 'create-outline' },
    submitted: { label: 'SUBMITTED', color: colors.status.submitted, icon: 'checkmark-circle-outline' },
    edit_requested: { label: 'EDIT REQUESTED', color: colors.status.editRequested, icon: 'time-outline' },
    finalized: { label: 'FINALIZED', color: colors.success, icon: 'checkmark-done-circle-outline' },
    billed: { label: 'BILLED', color: colors.success, icon: 'receipt-outline' },
    load_form_ready: { label: 'LOAD FORM READY', color: colors.info, icon: 'cube-outline' },
    assigned: { label: 'ASSIGNED', color: colors.info, icon: 'person-outline' },
    delivered: { label: 'DELIVERED', color: colors.success, icon: 'checkmark-done-circle-outline' },
    approved: { label: 'APPROVED', color: colors.success, icon: 'checkmark-done-circle-outline' },
    rejected: { label: 'REJECTED', color: colors.error, icon: 'close-circle-outline' },
  };

  const config = statusConfig[order.status] || { 
    label: order.status.toUpperCase().replace(/_/g, ' '), 
    color: colors.gray[500], 
    icon: 'help-circle-outline' 
  };
  
  // Check if order can be edited:
  // - Draft orders can always be edited by creator
  // - KPO can directly edit submitted orders (without edit request)
  // - Booker can edit if edit request was approved
  // - Salesmen CANNOT edit orders (already blocked above, but extra safety check)
  const isEditable = !isSalesman && (
    order.status === 'draft' || 
    (isKPO && order.status === 'submitted') ||
    (isBooker && order.status === 'submitted' && (order as any).editApproved === true)
  );
  
  // Booker can request edit if order is submitted and not yet approved for editing
  // OR if status is edit_requested (pending approval)
  // Salesmen CANNOT request edits
  const canRequestEdit = !isSalesman && isBooker && 
    ((order.status === 'submitted' && !(order as any).editApproved) ||
     (order.status === 'edit_requested'));

  // Debug: Log order and button visibility (after isEditable and canRequestEdit are defined)
  useEffect(() => {
    if (order) {
      console.log('Order Details:', {
        id: order.id,
        status: order.status,
        editApproved: (order as any).editApproved,
        userRole: user?.role,
        isEditable,
        canRequestEdit,
        isRequesting
      });
    }
  }, [order?.status, (order as any)?.editApproved, user?.role, isEditable, canRequestEdit, isRequesting]);

  const handleEdit = () => {
    // When KPO edits a submitted order, we need to ensure it maintains its submitted status
    // but is editable. The order will be updated (not recreated) when saved.
    setCurrentOrder(order);
    router.push('/(tabs)/orders/create/products');
  };

  // Process edit request
  const processEditRequest = async () => {
    console.log('=== Processing edit request ===');
    try {
      setIsRequesting(true);
      console.log('Setting isRequesting to true');
      console.log('Calling requestEdit for order:', order.id);
      
      await requestEdit(order.id);
      console.log('requestEdit completed');
      
      // Reload orders to get updated status
      console.log('Reloading orders...');
      await loadOrders();
      console.log('Orders reloaded successfully');
      
      setIsRequesting(false);
      console.log('Setting isRequesting to false');
      
      // Show success message
      if (Platform.OS === 'web') {
        alert('Success: Edit request has been sent to KPO. You will be notified when it is approved.');
      } else {
        Alert.alert(
          'Success', 
          'Edit request has been sent to KPO. You will be notified when it is approved.',
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      console.error('=== ERROR in requestEdit ===', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      setIsRequesting(false);
      
      if (Platform.OS === 'web') {
        alert(`Error: ${error.message || 'Failed to send edit request. Please try again.'}`);
      } else {
        Alert.alert(
          'Error',
          error.message || 'Failed to send edit request. Please try again.'
        );
      }
    }
  };

  const handleRequestEdit = async () => {
    console.log('=== handleRequestEdit CALLED ===');
    console.log('Order ID:', order.id);
    console.log('Order Status:', order.status);
    console.log('User Role:', user?.role);
    
    // Check if already requested
    if (order.status === 'edit_requested') {
      console.log('Order already has edit_requested status');
      if (Platform.OS === 'web') {
        alert('Edit Request Pending: You have already requested to edit this order. Please wait for KPO approval.');
      } else {
        Alert.alert(
          'Edit Request Pending',
          'You have already requested to edit this order. Please wait for KPO approval.'
        );
      }
      return;
    }

    // Show confirmation dialog
    console.log('Showing confirmation dialog...');
    
    // On web, use Modal; on native, use Alert
    if (Platform.OS === 'web') {
      setShowConfirmModal(true);
    } else {
      Alert.alert(
        'Request Edit',
        'This will send a request to KPO to allow editing this order. Continue?',
        [
          { 
            text: 'Cancel', 
            style: 'cancel',
            onPress: () => {
              console.log('User cancelled edit request');
            }
          },
          {
            text: 'Request',
            onPress: async () => {
              await processEditRequest();
            },
          },
        ],
        { cancelable: true }
      );
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Card */}
        <Card style={[styles.statusCard, { borderLeftColor: config.color }]}>
          <View style={styles.statusRow}>
            <Ionicons name={config.icon} size={24} color={config.color} />
            <View style={styles.statusInfo}>
              <Text style={styles.orderNumber}>{order.orderNumber}</Text>
              <Badge
                label={config.label}
                variant={
                  order.status === 'draft' ? 'draft' : 
                  order.status === 'submitted' ? 'submitted' : 
                  order.status === 'edit_requested' ? 'editRequested' :
                  order.status === 'delivered' || order.status === 'finalized' || order.status === 'billed' ? 'success' :
                  'default'
                }
              />
            </View>
          </View>
        </Card>

        {/* Shop Info */}
        <Card style={styles.shopCard}>
          <View style={styles.shopRow}>
            <View style={styles.shopIcon}>
              <Ionicons name="storefront" size={24} color={colors.primary[500]} />
            </View>
            <View style={styles.shopInfo}>
              <Text style={styles.shopLabel}>Shop</Text>
              <Text style={styles.shopName}>{order.shopName}</Text>
            </View>
          </View>
          <View style={styles.dateRow}>
            <Ionicons name="calendar-outline" size={16} color={colors.gray[400]} />
            <Text style={styles.dateText}>
              {new Date(order.createdAt).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        </Card>

        {/* Order Items */}
        <Text style={styles.sectionTitle}>Order Items ({order.items.length})</Text>
        {order.items.map((item) => (
          <OrderItemRow key={item.id} item={item} editable={false} hideDiscount={isSalesman} />
        ))}

        {/* Discount Summary - Hidden for Salesman */}
        {!isSalesman && order.unauthorizedDiscount > 0 && (
          <Card style={styles.warningCard}>
            <View style={styles.warningHeader}>
              <Ionicons name="warning" size={24} color={colors.warning} />
              <Text style={styles.warningTitle}>Unauthorized Discount</Text>
            </View>
            <Text style={styles.warningText}>
              Extra discount of Rs. {order.unauthorizedDiscount.toLocaleString()} was given
              beyond the allowed limit. This amount will be deducted from salary.
            </Text>
          </Card>
        )}

        {/* Order Summary */}
        <Text style={styles.sectionTitle}>Order Summary</Text>
        <Card style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>Rs. {order.subtotal.toLocaleString()}</Text>
          </View>
          {!isSalesman && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Discount</Text>
              <Text style={[styles.summaryValue, { color: colors.error }]}>
                -Rs. {order.totalDiscount.toLocaleString()}
              </Text>
            </View>
          )}
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.grandTotalLabel}>Grand Total</Text>
            <Text style={styles.grandTotalValue}>
              Rs. {order.grandTotal.toLocaleString()}
            </Text>
          </View>
        </Card>

        {/* Notes */}
        {order.notes && (
          <>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Card style={styles.notesCard}>
              <Text style={styles.notesText}>{order.notes}</Text>
            </Card>
          </>
        )}
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.footer}>
        {isEditable && (
          <Button
            title="Edit Order"
            onPress={handleEdit}
            fullWidth
            size="lg"
            icon={<Ionicons name="create" size={20} color={colors.text.inverse} />}
          />
        )}
        {canRequestEdit && (
          <Button
            title={order.status === 'edit_requested' ? 'Edit Requested (Pending Approval)' : 'Request Edit'}
            onPress={() => {
              console.log('=== BUTTON PRESSED ===');
              console.log('Order ID:', order.id);
              console.log('Order Status:', order.status);
              console.log('User Role:', user?.role);
              console.log('Is Requesting:', isRequesting);
              
              // Call the handler directly
              handleRequestEdit();
            }}
            loading={isRequesting}
            disabled={order.status === 'edit_requested' || isRequesting}
            fullWidth
            size="lg"
            variant="outline"
            icon={<Ionicons 
              name={order.status === 'edit_requested' ? 'time-outline' : 'create-outline'} 
              size={20} 
              color={order.status === 'edit_requested' ? colors.warning : colors.primary[500]} 
            />}
          />
        )}
        {/* Debug info */}
        {__DEV__ && canRequestEdit && (
          <View style={{ padding: 10, backgroundColor: '#f0f0f0', marginTop: 10 }}>
            <Text style={{ fontSize: 10, color: '#666' }}>
              Debug: canRequestEdit={String(canRequestEdit)}, status={order.status}, role={user?.role}
            </Text>
          </View>
        )}
      </View>

      {/* Confirmation Modal for Web */}
      <Modal
        visible={showConfirmModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Request Edit</Text>
            <Text style={styles.modalMessage}>
              This will send a request to KPO to allow editing this order. Continue?
            </Text>
            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                onPress={() => {
                  console.log('User cancelled edit request');
                  setShowConfirmModal(false);
                }}
                variant="outline"
                style={styles.modalButton}
              />
              <Button
                title="Request"
                onPress={async () => {
                  setShowConfirmModal(false);
                  await processEditRequest();
                }}
                loading={isRequesting}
                disabled={isRequesting}
                style={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>
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
  notFoundSubtext: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  statusCard: {
    borderLeftWidth: 4,
    marginBottom: spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  statusInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderNumber: {
    ...typography.h4,
    color: colors.text.primary,
  },
  shopCard: {
    marginBottom: spacing.lg,
  },
  shopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  shopIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  shopInfo: {
    flex: 1,
  },
  shopLabel: {
    ...typography.caption,
    color: colors.text.muted,
  },
  shopName: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dateText: {
    ...typography.caption,
    color: colors.text.muted,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text.primary,
    marginBottom: spacing.md,
    marginTop: spacing.md,
  },
  warningCard: {
    backgroundColor: '#FEF3C7',
    marginBottom: spacing.md,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  warningTitle: {
    ...typography.bodyMedium,
    color: '#92400E',
  },
  warningText: {
    ...typography.caption,
    color: '#92400E',
    lineHeight: 18,
  },
  summaryCard: {},
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  summaryLabel: {
    ...typography.body,
    color: colors.text.secondary,
  },
  summaryValue: {
    ...typography.body,
    color: colors.text.primary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  grandTotalLabel: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  grandTotalValue: {
    ...typography.h3,
    color: colors.primary[500],
  },
  notesCard: {
    backgroundColor: colors.gray[50],
  },
  notesText: {
    ...typography.body,
    color: colors.text.secondary,
    fontStyle: 'italic',
  },
  footer: {
    padding: spacing.base,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    width: '90%',
    maxWidth: 400,
    ...shadows.lg,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  modalMessage: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'flex-end',
  },
  modalButton: {
    flex: 1,
    minWidth: 100,
  },
});

