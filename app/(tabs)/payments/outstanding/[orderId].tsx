import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useOutstandingPaymentStore, useDeliveryStore, useOrderStore, useAuthStore } from '../../../../src/stores';
import { Card, Button, LoadingSpinner } from '../../../../src/components';
import { colors, typography, spacing, borderRadius, shadows } from '../../../../src/theme';
import { PaymentRecord } from '../../../../src/types/delivery';

export default function OutstandingPaymentScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { outstandingPayments, getOutstandingPaymentByOrderId, updateOutstandingPayment, clearOutstandingPayment, loadOutstandingPayments } = useOutstandingPaymentStore();
  const { deliveries, getDeliveryById, loadDeliveries, updateDeliveryPayment } = useDeliveryStore();
  const { orders, getOrderById, loadOrders, updateOrderStatus } = useOrderStore();
  const { user } = useAuthStore();

  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadOutstandingPayments();
    loadDeliveries();
    loadOrders();
  }, []);

  const outstandingPayment = orderId ? getOutstandingPaymentByOrderId(orderId) : null;
  const order = outstandingPayment ? getOrderById(outstandingPayment.orderId) : null;
  const delivery = outstandingPayment?.deliveryId ? getDeliveryById(outstandingPayment.deliveryId) : null;

  if (!outstandingPayment || !order) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.notFound}>
          <Ionicons name="alert-circle-outline" size={64} color={colors.gray[300]} />
          <Text style={styles.notFoundText}>Outstanding payment not found</Text>
          <Button title="Go Back" onPress={() => router.back()} variant="outline" />
        </View>
      </SafeAreaView>
    );
  }

  const paymentHistory = delivery?.paymentHistory || [];
  const remainingBalance = outstandingPayment.remainingBalance;
  
  // Default amount to remaining balance
  useEffect(() => {
    if (!amount && remainingBalance > 0) {
      setAmount(remainingBalance.toString());
    }
  }, [remainingBalance]);

  const handleAmountChange = (text: string) => {
    const filtered = text.replace(/[^0-9.]/g, '');
    const parts = filtered.split('.');
    if (parts.length <= 2) {
      setAmount(filtered);
    }
  };

  const handleSubmit = async () => {
    const numAmount = parseFloat(amount);
    
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid payment amount');
      return;
    }

    if (numAmount > remainingBalance) {
      Alert.alert('Invalid Amount', `Payment amount (Rs. ${numAmount.toLocaleString()}) cannot exceed remaining balance (Rs. ${remainingBalance.toLocaleString()})`);
      return;
    }

    setIsSubmitting(true);
    
    try {
      const newPaidAmount = outstandingPayment.paidAmount + numAmount;
      const newRemainingBalance = outstandingPayment.totalAmount - newPaidAmount;
      const newPaymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID' = newRemainingBalance === 0 ? 'PAID' : (newPaidAmount > 0 ? 'PARTIAL' : 'UNPAID');

      // Update delivery payment history
      if (delivery) {
        await updateDeliveryPayment(delivery.id, numAmount, notes.trim() || undefined);
      }

      // Create ledger entry for this payment
      try {
        const { createPaymentCollectionLedgerEntry } = await import('../../../../src/services/ledgerService');
        const { useShopStore } = await import('../../../../src/stores');
        const shopStore = useShopStore.getState();
        const shop = shopStore.getShopById(outstandingPayment.shopId);

        if (shop && user) {
          await createPaymentCollectionLedgerEntry(
            outstandingPayment.orderId,
            outstandingPayment.orderNumber,
            outstandingPayment.shopId,
            outstandingPayment.shopName,
            numAmount,
            newRemainingBalance,
            paymentHistory.length + 1, // Next payment sequence
            user.id,
            order.regionId || '',
            shop.branch,
            notes.trim() || `Payment collection - Order ${outstandingPayment.orderNumber}`
          );
        }
      } catch (ledgerError) {
        console.error('Failed to create ledger entry:', ledgerError);
        // Continue even if ledger creation fails
      }

      // Update outstanding payment record
      if (newPaymentStatus === 'PAID') {
        await clearOutstandingPayment(outstandingPayment.orderId);
      } else {
        await updateOutstandingPayment(
          outstandingPayment.orderId,
          newPaidAmount,
          newRemainingBalance,
          newPaymentStatus
        );
      }

      // Update order payment status
      try {
        await updateOrderStatus(order.id, order.status, {
          cashAmount: newPaidAmount,
          creditAmount: 0,
          paymentMode: 'cash',
          paymentStatus: newPaymentStatus,
          paidAmount: newPaidAmount,
          remainingBalance: newRemainingBalance,
        });
      } catch (orderError) {
        console.warn('Failed to update order status:', orderError);
      }

      // If fully paid, create SALE_DELIVERED ledger entry
      if (newPaymentStatus === 'PAID') {
        try {
          const { createLedgerEntryOnDelivery } = await import('../../../../src/services/ledgerService');
          const { useShopStore } = await import('../../../../src/stores');
          const shopStore = useShopStore.getState();
          const shop = shopStore.getShopById(outstandingPayment.shopId);

          if (shop && user) {
            await createLedgerEntryOnDelivery(
              order,
              user.id,
              shop.shopName,
              shop.branch
            );
          }
        } catch (ledgerError) {
          console.error('Failed to create SALE_DELIVERED ledger entry:', ledgerError);
        }
      }

      const message = newPaymentStatus === 'PAID'
        ? `Payment collected successfully!\n\nTotal collected: Rs. ${newPaidAmount.toLocaleString()}\n\nOrder is now fully paid.`
        : `Payment collected successfully!\n\nCollected: Rs. ${numAmount.toLocaleString()}\nRemaining: Rs. ${newRemainingBalance.toLocaleString()}`;

      Alert.alert('Success', message, [
        {
          text: 'OK',
          onPress: () => {
            router.back();
          },
        },
      ]);
    } catch (error: any) {
      console.error('Error collecting payment:', error);
      Alert.alert('Error', error.message || 'Failed to collect payment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Collect Payment</Text>
            <View style={styles.backButton} />
          </View>

          {/* Order Info */}
          <Card style={styles.orderCard}>
            <Text style={styles.cardTitle}>Order Information</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Order Number:</Text>
              <Text style={styles.infoValue}>{outstandingPayment.orderNumber}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Shop Name:</Text>
              <Text style={styles.infoValue}>{outstandingPayment.shopName}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Delivery Date:</Text>
              <Text style={styles.infoValue}>
                {new Date(outstandingPayment.deliveryDate).toLocaleDateString('en-PK')}
              </Text>
            </View>
          </Card>

          {/* Payment Summary */}
          <Card style={styles.summaryCard}>
            <Text style={styles.cardTitle}>Payment Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total Amount:</Text>
              <Text style={styles.summaryValue}>Rs. {outstandingPayment.totalAmount.toLocaleString()}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Paid Amount:</Text>
              <Text style={[styles.summaryValue, { color: colors.success }]}>
                Rs. {outstandingPayment.paidAmount.toLocaleString()}
              </Text>
            </View>
            <View style={[styles.summaryRow, styles.remainingRow]}>
              <Text style={styles.remainingLabel}>Remaining Balance:</Text>
              <Text style={styles.remainingValue}>
                Rs. {remainingBalance.toLocaleString()}
              </Text>
            </View>
          </Card>

          {/* Payment History */}
          {paymentHistory.length > 0 && (
            <Card style={styles.historyCard}>
              <Text style={styles.cardTitle}>Payment History</Text>
              {paymentHistory.map((payment, index) => (
                <View key={payment.id || index} style={styles.historyItem}>
                  <View style={styles.historyHeader}>
                    <Text style={styles.historyAmount}>Rs. {payment.amount.toLocaleString()}</Text>
                    <Text style={styles.historyDate}>
                      {new Date(payment.paidAt).toLocaleDateString('en-PK')}
                    </Text>
                  </View>
                  {payment.notes && (
                    <Text style={styles.historyNotes}>{payment.notes}</Text>
                  )}
                </View>
              ))}
            </Card>
          )}

          {/* Payment Input */}
          <Card style={styles.inputCard}>
            <Text style={styles.cardTitle}>Collect Payment</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Amount to Collect (Rs.)</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={handleAmountChange}
                placeholder="0"
                placeholderTextColor={colors.text.muted}
                keyboardType="numeric"
                editable={!isSubmitting}
              />
              <TouchableOpacity
                style={styles.fullAmountButton}
                onPress={() => setAmount(remainingBalance.toString())}
                disabled={isSubmitting}
              >
                <Text style={styles.fullAmountText}>
                  Use Full Amount (Rs. {remainingBalance.toLocaleString()})
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Notes (Optional)</Text>
              <TextInput
                style={styles.notesInput}
                value={notes}
                onChangeText={setNotes}
                placeholder="Add notes about this payment..."
                placeholderTextColor={colors.text.muted}
                multiline
                numberOfLines={3}
                editable={!isSubmitting}
              />
            </View>
          </Card>
        </ScrollView>

        {/* Footer Button */}
        <View style={styles.footer}>
          <Button
            title="Collect Payment"
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={isSubmitting || !amount || parseFloat(amount) <= 0}
            fullWidth
            size="lg"
            icon={<Ionicons name="cash" size={24} color={colors.text.inverse} />}
          />
        </View>
      </KeyboardAvoidingView>
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
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  notFoundText: {
    ...typography.bodyLarge,
    color: colors.text.secondary,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  orderCard: {
    marginBottom: spacing.md,
  },
  summaryCard: {
    marginBottom: spacing.md,
  },
  historyCard: {
    marginBottom: spacing.md,
  },
  inputCard: {
    marginBottom: spacing.md,
  },
  cardTitle: {
    ...typography.h4,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  infoLabel: {
    ...typography.body,
    color: colors.text.secondary,
  },
  infoValue: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    fontWeight: '600',
  },
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
    ...typography.bodyLarge,
    color: colors.text.primary,
    fontWeight: '600',
  },
  remainingRow: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  remainingLabel: {
    ...typography.bodyLarge,
    color: colors.text.primary,
    fontWeight: '600',
  },
  remainingValue: {
    ...typography.h4,
    color: colors.warning,
    fontWeight: '700',
  },
  historyItem: {
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  historyAmount: {
    ...typography.bodyMedium,
    color: colors.success,
    fontWeight: '600',
  },
  historyDate: {
    ...typography.caption,
    color: colors.text.muted,
  },
  historyNotes: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    ...typography.bodyMedium,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  amountInput: {
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...typography.bodyLarge,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  fullAmountButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
    alignItems: 'center',
  },
  fullAmountText: {
    ...typography.caption,
    color: colors.primary[600],
    fontWeight: '600',
  },
  notesInput: {
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...typography.body,
    color: colors.text.primary,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  footer: {
    padding: spacing.base,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...shadows.lg,
  },
});

