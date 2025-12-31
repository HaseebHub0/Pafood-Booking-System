import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useDailyReportStore } from '../../../../src/stores';
import { Button, Card } from '../../../../src/components';
import { colors, typography, spacing, borderRadius, shadows } from '../../../../src/theme';

export default function ReportSummaryScreen() {
  const { currentReport, submitReport, saveDraft, calculateTotals } = useDailyReportStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  if (!currentReport) {
    router.replace('/(tabs)/reports/create');
    return null;
  }

  const totals = calculateTotals();
  const itemsWithQuantity = currentReport.productSales.filter(
    (s) => s.quantity > 0
  ).length;
  const totalExpenses =
    totals.fuel + totals.cutRate + totals.expenses;
  const expectedCash = totals.totalSale - totalExpenses - totals.credit;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const result = await submitReport();
    setIsSubmitting(false);

    if (result.success) {
      Alert.alert('Success', result.message, [
        { text: 'OK', onPress: () => router.replace('/(tabs)/reports') },
      ]);
    } else {
      Alert.alert('Error', result.message);
    }
  };

  const handleSaveDraft = async () => {
    setIsSaving(true);
    await saveDraft();
    setIsSaving(false);
    Alert.alert('Success', 'Report saved as draft', [
      { text: 'OK', onPress: () => router.replace('/(tabs)/reports') },
    ]);
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Report Summary</Text>
        <Text style={styles.sectionDescription}>
          Review all details before submitting
        </Text>

        {/* Header Info */}
        <Card variant="elevated" style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Report #</Text>
            <Text style={styles.infoValue}>{currentReport.reportNumber}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Date</Text>
            <Text style={styles.infoValue}>{currentReport.date}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Route</Text>
            <Text style={styles.infoValue}>
              {currentReport.routeName || 'Not specified'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Booker</Text>
            <Text style={styles.infoValue}>{currentReport.bookerName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Salesman</Text>
            <Text style={styles.infoValue}>
              {currentReport.salesmanName || 'Not specified'}
            </Text>
          </View>
        </Card>

        {/* Sales Summary */}
        <Card variant="elevated" style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Ionicons name="cart-outline" size={20} color={colors.primary[500]} />
            <Text style={styles.summaryTitle}>Sales Summary</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Products Sold</Text>
            <Text style={styles.summaryValue}>{itemsWithQuantity} items</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Sale</Text>
            <Text style={[styles.summaryValue, styles.summaryValuePrimary]}>
              Rs. {totals.totalSale.toLocaleString()}
            </Text>
          </View>
        </Card>

        {/* Shop Records */}
        <Card variant="elevated" style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Ionicons name="storefront-outline" size={20} color={colors.primary[500]} />
            <Text style={styles.summaryTitle}>Shop Records</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Shops Visited</Text>
            <Text style={styles.summaryValue}>
              {currentReport.shopkeeperRecords.length}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Credit</Text>
            <Text style={[styles.summaryValue, { color: colors.warning }]}>
              Rs. {totals.credit.toLocaleString()}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Cash Received</Text>
            <Text style={[styles.summaryValue, { color: colors.success }]}>
              Rs. {totals.cashReceived.toLocaleString()}
            </Text>
          </View>
        </Card>

        {/* Expenses */}
        <Card variant="elevated" style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Ionicons name="wallet-outline" size={20} color={colors.primary[500]} />
            <Text style={styles.summaryTitle}>Expenses</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Fuel</Text>
            <Text style={styles.summaryValue}>
              Rs. {totals.fuel.toLocaleString()}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Cut Rate</Text>
            <Text style={styles.summaryValue}>
              Rs. {totals.cutRate.toLocaleString()}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Other Expenses</Text>
            <Text style={styles.summaryValue}>
              Rs. {totals.expenses.toLocaleString()}
            </Text>
          </View>
          <View style={[styles.summaryRow, styles.summaryRowTotal]}>
            <Text style={styles.summaryLabelBold}>Total Expenses</Text>
            <Text style={[styles.summaryValue, { color: colors.error }]}>
              Rs. {totalExpenses.toLocaleString()}
            </Text>
          </View>
        </Card>

        {/* Cash Summary */}
        <Card variant="elevated" style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Ionicons name="cash-outline" size={20} color={colors.primary[500]} />
            <Text style={styles.summaryTitle}>Cash Summary</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Expected Cash</Text>
            <Text style={styles.summaryValue}>
              Rs. {expectedCash.toLocaleString()}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Deposited Cash</Text>
            <Text style={styles.summaryValue}>
              Rs. {currentReport.cashDeposit.total.toLocaleString()}
            </Text>
          </View>
          <View style={[styles.summaryRow, styles.summaryRowTotal]}>
            <Text style={styles.summaryLabelBold}>Difference</Text>
            <Text
              style={[
                styles.summaryValue,
                currentReport.cashDeposit.total - expectedCash >= 0
                  ? { color: colors.success }
                  : { color: colors.error },
              ]}
            >
              Rs. {(currentReport.cashDeposit.total - expectedCash).toLocaleString()}
            </Text>
          </View>
        </Card>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Button
          title="Save Draft"
          onPress={handleSaveDraft}
          variant="outline"
          loading={isSaving}
          style={styles.draftButton}
        />
        <Button
          title="Submit Report"
          onPress={handleSubmit}
          loading={isSubmitting}
          style={styles.submitButton}
          icon="checkmark-circle"
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
  sectionTitle: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  sectionDescription: {
    ...typography.body,
    color: colors.text.muted,
    marginBottom: spacing.lg,
  },
  infoCard: {
    padding: spacing.base,
    marginBottom: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  infoLabel: {
    ...typography.body,
    color: colors.text.muted,
  },
  infoValue: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  summaryCard: {
    padding: spacing.base,
    marginBottom: spacing.md,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryTitle: {
    ...typography.h4,
    color: colors.text.primary,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  summaryRowTotal: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  summaryLabel: {
    ...typography.body,
    color: colors.text.secondary,
  },
  summaryLabelBold: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  summaryValue: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  summaryValuePrimary: {
    color: colors.primary[500],
  },
  footer: {
    flexDirection: 'row',
    padding: spacing.base,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  draftButton: {
    flex: 1,
  },
  submitButton: {
    flex: 2,
  },
});

