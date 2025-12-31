import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useDailyReportStore } from '../../../../src/stores';
import { Button, Input, Card } from '../../../../src/components';
import { colors, typography, spacing, borderRadius, shadows } from '../../../../src/theme';

export default function ExpensesScreen() {
  const {
    currentReport,
    addExpense,
    updateExpense,
    removeExpense,
    updateTotals,
  } = useDailyReportStore();

  const [newExpenseDesc, setNewExpenseDesc] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');

  if (!currentReport) {
    router.replace('/(tabs)/reports/create');
    return null;
  }

  const handleAddExpense = () => {
    if (!newExpenseDesc.trim() || !newExpenseAmount) return;
    
    addExpense(newExpenseDesc.trim(), parseFloat(newExpenseAmount) || 0);
    setNewExpenseDesc('');
    setNewExpenseAmount('');
  };

  const handleFuelChange = (text: string) => {
    updateTotals({ fuel: parseFloat(text) || 0 });
  };

  const handleCutRateChange = (text: string) => {
    updateTotals({ cutRate: parseFloat(text) || 0 });
  };

  const handleNext = () => {
    router.push('/(tabs)/reports/create/cash');
  };

  const handleBack = () => {
    router.back();
  };

  const totalExpenses =
    currentReport.totals.fuel +
    currentReport.totals.cutRate +
    currentReport.expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionTitle}>Expenses & Deductions</Text>
        <Text style={styles.sectionDescription}>
          Enter fuel, cut rate, and other expenses
        </Text>

        {/* Fixed Expenses */}
        <Card variant="elevated" style={styles.fixedExpensesCard}>
          <Text style={styles.cardTitle}>Fixed Expenses</Text>
          
          <View style={styles.expenseRow}>
            <View style={styles.expenseLabel}>
              <Ionicons name="car-outline" size={20} color={colors.primary[500]} />
              <Text style={styles.expenseLabelText}>Fuel</Text>
            </View>
            <TextInput
              style={styles.expenseInput}
              value={currentReport.totals.fuel.toString()}
              onChangeText={handleFuelChange}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.text.muted}
            />
          </View>

          <View style={styles.expenseRow}>
            <View style={styles.expenseLabel}>
              <Ionicons name="cut-outline" size={20} color={colors.primary[500]} />
              <Text style={styles.expenseLabelText}>Cut Rate</Text>
            </View>
            <TextInput
              style={styles.expenseInput}
              value={currentReport.totals.cutRate.toString()}
              onChangeText={handleCutRateChange}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.text.muted}
            />
          </View>
        </Card>

        {/* Other Expenses */}
        <Card variant="elevated" style={styles.otherExpensesCard}>
          <Text style={styles.cardTitle}>Other Expenses</Text>

          {currentReport.expenses.map((expense, index) => (
            <View key={expense.id} style={styles.expenseItem}>
              <View style={styles.expenseItemInfo}>
                <Text style={styles.expenseItemNumber}>{index + 1}.</Text>
                <Text style={styles.expenseItemDesc}>{expense.description}</Text>
              </View>
              <Text style={styles.expenseItemAmount}>
                Rs. {expense.amount.toLocaleString()}
              </Text>
              <TouchableOpacity
                onPress={() => removeExpense(expense.id)}
                style={styles.removeButton}
              >
                <Ionicons name="close-circle" size={20} color={colors.error} />
              </TouchableOpacity>
            </View>
          ))}

          {/* Add New Expense */}
          <View style={styles.addExpenseRow}>
            <TextInput
              style={[styles.addExpenseInput, styles.addExpenseDesc]}
              value={newExpenseDesc}
              onChangeText={setNewExpenseDesc}
              placeholder="Description"
              placeholderTextColor={colors.text.muted}
            />
            <TextInput
              style={[styles.addExpenseInput, styles.addExpenseAmount]}
              value={newExpenseAmount}
              onChangeText={setNewExpenseAmount}
              placeholder="Amount"
              keyboardType="numeric"
              placeholderTextColor={colors.text.muted}
            />
            <TouchableOpacity
              style={styles.addButton}
              onPress={handleAddExpense}
              disabled={!newExpenseDesc.trim() || !newExpenseAmount}
            >
              <Ionicons
                name="add-circle"
                size={32}
                color={
                  newExpenseDesc.trim() && newExpenseAmount
                    ? colors.primary[500]
                    : colors.gray[300]
                }
              />
            </TouchableOpacity>
          </View>
        </Card>

        {/* Total */}
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total Expenses</Text>
          <Text style={styles.totalValue}>Rs. {totalExpenses.toLocaleString()}</Text>
        </View>
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
          title="Next: Cash Deposit"
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
  fixedExpensesCard: {
    padding: spacing.base,
    marginBottom: spacing.md,
  },
  otherExpensesCard: {
    padding: spacing.base,
    marginBottom: spacing.md,
  },
  cardTitle: {
    ...typography.h4,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  expenseLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  expenseLabelText: {
    ...typography.body,
    color: colors.text.primary,
  },
  expenseInput: {
    width: 120,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    textAlign: 'right',
    ...typography.body,
    color: colors.text.primary,
  },
  expenseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  expenseItemInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  expenseItemNumber: {
    ...typography.caption,
    color: colors.text.muted,
    marginRight: spacing.sm,
  },
  expenseItemDesc: {
    ...typography.body,
    color: colors.text.primary,
  },
  expenseItemAmount: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    marginRight: spacing.sm,
  },
  removeButton: {
    padding: spacing.xs,
  },
  addExpenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  addExpenseInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    ...typography.body,
    color: colors.text.primary,
  },
  addExpenseDesc: {
    flex: 1,
  },
  addExpenseAmount: {
    width: 80,
    textAlign: 'right',
  },
  addButton: {
    padding: spacing.xs,
  },
  totalCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.lg,
    padding: spacing.base,
  },
  totalLabel: {
    ...typography.h4,
    color: colors.text.inverse,
  },
  totalValue: {
    ...typography.h3,
    color: colors.text.inverse,
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

