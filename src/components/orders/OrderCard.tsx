import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, shadows } from '../../theme';
import { Order, OrderStatus } from '../../types';
import { Badge } from '../common';

interface OrderCardProps {
  order: Order;
  onPress: () => void;
}

const statusConfig: Partial<Record<OrderStatus, { label: string; variant: 'draft' | 'submitted' | 'editRequested' | 'success' | 'default' }>> = {
  draft: { label: 'DRAFT', variant: 'draft' },
  submitted: { label: 'SUBMITTED', variant: 'submitted' },
  edit_requested: { label: 'EDIT REQ.', variant: 'editRequested' },
  finalized: { label: 'FINALIZED', variant: 'success' },
  billed: { label: 'BILLED', variant: 'success' },
  load_form_ready: { label: 'READY', variant: 'success' },
  assigned: { label: 'ASSIGNED', variant: 'submitted' },
  delivered: { label: 'DELIVERED', variant: 'success' },
};

export const OrderCard: React.FC<OrderCardProps> = ({ order, onPress }) => {
  const config = statusConfig[order.status] || { 
    label: order.status.toUpperCase().replace(/_/g, ' '), 
    variant: 'default' as const 
  };
  const formattedDate = new Date(order.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.header}>
        <View>
          <Text style={styles.orderNumber}>{order.orderNumber}</Text>
          <Text style={styles.shopName}>{order.shopName}</Text>
        </View>
        <Badge label={config.label} variant={config.variant} size="sm" />
      </View>

      <View style={styles.divider} />

      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <Text style={styles.amount}>Rs. {order.grandTotal.toLocaleString()}</Text>
          <Text style={styles.items}>{order.items.length} items</Text>
        </View>
        <View style={styles.footerRight}>
          <Text style={styles.date}>{formattedDate}</Text>
          <View style={styles.viewMore}>
            <Text style={styles.viewMoreText}>
              {order.status === 'draft' ? 'Edit' : 'View'}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary[500]} />
          </View>
        </View>
      </View>

      {order.unauthorizedDiscount > 0 && (
        <View style={styles.warningBanner}>
          <Ionicons name="warning" size={14} color={colors.warning} />
          <Text style={styles.warningText}>
            Unauthorized discount: Rs. {order.unauthorizedDiscount.toLocaleString()}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderNumber: {
    ...typography.captionMedium,
    color: colors.text.muted,
  },
  shopName: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  footerLeft: {},
  amount: {
    ...typography.h4,
    color: colors.text.primary,
  },
  items: {
    ...typography.caption,
    color: colors.text.muted,
  },
  footerRight: {
    alignItems: 'flex-end',
  },
  date: {
    ...typography.caption,
    color: colors.text.muted,
    marginBottom: spacing.xs,
  },
  viewMore: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewMoreText: {
    ...typography.captionMedium,
    color: colors.primary[500],
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  warningText: {
    ...typography.caption,
    color: '#92400E',
  },
});

