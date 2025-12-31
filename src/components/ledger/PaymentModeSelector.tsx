import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../../theme';
import { PaymentMode } from '../../types/ledger';

interface PaymentModeSelectorProps {
  grandTotal: number;
  paymentMode: PaymentMode;
  cashAmount: number;
  creditAmount: number;
  availableCredit: number;
  onPaymentModeChange: (mode: PaymentMode, cashAmount?: number) => void;
}

export const PaymentModeSelector: React.FC<PaymentModeSelectorProps> = ({
  grandTotal,
  paymentMode,
  cashAmount,
  creditAmount,
  availableCredit,
  onPaymentModeChange,
}) => {
  const [partialCash, setPartialCash] = useState(cashAmount.toString());

  const modes: { value: PaymentMode; label: string; icon: string }[] = [
    { value: 'cash', label: 'Cash', icon: 'cash' },
    { value: 'credit', label: 'Credit', icon: 'card' },
    { value: 'partial', label: 'Partial', icon: 'swap-horizontal' },
  ];

  const handleModeSelect = (mode: PaymentMode) => {
    if (mode === 'partial') {
      // Default to 50% cash for partial
      const defaultCash = Math.round(grandTotal / 2);
      setPartialCash(defaultCash.toString());
      onPaymentModeChange(mode, defaultCash);
    } else {
      onPaymentModeChange(mode);
    }
  };

  const handlePartialCashChange = (text: string) => {
    const numericValue = text.replace(/[^0-9]/g, '');
    setPartialCash(numericValue);
    const cash = parseInt(numericValue) || 0;
    onPaymentModeChange('partial', Math.min(cash, grandTotal));
  };

  const creditExceeded = paymentMode !== 'cash' && creditAmount > availableCredit;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Payment Mode</Text>

      {/* Mode Selector */}
      <View style={styles.modeSelector}>
        {modes.map((mode) => (
          <TouchableOpacity
            key={mode.value}
            style={[
              styles.modeButton,
              paymentMode === mode.value && styles.modeButtonActive,
            ]}
            onPress={() => handleModeSelect(mode.value)}
          >
            <Ionicons
              name={mode.icon as any}
              size={20}
              color={paymentMode === mode.value ? colors.text.inverse : colors.text.secondary}
            />
            <Text
              style={[
                styles.modeButtonText,
                paymentMode === mode.value && styles.modeButtonTextActive,
              ]}
            >
              {mode.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Partial Payment Input */}
      {paymentMode === 'partial' && (
        <View style={styles.partialSection}>
          <View style={styles.partialInputRow}>
            <Text style={styles.partialLabel}>Cash Amount:</Text>
            <View style={styles.partialInputContainer}>
              <Text style={styles.currencyPrefix}>Rs.</Text>
              <TextInput
                style={styles.partialInput}
                value={partialCash}
                onChangeText={handlePartialCashChange}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.text.muted}
              />
            </View>
          </View>
          <View style={styles.partialBreakdown}>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Cash:</Text>
              <Text style={styles.breakdownValue}>
                Rs. {cashAmount.toLocaleString()}
              </Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Credit:</Text>
              <Text
                style={[
                  styles.breakdownValue,
                  creditExceeded && styles.breakdownValueError,
                ]}
              >
                Rs. {creditAmount.toLocaleString()}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Summary */}
      <View style={styles.summary}>
        {paymentMode === 'cash' && (
          <View style={styles.summaryRow}>
            <Ionicons name="checkmark-circle" size={18} color={colors.secondary[500]} />
            <Text style={styles.summaryText}>
              Full payment of Rs. {grandTotal.toLocaleString()} in cash
            </Text>
          </View>
        )}
        {paymentMode === 'credit' && (
          <>
            <View style={styles.summaryRow}>
              <Ionicons
                name={creditExceeded ? 'alert-circle' : 'information-circle'}
                size={18}
                color={creditExceeded ? colors.error : colors.info}
              />
              <Text
                style={[styles.summaryText, creditExceeded && styles.summaryTextError]}
              >
                Rs. {grandTotal.toLocaleString()} will be added to credit
              </Text>
            </View>
            <Text style={styles.availableCredit}>
              Available Credit: Rs. {availableCredit.toLocaleString()}
            </Text>
          </>
        )}
        {paymentMode === 'partial' && creditExceeded && (
          <View style={styles.warningBox}>
            <Ionicons name="alert-circle" size={18} color={colors.error} />
            <Text style={styles.warningText}>
              Credit amount (Rs. {creditAmount.toLocaleString()}) exceeds available credit (Rs.{' '}
              {availableCredit.toLocaleString()})
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  title: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  modeSelector: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  modeButtonActive: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[600],
  },
  modeButtonText: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
  },
  modeButtonTextActive: {
    color: colors.text.inverse,
  },
  partialSection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  partialInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  partialLabel: {
    ...typography.body,
    color: colors.text.secondary,
  },
  partialInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  currencyPrefix: {
    ...typography.body,
    color: colors.text.muted,
    marginRight: spacing.xs,
  },
  partialInput: {
    ...typography.h4,
    color: colors.text.primary,
    paddingVertical: spacing.sm,
    minWidth: 100,
    textAlign: 'right',
  },
  partialBreakdown: {
    marginTop: spacing.md,
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  breakdownLabel: {
    ...typography.body,
    color: colors.text.secondary,
  },
  breakdownValue: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  breakdownValueError: {
    color: colors.error,
  },
  summary: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  summaryText: {
    ...typography.body,
    color: colors.text.secondary,
    flex: 1,
  },
  summaryTextError: {
    color: colors.error,
  },
  availableCredit: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: spacing.xs,
    marginLeft: 26,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: '#FEF2F2',
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  warningText: {
    ...typography.caption,
    color: colors.error,
    flex: 1,
  },
});

