import React from 'react';
import { View, Text, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import { Button } from '../common';

interface UnauthorizedDiscountPopupProps {
  visible: boolean;
  amount: number;
  onCancel: () => void;
  onConfirm: () => void;
}

export const UnauthorizedDiscountPopup: React.FC<UnauthorizedDiscountPopupProps> = ({
  visible,
  amount,
  onCancel,
  onConfirm,
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.popup}>
          <View style={styles.iconContainer}>
            <Ionicons name="warning" size={48} color={colors.warning} />
          </View>

          <Text style={styles.title}>⚠️ Unauthorized Discount</Text>

          <Text style={styles.message}>
            Allowed se zyada discount de rahe ho.{'\n'}
            <Text style={styles.amount}>Rs. {amount.toLocaleString()}</Text> extra discount hai.
          </Text>

          <View style={styles.warningBox}>
            <Ionicons name="alert-circle" size={20} color="#991B1B" />
            <Text style={styles.warning}>
              Ye salary se deduct hoga.
            </Text>
          </View>

          <View style={styles.buttonRow}>
            <Button
              title="Go Back & Edit"
              onPress={onCancel}
              variant="outline"
              style={styles.button}
            />
            <Button
              title="Continue Anyway"
              onPress={onConfirm}
              variant="primary"
              style={styles.button}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  popup: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    ...shadows.xl,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.full,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h3,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  message: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  amount: {
    fontWeight: '700',
    color: colors.error,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  warning: {
    ...typography.captionMedium,
    color: '#991B1B',
    flex: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
  },
  button: {
    flex: 1,
  },
});

