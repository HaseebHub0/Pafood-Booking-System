import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useShopStore, useLedgerStore, useBillStore, useOutstandingPaymentStore, useAuthStore } from '../../../src/stores';
import { Card, Button, CreditBadge, TransactionRowCompact } from '../../../src/components';
import { colors, typography, spacing, borderRadius, shadows, animations } from '../../../src/theme';
import { updateBillPaymentStatus } from '../../../src/services/billService';
import { createCreditCollectedLedgerEntry } from '../../../src/services/ledgerService';
import { formatPKR } from '../../../src/utils/formatters';

export default function CollectPaymentScreen() {
  const { shopId, billId, orderId } = useLocalSearchParams<{ shopId?: string; billId?: string; orderId?: string }>();
  const { getShopById } = useShopStore();
  const { recordPayment, getShopTransactions, loadTransactions } = useLedgerStore();
  const { bills, getBillById, loadBills, getShopBalance } = useBillStore();
  const { updateOutstandingPayment, getOutstandingPaymentByOrderId } = useOutstandingPaymentStore();
  const { user } = useAuthStore();
  
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Animation refs
  const headerAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;
  const amountAnim = useRef(new Animated.Value(0)).current;

  // Get shop - either from shopId or from bill
  const bill = billId ? getBillById(billId) : (orderId ? bills.find(b => b.orderId === orderId) : null);
  const shop = shopId ? getShopById(shopId) : (bill ? getShopById(bill.shopId) : null);
  const recentTransactions = shop ? getShopTransactions(shop.id, 5) : [];

  useEffect(() => {
    loadTransactions();
    loadBills();
    
    // Animate components
    Animated.parallel([
      Animated.timing(headerAnim, {
        toValue: 1,
        duration: animations.duration.normal,
        useNativeDriver: true,
      }),
      Animated.timing(cardAnim, {
        toValue: 1,
        duration: animations.duration.slow,
        delay: 100,
        useNativeDriver: true,
      }),
      Animated.timing(amountAnim, {
        toValue: 1,
        duration: animations.duration.normal,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  if (!shop) {
    return (
      <View style={styles.notFound}>
        <Ionicons name="alert-circle-outline" size={64} color={colors.gray[300]} />
        <Text style={styles.notFoundText}>Shop not found</Text>
        <Button title="Go Back" onPress={() => router.back()} variant="outline" />
      </View>
    );
  }

  // If bill exists, show bill-specific information
  // Calculate shop balance from bills (since shop.currentBalance doesn't exist)
  const shopBalance = shop ? getShopBalance(shop.id) : 0;
  const currentBalance = bill ? (bill.remainingCredit || 0) : shopBalance;
  const maxAmount = bill ? (bill.remainingCredit || 0) : (shopBalance > 0 ? shopBalance : undefined);

  const handleAmountChange = (text: string) => {
    // Only allow numbers and one decimal point
    const filtered = text.replace(/[^0-9.]/g, '');
    // Prevent multiple decimal points
    const parts = filtered.split('.');
    if (parts.length > 2) return;
    setAmount(filtered);
    setError('');
  };

  const handleQuickAmount = (value: number) => {
    setAmount(value.toString());
    setError('');
  };

  const handleSubmit = async () => {
    setError('');
    
    const numAmount = parseFloat(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    // Warn if amount exceeds balance (but allow it for advance)
    if (maxAmount && numAmount > maxAmount) {
      Alert.alert(
        'Excess Payment',
        `Payment of ${formatPKR(numAmount)} exceeds the ${bill ? 'remaining credit' : 'outstanding balance'} of ${formatPKR(maxAmount)}. The extra amount will be recorded as advance. Continue?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue', onPress: () => processPayment(numAmount) },
        ]
      );
      return;
    }

    await processPayment(numAmount);
  };

  const processPayment = async (numAmount: number) => {
    setIsLoading(true);
    
    try {
      // If this is a bill-based collection, update bill and credit records
      if (bill) {
        // Update bill payment status
        const billTotalAmount = bill.totalAmount || 0;
        const billPaidAmount = bill.paidAmount || 0;
        const newPaidAmount = billPaidAmount + numAmount;
        const newRemainingCredit = Math.max(0, billTotalAmount - newPaidAmount);
        
        const billUpdated = await updateBillPaymentStatus(bill.id, numAmount);
        
        if (!billUpdated) {
          setError('Failed to update bill status. Please try again.');
          setIsLoading(false);
          return;
        }

        // Create credit collected ledger entry (collected by salesman, but credit owned by booker)
        try {
          await createCreditCollectedLedgerEntry(
            bill.orderId,
            bill.orderNumber,
            bill.id,
            bill.billNumber,
            bill.shopId,
            bill.shopName,
            numAmount,
            newRemainingCredit,
            bill.bookerId,
            bill.bookerName,
            user?.id || 'unknown',
            user?.name,
            bill.regionId,
            bill.branch,
            notes.trim() || `Credit collection - Bill ${bill.billNumber}`
          );
        } catch (ledgerError) {
          console.error('Failed to create credit collected ledger entry:', ledgerError);
          // Continue even if ledger entry fails
        }

        // Update outstanding payment record if it exists
        const outstandingPayment = getOutstandingPaymentByOrderId(bill.orderId);
        if (outstandingPayment) {
          const newPaymentStatus = newRemainingCredit === 0 ? 'PAID' : 
                                   newPaidAmount > 0 && newRemainingCredit > 0 ? 'PARTIAL' : 'UNPAID';
          
          await updateOutstandingPayment(
            bill.orderId,
            newPaidAmount,
            newRemainingCredit,
            newPaymentStatus
          );
        }

        // Also record as regular payment for shop balance tracking
        await recordPayment({
          shopId: shop.id,
          amount: numAmount,
          notes: notes.trim() || `Credit collection - Bill ${bill.billNumber}`,
        });

        Alert.alert(
          'Payment Collected',
          `${formatPKR(numAmount)} collected successfully from ${shop.shopName}\n\nBill: ${bill.billNumber}\nRemaining Credit: ${formatPKR(newRemainingCredit)}`,
          [
            {
              text: 'OK',
              onPress: () => {
                // Reload data to reflect changes
                loadBills();
                loadTransactions();
                router.back();
              },
            },
          ]
        );
      } else {
        // Shop-based collection: Apply payment to oldest unpaid bill first
        const shopBills = bills
          .filter(b => b.shopId === shop.id && b.paymentStatus !== 'PAID' && (b.remainingCredit || 0) > 0)
          .sort((a, b) => new Date(a.billedAt).getTime() - new Date(b.billedAt).getTime()); // Oldest first
        
        if (shopBills.length === 0) {
          setError('No pending bills found for this shop.');
          setIsLoading(false);
          return;
        }

        // Apply payment to oldest bill
        const oldestBill = shopBills[0];
        const billTotalAmount = oldestBill.totalAmount || 0;
        const billPaidAmount = oldestBill.paidAmount || 0;
        const paymentAmount = Math.min(numAmount, oldestBill.remainingCredit || 0);
        const newPaidAmount = billPaidAmount + paymentAmount;
        const newRemainingCredit = Math.max(0, billTotalAmount - newPaidAmount);

        // Update bill payment status
        const billUpdated = await updateBillPaymentStatus(oldestBill.id, paymentAmount);
        
        if (!billUpdated) {
          setError('Failed to update bill status. Please try again.');
          setIsLoading(false);
          return;
        }

        // Create credit collected ledger entry
        try {
          await createCreditCollectedLedgerEntry(
            oldestBill.orderId,
            oldestBill.orderNumber,
            oldestBill.id,
            oldestBill.billNumber,
            oldestBill.shopId,
            oldestBill.shopName,
            paymentAmount,
            newRemainingCredit,
            oldestBill.bookerId,
            oldestBill.bookerName,
            user?.id || 'unknown',
            user?.name,
            oldestBill.regionId,
            oldestBill.branch,
            notes.trim() || `Credit collection - Bill ${oldestBill.billNumber}`
          );
        } catch (ledgerError) {
          console.error('Failed to create credit collected ledger entry:', ledgerError);
        }

        // Update outstanding payment record if it exists
        const outstandingPayment = getOutstandingPaymentByOrderId(oldestBill.orderId);
        if (outstandingPayment) {
          const newPaymentStatus = newRemainingCredit === 0 ? 'PAID' : 
                                   newPaidAmount > 0 && newRemainingCredit > 0 ? 'PARTIAL' : 'UNPAID';
          
          await updateOutstandingPayment(
            oldestBill.orderId,
            newPaidAmount,
            newRemainingCredit,
            newPaymentStatus
          );
        }

        // If payment amount was less than requested, show info
        const remainingPayment = numAmount - paymentAmount;
        const message = remainingPayment > 0
          ? `${formatPKR(paymentAmount)} applied to bill ${oldestBill.billNumber}. ${formatPKR(remainingPayment)} remaining.`
          : `${formatPKR(paymentAmount)} collected successfully from ${shop.shopName}\n\nBill: ${oldestBill.billNumber}\nRemaining Credit: ${formatPKR(newRemainingCredit)}`;

        Alert.alert(
          'Payment Collected',
          message,
          [
            {
              text: 'OK',
              onPress: () => {
                // Reload data to reflect changes
                loadBills();
                loadTransactions();
                router.back();
              },
            },
          ]
        );
      }
    } catch (err) {
      console.error('Payment collection error:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const quickAmounts = [
    maxAmount && maxAmount > 0 ? maxAmount : null,
    5000,
    10000,
    20000,
    50000,
  ].filter(Boolean) as number[];

  const balanceAfterPayment = currentBalance - (parseFloat(amount) || 0);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
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
                    outputRange: [-20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Collect Payment</Text>
            <Text style={styles.headerSubtitle}>Record payment from shop</Text>
          </View>
        </Animated.View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Shop Info Card */}
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
            <Card style={styles.shopCard}>
            <View style={styles.shopHeader}>
              <View style={styles.shopIconContainer}>
                <Ionicons name="storefront" size={28} color={colors.primary[500]} />
              </View>
              <View style={styles.shopInfo}>
                <Text style={styles.shopName}>{shop.shopName}</Text>
                <Text style={styles.shopOwner}>{shop.ownerName}</Text>
              </View>
            </View>
            
              {bill && (
                <View style={styles.billInfoSection}>
                  <Text style={styles.billInfoTitle}>Bill Information</Text>
                  <View style={styles.billInfoRow}>
                    <Text style={styles.billInfoLabel}>Bill Number:</Text>
                    <Text style={styles.billInfoValue}>{bill.billNumber}</Text>
                  </View>
                  <View style={styles.billInfoRow}>
                    <Text style={styles.billInfoLabel}>Order:</Text>
                    <Text style={styles.billInfoValue}>{bill.orderNumber}</Text>
                  </View>
                  <View style={styles.billInfoRow}>
                    <Text style={styles.billInfoLabel}>Total Amount:</Text>
                    <Text style={styles.billInfoValue}>{formatPKR(bill.totalAmount)}</Text>
                  </View>
                  <View style={styles.billInfoRow}>
                    <Text style={styles.billInfoLabel}>Paid:</Text>
                    <Text style={[styles.billInfoValue, { color: colors.success }]}>{formatPKR(bill.paidAmount)}</Text>
                  </View>
                </View>
              )}
              <View style={styles.balanceSection}>
                <View style={styles.balanceItem}>
                  <View style={styles.balanceIconContainer}>
                    <Ionicons 
                      name={currentBalance > 0 ? "arrow-up-circle" : currentBalance < 0 ? "arrow-down-circle" : "checkmark-circle"} 
                      size={20} 
                      color={currentBalance > 0 ? colors.primary[500] : currentBalance < 0 ? colors.info : colors.success} 
                    />
                  </View>
                  <Text style={styles.balanceLabel}>{bill ? 'Remaining Credit' : 'Current Balance'}</Text>
                  <Text
                    style={[
                      styles.balanceValue,
                      currentBalance > 0 && styles.balanceDue,
                      currentBalance < 0 && styles.balanceAdvance,
                    ]}
                  >
                    {formatPKR(Math.abs(currentBalance))}
                  </Text>
                  {currentBalance !== 0 && (
                    <Text style={styles.balanceNote}>
                      {currentBalance > 0 ? (bill ? '(Credit)' : '(Due)') : '(Advance)'}
                    </Text>
                  )}
                </View>
                {/* Credit Limit removed - shop type no longer has this field */}
              </View>
              
              {/* Balance After Payment Preview */}
              {amount && parseFloat(amount) > 0 && (
                <View style={styles.previewSection}>
                  <View style={styles.previewRow}>
                    <Text style={styles.previewLabel}>Balance After Payment:</Text>
                    <Text
                      style={[
                        styles.previewValue,
                        balanceAfterPayment > 0 && styles.previewDue,
                        balanceAfterPayment < 0 && styles.previewAdvance,
                        balanceAfterPayment === 0 && styles.previewZero,
                      ]}
                    >
                      {formatPKR(Math.abs(balanceAfterPayment))}
                    </Text>
                  </View>
                  {balanceAfterPayment < 0 && (
                    <View style={styles.advanceBadge}>
                      <Ionicons name="information-circle" size={14} color={colors.info} />
                      <Text style={styles.advanceText}>
                        This will create an advance balance
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </Card>
          </Animated.View>

          {/* Amount Input */}
          <Animated.View
            style={{
              opacity: amountAnim,
              transform: [
                {
                  translateY: amountAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
              ],
            }}
          >
            <Card style={styles.inputCard}>
              <View style={styles.inputHeader}>
                <Ionicons name="cash-outline" size={20} color={colors.primary[500]} />
                <Text style={styles.inputLabel}>Payment Amount</Text>
              </View>
              <View style={[
                styles.amountContainer,
                error && styles.amountContainerError,
                amount && parseFloat(amount) > 0 && styles.amountContainerFocused,
              ]}>
                <Text style={styles.currencySymbol}>Rs.</Text>
                <TextInput
                  style={styles.amountInput}
                  value={amount}
                  onChangeText={handleAmountChange}
                  placeholder="0"
                  placeholderTextColor={colors.text.muted}
                  keyboardType="numeric"
                  autoFocus
                />
              </View>
              {error ? (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={16} color={colors.error} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {/* Quick Amounts */}
              <View style={styles.quickAmountsContainer}>
                <Text style={styles.quickAmountsLabel}>Quick Amounts</Text>
                <View style={styles.quickAmounts}>
                  {quickAmounts.slice(0, 4).map((quickAmount, index) => {
                    const isSelected = parseFloat(amount) === quickAmount;
                    return (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.quickAmountButton,
                          isSelected && styles.quickAmountButtonActive,
                        ]}
                        onPress={() => handleQuickAmount(quickAmount)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.quickAmountText,
                            isSelected && styles.quickAmountTextActive,
                          ]}
                        >
                          {index === 0 && shopBalance > 0
                            ? 'Full'
                            : `${(quickAmount / 1000).toFixed(0)}k`}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Notes */}
              <View style={styles.notesSection}>
                <View style={styles.inputHeader}>
                  <Ionicons name="document-text-outline" size={18} color={colors.text.muted} />
                  <Text style={styles.inputLabel}>Notes (Optional)</Text>
                </View>
                <TextInput
                  style={styles.notesInput}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Add a note about this payment..."
                  placeholderTextColor={colors.text.muted}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </Card>
          </Animated.View>

          {/* Recent Transactions */}
          {recentTransactions.length > 0 && (
            <View style={styles.transactionsSection}>
              <View style={styles.sectionHeader}>
                <Ionicons name="time-outline" size={18} color={colors.text.secondary} />
                <Text style={styles.sectionTitle}>Recent Transactions</Text>
              </View>
              <Card style={styles.transactionsCard}>
                {recentTransactions.map((transaction, index) => (
                  <View key={transaction.id}>
                    <TransactionRowCompact transaction={transaction} />
                    {index < recentTransactions.length - 1 && <View style={styles.transactionDivider} />}
                  </View>
                ))}
              </Card>
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryLeft}>
                <Ionicons name="cash" size={20} color={colors.secondary[500]} />
                <Text style={styles.summaryLabel}>Collecting</Text>
              </View>
              <Text style={styles.summaryValue}>
                {formatPKR(parseFloat(amount) || 0)}
              </Text>
            </View>
            {amount && parseFloat(amount) > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summarySubLabel}>Balance After:</Text>
                <Text
                  style={[
                    styles.summarySubValue,
                    balanceAfterPayment > 0 && styles.summarySubDue,
                    balanceAfterPayment < 0 && styles.summarySubAdvance,
                  ]}
                >
                  {formatPKR(Math.abs(balanceAfterPayment))}
                </Text>
              </View>
            )}
          </View>
          <Button
            title={isLoading ? 'Processing...' : 'Collect Payment'}
            onPress={handleSubmit}
            disabled={isLoading || !amount}
            fullWidth
            size="lg"
            variant="secondary"
            icon={<Ionicons name="checkmark-circle" size={24} color={colors.text.inverse} />}
            style={styles.submitButton}
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
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
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
  headerTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontWeight: '700',
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.base,
    paddingBottom: spacing.xl,
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
  shopCard: {
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  shopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  shopIconContainer: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    ...shadows.sm,
  },
  shopInfo: {
    flex: 1,
  },
  shopName: {
    ...typography.h3,
    color: colors.text.primary,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  shopOwner: {
    ...typography.body,
    color: colors.text.secondary,
  },
  balanceSection: {
    flexDirection: 'row',
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  balanceItem: {
    flex: 1,
    alignItems: 'center',
  },
  balanceIconContainer: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  balanceDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
  },
  balanceLabel: {
    ...typography.caption,
    color: colors.text.muted,
    marginBottom: spacing.xs,
    fontSize: 11,
  },
  balanceValue: {
    ...typography.h4,
    color: colors.text.primary,
    fontWeight: '700',
    marginBottom: 2,
  },
  balanceDue: {
    color: colors.primary[500],
  },
  balanceAdvance: {
    color: colors.info,
  },
  balanceNote: {
    ...typography.caption,
    color: colors.text.muted,
    fontSize: 10,
  },
  billInfoSection: {
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.md,
  },
  billInfoTitle: {
    ...typography.bodyMedium,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  billInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  billInfoLabel: {
    ...typography.body,
    color: colors.text.secondary,
  },
  billInfoValue: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    fontWeight: '600',
  },
  previewSection: {
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewLabel: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  previewValue: {
    ...typography.h4,
    color: colors.text.primary,
    fontWeight: '700',
  },
  previewDue: {
    color: colors.primary[500],
  },
  previewAdvance: {
    color: colors.info,
  },
  previewZero: {
    color: colors.success,
  },
  advanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.info + '15',
    borderRadius: borderRadius.md,
  },
  advanceText: {
    ...typography.caption,
    color: colors.info,
    fontSize: 11,
  },
  inputCard: {
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  inputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  inputLabel: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    fontWeight: '600',
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.xl,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  amountContainerFocused: {
    borderColor: colors.primary[500],
    backgroundColor: colors.surface,
    ...shadows.sm,
  },
  amountContainerError: {
    borderColor: colors.error,
  },
  currencySymbol: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text.muted,
    marginRight: spacing.sm,
  },
  amountInput: {
    flex: 1,
    fontSize: 40,
    fontWeight: '800',
    color: colors.text.primary,
    paddingVertical: spacing.md,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.error + '15',
    borderRadius: borderRadius.md,
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
    flex: 1,
    fontWeight: '600',
  },
  quickAmountsContainer: {
    marginTop: spacing.lg,
  },
  quickAmountsLabel: {
    ...typography.caption,
    color: colors.text.muted,
    marginBottom: spacing.sm,
    fontSize: 11,
  },
  quickAmounts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  quickAmountButton: {
    flex: 1,
    minWidth: '22%',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    ...shadows.sm,
  },
  quickAmountButtonActive: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
    ...shadows.md,
  },
  quickAmountText: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
    fontWeight: '700',
    fontSize: 14,
  },
  quickAmountTextActive: {
    color: colors.text.inverse,
    fontWeight: '800',
    fontSize: 15,
  },
  notesSection: {
    marginTop: spacing.lg,
  },
  notesInput: {
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.md,
    ...typography.body,
    color: colors.text.primary,
    minHeight: 100,
    textAlignVertical: 'top',
    marginTop: spacing.sm,
  },
  transactionsSection: {
    marginTop: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    fontWeight: '600',
  },
  transactionsCard: {
    paddingVertical: spacing.sm,
  },
  transactionDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
    marginHorizontal: spacing.md,
  },
  footer: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...shadows.lg,
  },
  summaryCard: {
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  summaryLabel: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  summaryValue: {
    ...typography.h3,
    color: colors.secondary[600],
    fontWeight: '800',
  },
  summarySubLabel: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
  summarySubValue: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  summarySubDue: {
    color: colors.primary[500],
  },
  summarySubAdvance: {
    color: colors.info,
  },
  submitButton: {
    ...shadows.md,
  },
});

