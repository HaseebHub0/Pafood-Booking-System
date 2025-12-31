import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useDeliveryStore,
  useLedgerStore,
  useReturnStore,
  useAuthStore,
} from '../../../src/stores';
import { Button, Card, LoadingSpinner } from '../../../src/components';
import { colors, typography, spacing, borderRadius, shadows } from '../../../src/theme';

export default function SalesmanReportsScreen() {
  const { deliveries, loadDeliveries, calculateDeliveryStats } = useDeliveryStore();
  const { transactions, loadTransactions } = useLedgerStore();
  const { returns, loadReturns } = useReturnStore();
  const { user } = useAuthStore();
  
  const [refreshing, setRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    loadDeliveries();
    loadTransactions();
    loadReturns();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadDeliveries(), loadTransactions(), loadReturns()]);
    setRefreshing(false);
  };

  // Only show for salesman
  if (user?.role !== 'salesman') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.notAuthorized}>
          <Ionicons name="lock-closed" size={64} color={colors.gray[300]} />
          <Text style={styles.notAuthorizedText}>
            Salesman reports are only available for Salesman
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Helper to get date from timestamp (handles Firestore timestamps and ISO strings)
  const getDateString = (timestamp: any): string => {
    if (!timestamp) return '';
    if (timestamp.toDate) {
      // Firestore timestamp
      return timestamp.toDate().toISOString().split('T')[0];
    }
    if (typeof timestamp === 'string') {
      return timestamp.split('T')[0];
    }
    if (timestamp instanceof Date) {
      return timestamp.toISOString().split('T')[0];
    }
    return '';
  };

  // Filter data for selected date
  const selectedDateObj = new Date(selectedDate);
  selectedDateObj.setHours(0, 0, 0, 0);
  const selectedDateEnd = new Date(selectedDateObj);
  selectedDateEnd.setHours(23, 59, 59, 999);

  // Filter deliveries - only delivered ones with payment collected
  const todayDeliveries = deliveries.filter((d) => {
    if (d.status !== 'delivered' || !d.paymentCollected) return false;
    const deliveryDate = d.paymentCollectedAt || d.deliveredAt || d.createdAt;
    const dateStr = getDateString(deliveryDate);
    return dateStr === selectedDate;
  });

  // Filter payments - use PAYMENT type (uppercase) and check date
  const todayPayments = transactions.filter((t) => {
    if (t.type !== 'PAYMENT') return false;
    const dateStr = getDateString(t.date || t.createdAt);
    return dateStr === selectedDate;
  });

  // Filter returns - only collected ones
  const todayReturns = returns.filter((r) => {
    if (!r.collectedAt) return false;
    const dateStr = getDateString(r.collectedAt);
    return dateStr === selectedDate;
  });

  // Calculate totals
  const totalDeliveries = todayDeliveries.length;
  
  // Calculate cash collected from payments and delivered orders
  const cashFromPayments = todayPayments.reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);
  const cashFromDeliveries = todayDeliveries
    .filter((d) => d.paymentMode === 'cash' || d.paymentMode === 'partial')
    .reduce((sum, d) => sum + (d.paymentAmount || 0), 0);
  const totalCashCollected = cashFromPayments + cashFromDeliveries;
  
  // Calculate credit issued (from deliveries with credit payment)
  const creditDeliveries = todayDeliveries.filter(
    (d) => d.paymentMode === 'credit' || d.paymentMode === 'partial'
  );
  const totalCreditIssued = creditDeliveries.reduce((sum, d) => {
    if (d.paymentMode === 'credit') {
      return sum + (d.totalAmount || 0);
    } else if (d.paymentMode === 'partial') {
      // Credit portion is total - cash paid
      return sum + ((d.totalAmount || 0) - (d.paymentAmount || 0));
    }
    return sum;
  }, 0);
  
  // Calculate remaining credit (credit issued - payments collected for credit)
  const creditPayments = todayPayments.filter((t) => {
    // Payments that reduce credit balance
    return t.amount < 0 || (t.description || '').toLowerCase().includes('credit');
  });
  const creditPaid = creditPayments.reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);
  const totalCreditRemaining = totalCreditIssued - creditPaid;

  const totalReturnValue = todayReturns.reduce((sum, r) => sum + (r.totalValue || 0), 0);
  const totalReturnItems = todayReturns.reduce((sum, r) => sum + (r.items?.length || 0), 0);

  const handleSubmitToAccounts = async () => {
    Alert.alert(
      'Submit Daily Summary',
      `Submit today's summary to Accounts?\n\nCash Collected: Rs. ${totalCashCollected.toLocaleString()}\nCredit Remaining: Rs. ${totalCreditRemaining.toLocaleString()}\nReturns: ${totalReturnItems} items`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async () => {
            setIsSubmitting(true);
            // Simulate API call
            await new Promise((resolve) => setTimeout(resolve, 1500));
            setIsSubmitting(false);
            Alert.alert(
              'Success',
              'Daily summary submitted to Accounts successfully!',
              [{ text: 'OK' }]
            );
          },
        },
      ]
    );
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
          <Text style={styles.title}>Daily Summary</Text>
          <Text style={styles.subtitle}>
            {new Date(selectedDate).toLocaleDateString('en-PK', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </Text>
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryGrid}>
          <Card style={[styles.summaryCard, { backgroundColor: colors.primary[500] }]}>
            <Ionicons name="cube" size={24} color={colors.text.inverse} />
            <Text style={styles.summaryValue}>{totalDeliveries}</Text>
            <Text style={styles.summaryLabel}>Deliveries</Text>
          </Card>

          <Card style={[styles.summaryCard, { backgroundColor: colors.success }]}>
            <Ionicons name="cash" size={24} color={colors.text.inverse} />
            <Text style={styles.summaryValue}>Rs. {totalCashCollected.toLocaleString()}</Text>
            <Text style={styles.summaryLabel}>Cash Collected</Text>
          </Card>

          <Card style={[styles.summaryCard, { backgroundColor: colors.info }]}>
            <Ionicons name="card" size={24} color={colors.text.inverse} />
            <Text style={styles.summaryValue}>Rs. {totalCreditIssued.toLocaleString()}</Text>
            <Text style={styles.summaryLabel}>Credit Issued</Text>
          </Card>

          <Card style={[styles.summaryCard, { backgroundColor: colors.warning }]}>
            <Ionicons name="return-down-back" size={24} color={colors.text.inverse} />
            <Text style={styles.summaryValue}>{totalReturnItems}</Text>
            <Text style={styles.summaryLabel}>Returns</Text>
          </Card>
        </View>

        {/* Detailed Breakdown */}
        <Text style={styles.sectionTitle}>Detailed Breakdown</Text>

        {/* Cash Collection */}
        <Card style={styles.detailCard}>
          <View style={styles.detailHeader}>
            <Ionicons name="cash" size={20} color={colors.success} />
            <Text style={styles.detailTitle}>Cash Collection</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Total Cash Collected:</Text>
            <Text style={styles.detailValue}>Rs. {totalCashCollected.toLocaleString()}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Payment Transactions:</Text>
            <Text style={styles.detailValue}>{todayPayments.length}</Text>
          </View>
        </Card>

        {/* Credit Summary */}
        <Card style={styles.detailCard}>
          <View style={styles.detailHeader}>
            <Ionicons name="card" size={20} color={colors.info} />
            <Text style={styles.detailTitle}>Credit Summary</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Credit Issued Today:</Text>
            <Text style={styles.detailValue}>Rs. {totalCreditIssued.toLocaleString()}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Credit Remaining:</Text>
            <Text style={[styles.detailValue, { color: colors.warning }]}>
              Rs. {totalCreditRemaining.toLocaleString()}
            </Text>
          </View>
        </Card>

        {/* Returns Summary */}
        <Card style={styles.detailCard}>
          <View style={styles.detailHeader}>
            <Ionicons name="return-down-back" size={20} color={colors.warning} />
            <Text style={styles.detailTitle}>Stock Returns</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Total Returns:</Text>
            <Text style={styles.detailValue}>{totalReturnItems} items</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Return Value:</Text>
            <Text style={styles.detailValue}>Rs. {totalReturnValue.toLocaleString()}</Text>
          </View>
          {todayReturns.length > 0 && (
            <TouchableOpacity
              style={styles.viewButton}
              onPress={() => router.push('/(tabs)/returns')}
            >
              <Text style={styles.viewButtonText}>View All Returns</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.primary[500]} />
            </TouchableOpacity>
          )}
        </Card>

        {/* Deliveries Summary */}
        <Card style={styles.detailCard}>
          <View style={styles.detailHeader}>
            <Ionicons name="cube" size={20} color={colors.primary[500]} />
            <Text style={styles.detailTitle}>Deliveries</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Delivered:</Text>
            <Text style={styles.detailValue}>{totalDeliveries}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Pending:</Text>
            <Text style={styles.detailValue}>
              {todayDeliveries.filter((d) => d.status !== 'delivered' && d.status !== 'failed').length}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.viewButton}
            onPress={() => router.push('/(tabs)/deliveries')}
          >
            <Text style={styles.viewButtonText}>View All Deliveries</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.primary[500]} />
          </TouchableOpacity>
        </Card>
      </ScrollView>

      {/* Submit Button */}
      <View style={styles.footer}>
        <Button
          title={isSubmitting ? 'Submitting...' : 'Submit to Accounts'}
          onPress={handleSubmitToAccounts}
          loading={isSubmitting}
          disabled={isSubmitting}
          fullWidth
          size="lg"
          icon={<Ionicons name="send" size={20} color={colors.text.inverse} />}
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.base,
    paddingBottom: spacing['2xl'],
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
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.body,
    color: colors.text.muted,
    marginTop: 2,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  summaryCard: {
    flex: 1,
    minWidth: '45%',
    padding: spacing.md,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.inverse,
    marginTop: spacing.sm,
  },
  summaryLabel: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
    textAlign: 'center',
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text.primary,
    marginBottom: spacing.md,
    marginTop: spacing.lg,
  },
  detailCard: {
    marginBottom: spacing.md,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  detailTitle: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  detailLabel: {
    ...typography.body,
    color: colors.text.secondary,
  },
  detailValue: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  viewButtonText: {
    ...typography.bodyMedium,
    color: colors.primary[500],
  },
  footer: {
    padding: spacing.base,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});

