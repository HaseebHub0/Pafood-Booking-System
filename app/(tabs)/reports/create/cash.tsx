import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDailyReportStore } from '../../../../src/stores';
import { Button, CashCounter } from '../../../../src/components';
import { colors, typography, spacing, borderRadius, shadows } from '../../../../src/theme';

export default function CashDepositScreen() {
  const { currentReport, updateCashDeposit } = useDailyReportStore();

  if (!currentReport) {
    router.replace('/(tabs)/reports/create');
    return null;
  }

  const handleNext = () => {
    router.push('/(tabs)/reports/create/summary');
  };

  const handleBack = () => {
    router.back();
  };

  // Calculate expected cash
  const totalSale = currentReport.totals.totalSale;
  const totalExpenses =
    currentReport.totals.fuel +
    currentReport.totals.cutRate +
    currentReport.expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalCredit = currentReport.shopkeeperRecords.reduce(
    (sum, r) => sum + r.credit,
    0
  );
  const expectedCash = totalSale - totalExpenses - totalCredit;
  const depositedCash = currentReport.cashDeposit.total;
  const difference = depositedCash - expectedCash;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionTitle}>Cash Deposit</Text>
        <Text style={styles.sectionDescription}>
          Count and enter the currency notes and coins
        </Text>

        {/* Expected vs Deposited */}
        <View style={styles.comparisonCard}>
          <View style={styles.comparisonRow}>
            <View style={styles.comparisonItem}>
              <Text style={styles.comparisonLabel}>Expected Cash</Text>
              <Text style={styles.comparisonValue}>
                Rs. {expectedCash.toLocaleString()}
              </Text>
            </View>
            <View style={styles.comparisonItem}>
              <Text style={styles.comparisonLabel}>Deposited Cash</Text>
              <Text style={styles.comparisonValue}>
                Rs. {depositedCash.toLocaleString()}
              </Text>
            </View>
          </View>
          <View style={styles.differenceRow}>
            <Text style={styles.differenceLabel}>Difference</Text>
            <Text
              style={[
                styles.differenceValue,
                difference > 0 && styles.differencePositive,
                difference < 0 && styles.differenceNegative,
              ]}
            >
              {difference >= 0 ? '+' : ''}Rs. {difference.toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Cash Counter */}
        <CashCounter
          cashDeposit={currentReport.cashDeposit}
          onUpdate={updateCashDeposit}
        />
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Button
          title="Back"
          onPress={handleBack}
          variant="outline"
          style={styles.backButton}
        />
        <Button
          title="Next: Summary"
          onPress={handleNext}
          style={styles.nextButton}
          icon="arrow-forward"
          iconPosition="right"
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
  comparisonCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  comparisonRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  comparisonItem: {
    flex: 1,
    alignItems: 'center',
  },
  comparisonLabel: {
    ...typography.caption,
    color: colors.text.muted,
    marginBottom: spacing.xs,
  },
  comparisonValue: {
    ...typography.h4,
    color: colors.text.primary,
  },
  differenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  differenceLabel: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
  },
  differenceValue: {
    ...typography.h4,
    color: colors.text.primary,
  },
  differencePositive: {
    color: colors.success,
  },
  differenceNegative: {
    color: colors.error,
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
  backButton: {
    flex: 1,
  },
  nextButton: {
    flex: 2,
  },
});

