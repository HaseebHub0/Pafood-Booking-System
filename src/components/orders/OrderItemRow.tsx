import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../../theme';
import { OrderItem } from '../../types';

interface OrderItemRowProps {
  item: OrderItem;
  editable?: boolean;
  onQuantityChange?: (quantity: number) => void;
  onDiscountChange?: (discount: number) => void;
  onRemove?: () => void;
  hideDiscount?: boolean; // Hide discount info for salesmen
}

export const OrderItemRow: React.FC<OrderItemRowProps> = ({
  item,
  editable = false,
  onQuantityChange,
  onDiscountChange,
  onRemove,
  hideDiscount = false,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.productName} numberOfLines={1}>
          {item.productName}
        </Text>
        {editable && onRemove && (
          <TouchableOpacity onPress={onRemove} style={styles.removeButton}>
            <Ionicons name="trash-outline" size={18} color={colors.error} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.details}>
        <Text style={styles.price}>
          Rs. {item.unitPrice.toLocaleString()} × {item.quantity}
        </Text>
        <Text style={styles.lineTotal}>= Rs. {item.lineTotal.toLocaleString()}</Text>
      </View>

      {editable && onQuantityChange ? (
        <View style={styles.quantityRow}>
          <Text style={styles.label}>Quantity:</Text>
          <View style={styles.quantityControls}>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => onQuantityChange(item.quantity - 1)}
            >
              <Ionicons name="remove" size={18} color={colors.primary[500]} />
            </TouchableOpacity>
            <Text style={styles.quantityText}>{item.quantity}</Text>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => onQuantityChange(item.quantity + 1)}
            >
              <Ionicons name="add" size={18} color={colors.primary[500]} />
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {!hideDiscount && (
        <>
      <View style={styles.discountRow}>
        <View style={styles.discountInfo}>
          <Text style={styles.label}>Discount:</Text>
          {editable && onDiscountChange ? (
            <View style={styles.discountInputContainer}>
              <TouchableOpacity
                style={styles.discountButton}
                onPress={() => onDiscountChange(Math.max(0, item.discountPercent - 1))}
              >
                <Ionicons name="remove" size={14} color={colors.gray[500]} />
              </TouchableOpacity>
              <Text style={styles.discountValue}>{item.discountPercent}%</Text>
              <TouchableOpacity
                    style={styles.discountButton}
                onPress={() => {
                      // Allow any discount percentage - no cap
                      // System will track unauthorized amount and show warning
                      onDiscountChange(item.discountPercent + 1);
                    }}
              >
                <Ionicons 
                  name="add" 
                  size={14} 
                      color={colors.gray[500]} 
                />
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.discountValue}>{item.discountPercent}%</Text>
          )}
        </View>
        <Text style={styles.discountAmount}>-Rs. {item.discountAmount.toFixed(0)}</Text>
      </View>

      {item.isUnauthorizedDiscount && (
        <View style={styles.warningRow}>
          <Ionicons name="warning" size={14} color={colors.warning} />
          <Text style={styles.warningText}>
                ⚠️ Allowed ({item.maxAllowedDiscount}%) se ziada: Rs. {item.unauthorizedAmount.toFixed(0)}
                {'\n'}Ye aap ki salary me se kate ga.
          </Text>
        </View>
          )}
        </>
      )}

      <View style={styles.subtotalRow}>
        <Text style={styles.subtotalLabel}>Subtotal:</Text>
        <Text style={styles.subtotalValue}>Rs. {item.finalAmount.toLocaleString()}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  productName: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    flex: 1,
  },
  removeButton: {
    padding: spacing.xs,
  },
  details: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  price: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  lineTotal: {
    ...typography.captionMedium,
    color: colors.text.primary,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  label: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  quantityButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityText: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    minWidth: 40,
    textAlign: 'center',
  },
  discountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  discountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  discountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
  },
  discountButton: {
    padding: spacing.sm,
  },
  discountButtonDisabled: {
    opacity: 0.5,
  },
  discountValue: {
    ...typography.captionMedium,
    color: colors.text.primary,
    minWidth: 44,
    textAlign: 'center',
  },
  discountAmount: {
    ...typography.caption,
    color: colors.error,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  warningText: {
    ...typography.caption,
    color: '#92400E',
    flex: 1,
  },
  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  subtotalLabel: {
    ...typography.captionMedium,
    color: colors.text.secondary,
  },
  subtotalValue: {
    ...typography.bodyMedium,
    color: colors.primary[500],
  },
});

