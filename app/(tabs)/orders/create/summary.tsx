import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useOrderStore, useShopStore, useAuthStore } from '../../../../src/stores';
import {
  Button,
  Card,
  OrderItemRow,
  UnauthorizedDiscountPopup,
  PaymentModeSelector,
} from '../../../../src/components';
import { colors, typography, spacing, borderRadius, shadows } from '../../../../src/theme';

export default function OrderSummaryScreen() {
  const {
    currentOrder,
    calculateTotals,
    saveDraft,
    submitOrder,
    updateItemQuantity,
    updateItemDiscount,
    removeItem,
    updateNotes,
    updatePaymentMode,
    clearCurrentOrder,
  } = useOrderStore();
  
  const { getShopById } = useShopStore();
  const { user } = useAuthStore();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [showDiscountPopup, setShowDiscountPopup] = useState(false);
  const [unauthorizedAmount, setUnauthorizedAmount] = useState(0);

  useEffect(() => {
    if (!currentOrder || currentOrder.items.length === 0) {
      router.replace('/(tabs)/orders/create');
    }
  }, [currentOrder]);

  const totals = calculateTotals();
  const shop = currentOrder ? getShopById(currentOrder.shopId) : null;
  
  // Safety checks for totals
  const safeTotals = {
    subtotal: totals?.subtotal || 0,
    totalDiscount: totals?.totalDiscount || 0,
    grandTotal: totals?.grandTotal || 0,
    unauthorizedDiscount: totals?.unauthorizedDiscount || 0,
    hasUnauthorizedDiscount: totals?.hasUnauthorizedDiscount || false,
  };

  // Set payment mode to cash only
  useEffect(() => {
    if (currentOrder && safeTotals.grandTotal > 0) {
      // Always set to cash payment mode
      if (currentOrder.paymentMode !== 'cash') {
        updatePaymentMode('cash');
      }
    }
  }, [safeTotals.grandTotal, currentOrder?.paymentMode]);

  const handleSaveDraft = async () => {
    setIsSavingDraft(true);
    await saveDraft();
    setIsSavingDraft(false);
    Alert.alert('Success', 'Order saved as draft!', [
      {
        text: 'OK',
        onPress: () => {
          clearCurrentOrder();
          router.replace('/(tabs)/orders');
        },
      },
    ]);
  };

  const handleSubmit = async () => {
    // Ensure payment mode is cash
    if (currentOrder?.paymentMode !== 'cash') {
      updatePaymentMode('cash');
    }

    setIsSubmitting(true);
    const result = await submitOrder();
    setIsSubmitting(false);

    if (result.requiresConfirmation) {
      setUnauthorizedAmount(result.unauthorizedAmount || 0);
      setShowDiscountPopup(true);
    } else if (result.success) {
      Alert.alert('Success', result.message, [
        {
          text: 'OK',
          onPress: () => router.replace('/(tabs)/orders'),
        },
      ]);
    } else {
      Alert.alert('Error', result.message);
    }
  };

  const handleConfirmUnauthorized = async () => {
    setShowDiscountPopup(false);
    setIsSubmitting(true);
    const result = await submitOrder(true);
    setIsSubmitting(false);

    if (result.success) {
      Alert.alert('Success', result.message, [
        {
          text: 'OK',
          onPress: () => router.replace('/(tabs)/orders'),
        },
      ]);
    } else {
      Alert.alert('Error', result.message);
    }
  };

  if (!currentOrder) {
    return null;
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
          <View style={[styles.stepCircle, styles.stepCircleCompleted]}>
            <Ionicons name="checkmark" size={16} color={colors.text.inverse} />
          </View>
          <Text style={styles.stepTextCompleted}>Products</Text>
        </View>
        <View style={[styles.stepLine, styles.stepLineActive]} />
        <View style={styles.stepItem}>
          <View style={[styles.stepCircle, styles.stepCircleActive]}>
            <Text style={styles.stepNumberActive}>3</Text>
          </View>
          <Text style={styles.stepTextActive}>Summary</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Shop Info */}
        <Card style={styles.shopCard}>
          <View style={styles.shopRow}>
            <Ionicons name="storefront" size={24} color={colors.primary[500]} />
            <View style={styles.shopInfo}>
              <Text style={styles.shopLabel}>Order for</Text>
              <Text style={styles.shopName}>{currentOrder.shopName}</Text>
            </View>
          </View>
        </Card>

        {/* Order Items */}
        <Text style={styles.sectionTitle}>
          Order Items ({currentOrder.items.length})
        </Text>
        {currentOrder.items.map((item) => (
          <OrderItemRow
            key={item.id}
            item={item}
            editable
            onQuantityChange={(qty) => updateItemQuantity(item.id, qty)}
            onDiscountChange={(discount) => updateItemDiscount(item.id, discount)}
            onRemove={() => removeItem(item.id)}
          />
        ))}

        {/* Discount Warning */}
        {safeTotals.hasUnauthorizedDiscount && (
          <Card style={styles.warningCard}>
            <View style={styles.warningHeader}>
              <Ionicons name="warning" size={24} color={colors.warning} />
              <Text style={styles.warningTitle}>⚠️ Unauthorized Discount</Text>
            </View>
            <Text style={styles.warningText}>
              Aap ne allowed discount se ziada discount diya hai.{'\n'}
              Extra discount: <Text style={styles.amountText}>Rs. {safeTotals.unauthorizedDiscount.toLocaleString()}</Text>
              {'\n\n'}
              <Text style={styles.salaryWarning}>
                💰 Salary Deduction Notice:{'\n'}
                Ye extra discount aap ki salary me se kate ga.
              </Text>
            </Text>
          </Card>
        )}

        {/* Payment Mode - Cash Only */}
        <Text style={styles.sectionTitle}>Payment</Text>
        <Card style={styles.paymentCard}>
          <View style={styles.paymentRow}>
            <View style={styles.paymentItem}>
              <Ionicons name="cash-outline" size={24} color={colors.primary[500]} />
              <Text style={styles.paymentLabel}>Cash Payment</Text>
            </View>
            <Text style={styles.paymentValue}>
              Rs. {safeTotals.grandTotal.toLocaleString()}
            </Text>
          </View>
        </Card>

        {/* Notes */}
        <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>
          Notes (Optional)
        </Text>
        <TextInput
          style={styles.notesInput}
          placeholder="Add notes for this order..."
          placeholderTextColor={colors.gray[400]}
          value={currentOrder.notes}
          onChangeText={updateNotes}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />

        {/* Order Summary */}
        <Text style={styles.sectionTitle}>Order Summary</Text>
        <Card style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>
              Rs. {safeTotals.subtotal.toLocaleString()}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Discount</Text>
            <Text style={[styles.summaryValue, { color: colors.error }]}>
              -Rs. {safeTotals.totalDiscount.toLocaleString()}
            </Text>
          </View>
          {user && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { fontSize: 11, color: colors.gray[500] }]}>
                Max Allowed: {user.maxDiscountPercent || 0}% / Rs. {(user.maxDiscountAmount || 0).toLocaleString()}
              </Text>
              <Text style={[styles.summaryValue, { fontSize: 11, color: safeTotals.totalDiscount > (user.maxDiscountAmount || 0) ? colors.error : colors.success }]}>
                {safeTotals.totalDiscount > (user.maxDiscountAmount || 0) ? '⚠️ Exceeded' : '✓ Within Limit'}
              </Text>
            </View>
          )}
          {safeTotals.hasUnauthorizedDiscount && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.error }]}>
                ⚠️ Limit Exceeded
              </Text>
              <Text style={[styles.summaryValue, { color: colors.error }]}>
                Rs. {safeTotals.unauthorizedDiscount.toLocaleString()}
              </Text>
            </View>
          )}
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.grandTotalLabel}>Grand Total</Text>
            <Text style={styles.grandTotalValue}>
              Rs. {safeTotals.grandTotal.toLocaleString()}
            </Text>
          </View>
          
          {/* Payment - Cash Only */}
          <View style={styles.paymentBreakdown}>
            <View style={styles.paymentRow}>
              <View style={styles.paymentItem}>
                <Ionicons name="cash-outline" size={16} color={colors.primary[500]} />
                <Text style={styles.paymentLabel}>Payment Mode: Cash</Text>
              </View>
              <Text style={styles.paymentValue}>
                Rs. {safeTotals.grandTotal.toLocaleString()}
              </Text>
            </View>
          </View>
        </Card>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.footer}>
        <Button
          title="Save as Draft"
          onPress={handleSaveDraft}
          loading={isSavingDraft}
          variant="outline"
          size="lg"
          style={styles.draftButton}
        />
        <Button
          title="Submit Order"
          onPress={handleSubmit}
          loading={isSubmitting}
          size="lg"
          style={styles.submitButton}
        />
      </View>

      {/* Unauthorized Discount Popup */}
      <UnauthorizedDiscountPopup
        visible={showDiscountPopup}
        amount={unauthorizedAmount}
        onCancel={() => setShowDiscountPopup(false)}
        onConfirm={handleConfirmUnauthorized}
      />
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
    padding: spacing.base,
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
  stepNumberActive: {
    ...typography.captionMedium,
    color: colors.text.inverse,
  },
  stepTextActive: {
    ...typography.captionMedium,
    color: colors.primary[500],
  },
  stepTextCompleted: {
    ...typography.captionMedium,
    color: colors.primary[500],
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing['3xl'],
  },
  shopCard: {
    marginBottom: spacing.base,
    padding: spacing.md,
  },
  shopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
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
  sectionTitle: {
    ...typography.bodyMedium,
    fontWeight: '700',
    color: colors.text.secondary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  warningCard: {
    backgroundColor: '#FEF3C7',
    marginBottom: spacing.lg,
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
  amountText: {
    fontWeight: '700',
    color: colors.error,
  },
  salaryWarning: {
    fontWeight: '600',
    color: '#991B1B',
  },
  notesInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    minHeight: 60,
    ...typography.body,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  paymentCard: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  summaryCard: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.gray[100],
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
    ...typography.body,
    color: colors.text.primary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.gray[200],
    marginVertical: spacing.md,
  },
  grandTotalLabel: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  grandTotalValue: {
    ...typography.h2,
    color: colors.primary[500],
    fontWeight: '800',
  },
  paymentBreakdown: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
    backgroundColor: colors.gray[50],
    marginHorizontal: -spacing.lg,
    marginBottom: -spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: borderRadius.lg,
    borderBottomRightRadius: borderRadius.lg,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  paymentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  paymentLabel: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  paymentValue: {
    ...typography.body,
    color: colors.text.primary,
  },
  footer: {
    flexDirection: 'row',
    padding: spacing.base,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.md,
  },
  draftButton: {
    flex: 1,
  },
  submitButton: {
    flex: 1,
  },
});
