import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useDailyReportStore } from '../../../src/stores';
import { Card, Badge, LoadingSpinner, Button } from '../../../src/components';
import { colors, typography, spacing, borderRadius, shadows } from '../../../src/theme';
import { DailyReport } from '../../../src/types';

export default function ReportDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getReportById, setCurrentReport } = useDailyReportStore();
  const [report, setReport] = useState<DailyReport | null>(null);

  useEffect(() => {
    if (id) {
      const foundReport = getReportById(id);
      if (foundReport) {
        setReport(foundReport);
      }
    }
  }, [id]);

  if (!report) {
    return <LoadingSpinner />;
  }

  const handleEditDraft = () => {
    setCurrentReport(report);
    router.push('/(tabs)/reports/create');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return colors.warning;
      case 'submitted':
        return colors.success;
      default:
        return colors.gray[500];
    }
  };

  const totalExpenses =
    report.totals.fuel +
    report.totals.cutRate +
    report.totals.expenses;
  const expectedCash = report.totals.totalSale - totalExpenses - report.totals.credit;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.reportNumber}>{report.reportNumber}</Text>
            <Text style={styles.reportDate}>
              {new Date(report.date).toLocaleDateString('en-PK', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
          </View>
          <Badge
            label={report.status.charAt(0).toUpperCase() + report.status.slice(1)}
            color={getStatusColor(report.status)}
          />
        </View>

        {/* Info Card */}
        <Card variant="elevated" style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="navigate-outline" size={18} color={colors.text.muted} />
            <Text style={styles.infoLabel}>Route:</Text>
            <Text style={styles.infoValue}>{report.routeName || 'Not specified'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={18} color={colors.text.muted} />
            <Text style={styles.infoLabel}>Booker:</Text>
            <Text style={styles.infoValue}>{report.bookerName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="people-outline" size={18} color={colors.text.muted} />
            <Text style={styles.infoLabel}>Salesman:</Text>
            <Text style={styles.infoValue}>{report.salesmanName || 'Not specified'}</Text>
          </View>
        </Card>

        {/* Summary Cards */}
        <View style={styles.summaryGrid}>
          <Card variant="elevated" style={styles.summaryGridCard}>
            <Ionicons name="cart" size={24} color={colors.primary[500]} />
            <Text style={styles.summaryGridValue}>
              Rs. {report.totals.totalSale.toLocaleString()}
            </Text>
            <Text style={styles.summaryGridLabel}>Total Sale</Text>
          </Card>
          <Card variant="elevated" style={styles.summaryGridCard}>
            <Ionicons name="wallet" size={24} color={colors.error} />
            <Text style={styles.summaryGridValue}>
              Rs. {totalExpenses.toLocaleString()}
            </Text>
            <Text style={styles.summaryGridLabel}>Expenses</Text>
          </Card>
          <Card variant="elevated" style={styles.summaryGridCard}>
            <Ionicons name="time" size={24} color={colors.warning} />
            <Text style={styles.summaryGridValue}>
              Rs. {report.totals.credit.toLocaleString()}
            </Text>
            <Text style={styles.summaryGridLabel}>Credit</Text>
          </Card>
          <Card variant="elevated" style={styles.summaryGridCard}>
            <Ionicons name="cash" size={24} color={colors.success} />
            <Text style={styles.summaryGridValue}>
              Rs. {report.cashDeposit.total.toLocaleString()}
            </Text>
            <Text style={styles.summaryGridLabel}>Cash Deposit</Text>
          </Card>
        </View>

        {/* Product Sales */}
        <Card variant="elevated" style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Product Sales</Text>
          {report.productSales
            .filter((s) => s.quantity > 0)
            .map((sale, index) => (
              <View key={sale.productId} style={styles.productRow}>
                <Text style={styles.productIndex}>{index + 1}.</Text>
                <View style={styles.productInfo}>
                  <Text style={styles.productName}>{sale.productName}</Text>
                  <Text style={styles.productUnit}>{sale.unit}</Text>
                </View>
                <Text style={styles.productQty}>x{sale.quantity}</Text>
                <Text style={styles.productAmount}>
                  Rs. {sale.amount.toLocaleString()}
                </Text>
              </View>
            ))}
          {report.productSales.filter((s) => s.quantity > 0).length === 0 && (
            <Text style={styles.emptyText}>No products recorded</Text>
          )}
        </Card>

        {/* Shop Records */}
        <Card variant="elevated" style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Shop Records</Text>
          {report.shopkeeperRecords.map((record, index) => (
            <View key={record.id} style={styles.shopRow}>
              <Text style={styles.shopIndex}>{index + 1}.</Text>
              <Text style={styles.shopName}>{record.shopName}</Text>
              <View style={styles.shopAmounts}>
                <Text style={styles.shopCredit}>
                  Cr: Rs. {record.credit.toLocaleString()}
                </Text>
                <Text style={styles.shopCash}>
                  Cash: Rs. {record.cashReceived.toLocaleString()}
                </Text>
              </View>
            </View>
          ))}
          {report.shopkeeperRecords.length === 0 && (
            <Text style={styles.emptyText}>No shop records</Text>
          )}
        </Card>

        {/* Expenses */}
        <Card variant="elevated" style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Expenses</Text>
          <View style={styles.expenseRow}>
            <Text style={styles.expenseLabel}>Fuel</Text>
            <Text style={styles.expenseValue}>
              Rs. {report.totals.fuel.toLocaleString()}
            </Text>
          </View>
          <View style={styles.expenseRow}>
            <Text style={styles.expenseLabel}>Cut Rate</Text>
            <Text style={styles.expenseValue}>
              Rs. {report.totals.cutRate.toLocaleString()}
            </Text>
          </View>
          {report.expenses.map((expense) => (
            <View key={expense.id} style={styles.expenseRow}>
              <Text style={styles.expenseLabel}>{expense.description}</Text>
              <Text style={styles.expenseValue}>
                Rs. {expense.amount.toLocaleString()}
              </Text>
            </View>
          ))}
        </Card>

        {/* Cash Deposit */}
        <Card variant="elevated" style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Cash Deposit</Text>
          {report.cashDeposit.note5000 > 0 && (
            <View style={styles.cashRow}>
              <Text style={styles.cashDenom}>5000 x {report.cashDeposit.note5000}</Text>
              <Text style={styles.cashAmount}>
                Rs. {(5000 * report.cashDeposit.note5000).toLocaleString()}
              </Text>
            </View>
          )}
          {report.cashDeposit.note1000 > 0 && (
            <View style={styles.cashRow}>
              <Text style={styles.cashDenom}>1000 x {report.cashDeposit.note1000}</Text>
              <Text style={styles.cashAmount}>
                Rs. {(1000 * report.cashDeposit.note1000).toLocaleString()}
              </Text>
            </View>
          )}
          {report.cashDeposit.note500 > 0 && (
            <View style={styles.cashRow}>
              <Text style={styles.cashDenom}>500 x {report.cashDeposit.note500}</Text>
              <Text style={styles.cashAmount}>
                Rs. {(500 * report.cashDeposit.note500).toLocaleString()}
              </Text>
            </View>
          )}
          {report.cashDeposit.note100 > 0 && (
            <View style={styles.cashRow}>
              <Text style={styles.cashDenom}>100 x {report.cashDeposit.note100}</Text>
              <Text style={styles.cashAmount}>
                Rs. {(100 * report.cashDeposit.note100).toLocaleString()}
              </Text>
            </View>
          )}
          {report.cashDeposit.note50 > 0 && (
            <View style={styles.cashRow}>
              <Text style={styles.cashDenom}>50 x {report.cashDeposit.note50}</Text>
              <Text style={styles.cashAmount}>
                Rs. {(50 * report.cashDeposit.note50).toLocaleString()}
              </Text>
            </View>
          )}
          {report.cashDeposit.note20 > 0 && (
            <View style={styles.cashRow}>
              <Text style={styles.cashDenom}>20 x {report.cashDeposit.note20}</Text>
              <Text style={styles.cashAmount}>
                Rs. {(20 * report.cashDeposit.note20).toLocaleString()}
              </Text>
            </View>
          )}
          {report.cashDeposit.note10 > 0 && (
            <View style={styles.cashRow}>
              <Text style={styles.cashDenom}>10 x {report.cashDeposit.note10}</Text>
              <Text style={styles.cashAmount}>
                Rs. {(10 * report.cashDeposit.note10).toLocaleString()}
              </Text>
            </View>
          )}
          {report.cashDeposit.coins > 0 && (
            <View style={styles.cashRow}>
              <Text style={styles.cashDenom}>Coins</Text>
              <Text style={styles.cashAmount}>
                Rs. {report.cashDeposit.coins.toLocaleString()}
              </Text>
            </View>
          )}
          <View style={[styles.cashRow, styles.cashTotal]}>
            <Text style={styles.cashTotalLabel}>Total</Text>
            <Text style={styles.cashTotalAmount}>
              Rs. {report.cashDeposit.total.toLocaleString()}
            </Text>
          </View>
        </Card>

        {/* Edit Button for Drafts */}
        {report.status === 'draft' && (
          <Button
            title="Continue Editing"
            onPress={handleEditDraft}
            fullWidth
            style={styles.editButton}
            icon="create-outline"
          />
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
    paddingBottom: spacing['2xl'],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  reportNumber: {
    ...typography.h3,
    color: colors.text.primary,
  },
  reportDate: {
    ...typography.body,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
  infoCard: {
    padding: spacing.base,
    marginBottom: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  infoLabel: {
    ...typography.body,
    color: colors.text.muted,
  },
  infoValue: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    flex: 1,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  summaryGridCard: {
    flex: 1,
    minWidth: '45%',
    padding: spacing.md,
    alignItems: 'center',
  },
  summaryGridValue: {
    ...typography.h4,
    color: colors.text.primary,
    marginTop: spacing.sm,
  },
  summaryGridLabel: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
  sectionCard: {
    padding: spacing.base,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text.primary,
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  productIndex: {
    ...typography.caption,
    color: colors.text.muted,
    width: 24,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    ...typography.body,
    color: colors.text.primary,
  },
  productUnit: {
    ...typography.caption,
    color: colors.text.muted,
  },
  productQty: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
    marginRight: spacing.md,
  },
  productAmount: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    minWidth: 80,
    textAlign: 'right',
  },
  shopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  shopIndex: {
    ...typography.caption,
    color: colors.text.muted,
    width: 24,
  },
  shopName: {
    flex: 1,
    ...typography.body,
    color: colors.text.primary,
  },
  shopAmounts: {
    alignItems: 'flex-end',
  },
  shopCredit: {
    ...typography.caption,
    color: colors.warning,
  },
  shopCash: {
    ...typography.caption,
    color: colors.success,
  },
  expenseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  expenseLabel: {
    ...typography.body,
    color: colors.text.secondary,
  },
  expenseValue: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  cashRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  cashDenom: {
    ...typography.body,
    color: colors.text.secondary,
  },
  cashAmount: {
    ...typography.body,
    color: colors.text.primary,
  },
  cashTotal: {
    borderBottomWidth: 0,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 2,
    borderTopColor: colors.primary[500],
  },
  cashTotalLabel: {
    ...typography.h4,
    color: colors.primary[500],
  },
  cashTotalAmount: {
    ...typography.h4,
    color: colors.primary[500],
  },
  emptyText: {
    ...typography.body,
    color: colors.text.muted,
    textAlign: 'center',
    padding: spacing.md,
  },
  editButton: {
    marginTop: spacing.md,
  },
});

