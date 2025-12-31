import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../../theme';
import { LedgerTransaction, TransactionType } from '../../types/ledger';

interface TransactionRowProps {
  transaction: LedgerTransaction;
  onPress?: () => void;
  showShopName?: boolean;
}

const getTransactionConfig = (type: TransactionType) => {
  switch (type) {
    case 'SALE':
    case 'SALE_DELIVERED':
      return {
        icon: 'cart' as const,
        color: colors.primary[500],
        bgColor: colors.primary[50],
        label: type === 'SALE_DELIVERED' ? 'Sale' : 'Sale',
        amountPrefix: '+',
      };
    case 'PAYMENT':
      return {
        icon: 'cash' as const,
        color: colors.secondary[500],
        bgColor: colors.secondary[50],
        label: 'Payment',
        amountPrefix: '-',
      };
    case 'RETURN':
      return {
        icon: 'return-down-back' as const,
        color: colors.error,
        bgColor: colors.error + '20',
        label: 'Return',
        amountPrefix: '-',
      };
    case 'ADJUSTMENT':
      return {
        icon: 'create' as const,
        color: colors.info,
        bgColor: '#DBEAFE',
        label: 'Adjustment',
        amountPrefix: '',
      };
    case 'OPENING_BALANCE':
      return {
        icon: 'flag' as const,
        color: colors.gray[500],
        bgColor: colors.gray[100],
        label: 'Opening',
        amountPrefix: '',
      };
    default:
      return {
        icon: 'help' as const,
        color: colors.gray[500],
        bgColor: colors.gray[100],
        label: 'Unknown',
        amountPrefix: '',
      };
  }
};

export const TransactionRow: React.FC<TransactionRowProps> = ({
  transaction,
  onPress,
  showShopName = false,
}) => {
  const config = getTransactionConfig(transaction.type);
  const isPayment = transaction.type === 'PAYMENT';
  const isReturn = transaction.type === 'RETURN';
  
  // Handle both old structure (amount) and new structure (net_cash)
  const amount = Math.abs((transaction as any).net_cash ?? transaction.amount ?? 0);

  // Get date from either created_at (new) or date (legacy)
  const dateStr = (transaction as any).created_at || transaction.date || transaction.createdAt;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-PK', {
      day: 'numeric',
      month: 'short',
      year: '2-digit',
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-PK', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const Container = onPress ? TouchableOpacity : View;

  // Get reference number (order_number or return_number)
  const referenceNumber = (transaction as any).order_number || (transaction as any).return_number || transaction.orderNumber;

  return (
    <Container
      style={styles.container}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      {/* Icon */}
      <View style={[styles.iconContainer, { backgroundColor: config.bgColor }]}>
        <Ionicons name={config.icon} size={20} color={config.color} />
      </View>

      {/* Details */}
      <View style={styles.details}>
        <View style={styles.topRow}>
          <Text style={styles.type} numberOfLines={1} ellipsizeMode="tail">
            {config.label}
          </Text>
          <Text
            style={[
              styles.amount,
              isPayment || isReturn ? styles.paymentAmount : styles.saleAmount,
            ]}
            numberOfLines={1}
          >
            {isPayment || isReturn ? '-' : '+'} Rs. {amount.toLocaleString()}
          </Text>
        </View>

        <View style={styles.bottomRow}>
          {showShopName ? (
            <Text style={styles.shopName} numberOfLines={1} ellipsizeMode="tail">
              {transaction.shopName || '—'}
            </Text>
          ) : referenceNumber ? (
            <Text style={styles.orderNumber} numberOfLines={1} ellipsizeMode="tail">
              {referenceNumber}
            </Text>
          ) : transaction.notes ? (
            <Text style={styles.notes} numberOfLines={1} ellipsizeMode="tail">
              {transaction.notes}
            </Text>
          ) : (
            <Text style={styles.notes}>—</Text>
          )}
          <Text style={styles.date} numberOfLines={1}>
            {dateStr ? `${formatDate(dateStr)} • ${formatTime(dateStr)}` : '—'}
          </Text>
        </View>

        {/* Notes or additional info */}
        {transaction.notes && !referenceNumber && (
          <Text style={styles.notes} numberOfLines={2} ellipsizeMode="tail">
            {transaction.notes}
          </Text>
        )}

        {/* Balance info - only show if balance fields exist (legacy support) */}
        {(transaction as any).balanceBefore !== undefined && (transaction as any).balanceAfter !== undefined && (
          <View style={styles.balanceRow}>
            <Text style={styles.balanceLabel}>Balance:</Text>
            <Text style={styles.balanceChange} numberOfLines={1} ellipsizeMode="tail">
              Rs. {(transaction as any).balanceBefore.toLocaleString()} → Rs.{' '}
              {(transaction as any).balanceAfter.toLocaleString()}
            </Text>
          </View>
        )}

        {/* Collector info for payments */}
        {(transaction as any).collectedByName && transaction.type === 'PAYMENT' && (
          <Text style={styles.collector} numberOfLines={1} ellipsizeMode="tail">
            Collected by: {(transaction as any).collectedByName}
          </Text>
        )}
      </View>
    </Container>
  );
};

