import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import { Button } from '../common/Button';
import { Shop } from '../../types/shop';

interface PaymentModalProps {
  visible: boolean;
  shop: Shop | null;
  onClose: () => void;
  onSubmit: (amount: number, notes: string) => void;
  isLoading?: boolean;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  visible,
  shop,
  onClose,
  onSubmit,
  isLoading = false,
}) => {
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    setError('');
    
    const numAmount = parseFloat(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (shop && numAmount > shop.currentBalance && shop.currentBalance > 0) {
      setError(`Amount exceeds outstanding balance of Rs. ${shop.currentBalance.toLocaleString()}`);
      return;
    }

    onSubmit(numAmount, notes);
    // Reset form
    setAmount('');
    setNotes('');
  };

  const handleClose = () => {
    setAmount('');
    setNotes('');
    setError('');
    onClose();
  };

  const quickAmounts = shop ? [
    shop.currentBalance > 0 ? shop.currentBalance : null, // Full amount
    5000,
    10000,
    20000,
  ].filter(Boolean) as number[] : [5000, 10000, 20000];

  if (!shop) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleClose}
        />
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Collect Payment</Text>
              <Text style={styles.shopName}>{shop.shopName}</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Current Balance */}
            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>Outstanding Balance</Text>
              <Text
                style={[
                  styles.balanceAmount,
                  shop.currentBalance <= 0 && styles.balanceCleared,
                ]}
              >
                Rs. {shop.currentBalance.toLocaleString()}
              </Text>
              {shop.currentBalance <= 0 && (
                <Text style={styles.balanceNote}>
                  {shop.currentBalance < 0
                    ? `Shop has advance of Rs. ${Math.abs(shop.currentBalance).toLocaleString()}`
                    : 'No outstanding balance'}
                </Text>
              )}
            </View>

            {/* Amount Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Payment Amount (Rs.)</Text>
              <View style={styles.amountInputContainer}>
                <Text style={styles.currencySymbol}>Rs.</Text>
                <TextInput
                  style={styles.amountInput}
                  value={amount}
                  onChangeText={(text) => {
                    setAmount(text.replace(/[^0-9.]/g, ''));
                    setError('');
                  }}
                  placeholder="0"
                  placeholderTextColor={colors.text.muted}
                  keyboardType="numeric"
                  autoFocus
                />
              </View>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </View>

            {/* Quick Amounts */}
            <View style={styles.quickAmounts}>
              {quickAmounts.slice(0, 4).map((quickAmount, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.quickButton,
                    amount === quickAmount.toString() && styles.quickButtonActive,
                  ]}
                  onPress={() => setAmount(quickAmount.toString())}
                >
                  <Text
                    style={[
                      styles.quickButtonText,
                      amount === quickAmount.toString() && styles.quickButtonTextActive,
                    ]}
                  >
                    {index === 0 && shop.currentBalance > 0
                      ? 'Full'
                      : `${(quickAmount / 1000).toFixed(0)}k`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Notes Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Notes (Optional)</Text>
              <TextInput
                style={styles.notesInput}
                value={notes}
                onChangeText={setNotes}
                placeholder="Add a note about this payment..."
                placeholderTextColor={colors.text.muted}
                multiline
                numberOfLines={2}
              />
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Button
              title="Cancel"
              variant="outline"
              onPress={handleClose}
              style={styles.cancelButton}
            />
            <Button
              title={isLoading ? 'Processing...' : 'Collect Payment'}
              onPress={handleSubmit}
              disabled={isLoading || !amount}
              style={styles.submitButton}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  container: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius['2xl'],
    borderTopRightRadius: borderRadius['2xl'],
    maxHeight: '85%',
    ...shadows.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    ...typography.h3,
    color: colors.text.primary,
  },
  shopName: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: 2,
  },
  closeButton: {
    padding: spacing.xs,
  },
  content: {
    padding: spacing.lg,
  },
  balanceCard: {
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  balanceLabel: {
    ...typography.caption,
    color: colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primary[500],
    marginTop: spacing.xs,
  },
  balanceCleared: {
    color: colors.secondary[500],
  },
  balanceNote: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  currencySymbol: {
    ...typography.h3,
    color: colors.text.muted,
    marginRight: spacing.sm,
  },
  amountInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: '600',
    color: colors.text.primary,
    paddingVertical: spacing.md,
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.xs,
  },
  quickAmounts: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  quickButton: {
    flex: 1,
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  quickButtonActive: {
    backgroundColor: colors.primary[500],
  },
  quickButtonText: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
  },
  quickButtonTextActive: {
    color: colors.text.inverse,
  },
  notesInput: {
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...typography.body,
    color: colors.text.primary,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  footer: {
    flexDirection: 'row',
    padding: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.md,
  },
  cancelButton: {
    flex: 1,
  },
  submitButton: {
    flex: 2,
  },
});

