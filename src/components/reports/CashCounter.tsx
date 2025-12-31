import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CashDeposit, calculateCashDepositTotal } from '../../types';
import { colors, typography, spacing, borderRadius, shadows } from '../../theme';

interface DenominationRowProps {
  label: string;
  value: number;
  denomination: number;
  count: number;
  onCountChange: (count: number) => void;
}

const DenominationRow: React.FC<DenominationRowProps> = ({
  label,
  value,
  denomination,
  count,
  onCountChange,
}) => {
  const handleIncrement = () => onCountChange(count + 1);
  const handleDecrement = () => onCountChange(Math.max(0, count - 1));
  const handleChange = (text: string) => {
    const num = parseInt(text, 10);
    onCountChange(isNaN(num) ? 0 : Math.max(0, num));
  };

  return (
    <View style={styles.denominationRow}>
      <View style={styles.denominationLabel}>
        <Text style={styles.denominationText}>{label}</Text>
        {denomination > 0 && (
          <Text style={styles.denominationValue}>Rs. {denomination}</Text>
        )}
      </View>
      
      <View style={styles.counterContainer}>
        <TouchableOpacity
          style={styles.counterButton}
          onPress={handleDecrement}
          activeOpacity={0.7}
        >
          <Ionicons name="remove" size={18} color={colors.primary[500]} />
        </TouchableOpacity>
        
        <TextInput
          style={styles.countInput}
          value={count.toString()}
          onChangeText={handleChange}
          keyboardType="numeric"
          selectTextOnFocus
        />
        
        <TouchableOpacity
          style={styles.counterButton}
          onPress={handleIncrement}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={18} color={colors.primary[500]} />
        </TouchableOpacity>
      </View>
      
      <View style={styles.amountContainer}>
        <Text style={styles.amountText}>
          Rs. {(denomination > 0 ? count * denomination : count).toLocaleString()}
        </Text>
      </View>
    </View>
  );
};

interface CashCounterProps {
  cashDeposit: CashDeposit;
  onUpdate: (denomination: keyof CashDeposit, count: number) => void;
}

export const CashCounter: React.FC<CashCounterProps> = ({
  cashDeposit,
  onUpdate,
}) => {
  const denominations: {
    key: keyof CashDeposit;
    label: string;
    value: number;
  }[] = [
    { key: 'note5000', label: '5000', value: 5000 },
    { key: 'note1000', label: '1000', value: 1000 },
    { key: 'note500', label: '500', value: 500 },
    { key: 'note100', label: '100', value: 100 },
    { key: 'note50', label: '50', value: 50 },
    { key: 'note20', label: '20', value: 20 },
    { key: 'note10', label: '10', value: 10 },
    { key: 'coins', label: 'Coins', value: 0 },
  ];

  const total = calculateCashDepositTotal(cashDeposit);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="cash-outline" size={24} color={colors.primary[500]} />
        <Text style={styles.headerText}>Cash Deposit Slip</Text>
      </View>

      <View style={styles.tableHeader}>
        <Text style={styles.tableHeaderText}>Note</Text>
        <Text style={styles.tableHeaderText}>Count</Text>
        <Text style={styles.tableHeaderTextRight}>Amount</Text>
      </View>

      {denominations.map((denom) => (
        <DenominationRow
          key={denom.key}
          label={denom.label}
          value={cashDeposit[denom.key]}
          denomination={denom.value}
          count={cashDeposit[denom.key]}
          onCountChange={(count) => onUpdate(denom.key, count)}
        />
      ))}

      <View style={styles.totalContainer}>
        <Text style={styles.totalLabel}>TOTAL</Text>
        <Text style={styles.totalAmount}>Rs. {total.toLocaleString()}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    ...shadows.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerText: {
    ...typography.h4,
    color: colors.text.primary,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.sm,
  },
  tableHeaderText: {
    flex: 1,
    ...typography.captionMedium,
    color: colors.text.muted,
  },
  tableHeaderTextRight: {
    flex: 1,
    ...typography.captionMedium,
    color: colors.text.muted,
    textAlign: 'right',
  },
  denominationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  denominationLabel: {
    flex: 1,
  },
  denominationText: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  denominationValue: {
    ...typography.caption,
    color: colors.text.muted,
  },
  counterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  counterButton: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.md,
    backgroundColor: colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  countInput: {
    width: 50,
    height: 36,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    textAlign: 'center',
    ...typography.body,
    color: colors.text.primary,
  },
  amountContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  amountText: {
    ...typography.body,
    color: colors.text.primary,
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 2,
    borderTopColor: colors.primary[500],
  },
  totalLabel: {
    ...typography.h4,
    color: colors.primary[500],
  },
  totalAmount: {
    ...typography.h3,
    color: colors.primary[500],
  },
});

export default CashCounter;