// Compact version for lists
export const TransactionRowCompact: React.FC<TransactionRowProps> = ({
  transaction,
  onPress,
  showShopName = false,
}) => {
  const config = getTransactionConfig(transaction.type);
  const isPayment = transaction.type === 'PAYMENT';
  const isReturn = transaction.type === 'RETURN';
  
  // Handle both old structure (amount) and new structure (net_cash)
  const amount = Math.abs((transaction as any).net_cash ?? transaction.amount ?? 0);

  // Get date from either created_at (new) or date (legacy)
  const dateStr = (transaction as any).created_at || transaction.date || transaction.createdAt;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-PK', {
      day: 'numeric',
      month: 'short',
    });
  };

  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container
      style={styles.compactContainer}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={[styles.compactIcon, { backgroundColor: config.bgColor }]}>
        <Ionicons name={config.icon} size={16} color={config.color} />
      </View>
      <View style={styles.compactDetails}>
        <Text style={styles.compactLabel} numberOfLines={1} ellipsizeMode="tail">
          {showShopName ? (transaction.shopName || '—') : config.label}
        </Text>
        <Text style={styles.compactDate} numberOfLines={1}>
          {dateStr ? formatDate(dateStr) : '—'}
        </Text>
      </View>
      <Text
        style={[
          styles.compactAmount,
          isPayment || isReturn ? styles.paymentAmount : styles.saleAmount,
        ]}
        numberOfLines={1}
      >
        {isPayment || isReturn ? '-' : '+'} Rs. {amount.toLocaleString()}
      </Text>
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  details: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  type: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  amount: {
    ...typography.bodyMedium,
    fontWeight: '700',
  },
  saleAmount: {
    color: colors.primary[500],
  },
  paymentAmount: {
    color: colors.secondary[600],
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    gap: spacing.sm,
  },
  shopName: {
    ...typography.caption,
    color: colors.text.secondary,
    flex: 1,
    marginRight: spacing.sm,
  },
  orderNumber: {
    ...typography.caption,
    color: colors.info,
    flex: 1,
    marginRight: spacing.sm,
  },
  notes: {
    ...typography.caption,
    color: colors.text.muted,
    flex: 1,
    marginRight: spacing.sm,
  },
  date: {
    ...typography.caption,
    color: colors.text.muted,
    flexShrink: 0, // Prevent date from shrinking
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  balanceLabel: {
    ...typography.caption,
    color: colors.text.muted,
    marginRight: 4,
  },
  balanceChange: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  collector: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: 4,
    fontStyle: 'italic',
  },

  // Compact styles
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  compactIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  compactDetails: {
    flex: 1,
    marginRight: spacing.sm,
    minWidth: 0, // Allows text to shrink below content size
  },
  compactLabel: {
    ...typography.body,
    color: colors.text.primary,
  },
  compactDate: {
    ...typography.caption,
    color: colors.text.muted,
  },
  compactAmount: {
    ...typography.bodyMedium,
    fontWeight: '600',
    flexShrink: 0, // Prevent amount from shrinking
  },
});

