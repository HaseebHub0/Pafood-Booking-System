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
import { Button, ShopRecordRow, AddShopRecordButton, Card } from '../../../../src/components';
import { colors, typography, spacing, borderRadius, shadows } from '../../../../src/theme';

export default function ShopRecordsScreen() {
  const {
    currentReport,
    addShopkeeperRecord,
    updateShopkeeperRecord,
    removeShopkeeperRecord,
  } = useDailyReportStore();

  if (!currentReport) {
    router.replace('/(tabs)/reports/create');
    return null;
  }

  const totalCredit = currentReport.shopkeeperRecords.reduce(
    (sum, r) => sum + r.credit,
    0
  );
  const totalCash = currentReport.shopkeeperRecords.reduce(
    (sum, r) => sum + r.cashReceived,
    0
  );

  const handleNext = () => {
    router.push('/(tabs)/reports/create/expenses');
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
        <Text style={styles.sectionTitle}>Shopkeeper Records</Text>
        <Text style={styles.sectionDescription}>
          Enter credit and cash received from each shopkeeper
        </Text>

        {/* Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>
              {currentReport.shopkeeperRecords.length}
            </Text>
            <Text style={styles.summaryLabel}>Shops</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: colors.warning }]}>
              Rs. {totalCredit.toLocaleString()}
            </Text>
            <Text style={styles.summaryLabel}>Total Credit</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: colors.success }]}>
              Rs. {totalCash.toLocaleString()}
            </Text>
            <Text style={styles.summaryLabel}>Cash Received</Text>
          </View>
        </View>

        {/* Shop Records */}
        {currentReport.shopkeeperRecords.map((record, index) => (
          <ShopRecordRow
            key={record.id}
            record={record}
            index={index}
            onUpdate={updateShopkeeperRecord}
            onRemove={removeShopkeeperRecord}
          />
        ))}

        {/* Add Button */}
        <AddShopRecordButton onAdd={addShopkeeperRecord} />
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
          title="Next: Expenses"
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
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    ...typography.h4,
    color: colors.primary[500],
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.text.muted,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.sm,
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

