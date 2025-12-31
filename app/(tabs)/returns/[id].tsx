import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useReturnStore, useAuthStore } from '../../../src/stores';
import { Card, Badge } from '../../../src/components';
import { colors, typography, spacing, borderRadius } from '../../../src/theme';
import { ReturnReason } from '../../../src/types/return';

const RETURN_REASON_LABELS: Record<ReturnReason, string> = {
  expired: 'Expired',
  damaged: 'Damaged',
  wrong_product: 'Wrong Product',
  defective: 'Defective',
  other: 'Other',
};

export default function ReturnDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getReturnById } = useReturnStore();
  const { user } = useAuthStore();
  
  const returnItem = getReturnById(id || '');

  if (!returnItem) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.notFound}>
          <Ionicons name="alert-circle-outline" size={64} color={colors.gray[300]} />
          <Text style={styles.notFoundText}>Return not found</Text>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const returnDate = new Date(returnItem.createdAt).toLocaleDateString('en-PK', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return colors.success;
      case 'rejected':
        return colors.error;
      case 'processed':
        return colors.info;
      case 'pending_kpo_approval':
      case 'pending':
        return colors.warning;
      default:
        return colors.gray[400];
    }
  };

  const getStatusLabel = (status: string) => {
    if (status === 'pending_kpo_approval') return 'Pending KPO Approval';
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backIcon}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Return Details</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Return Info Card */}
        <Card style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <View style={styles.infoLeft}>
              <Text style={styles.returnNumber}>{returnItem.returnNumber}</Text>
              <Text style={styles.returnDate}>Created: {returnDate}</Text>
            </View>
            <Badge
              label={getStatusLabel(returnItem.status)}
              variant={
                returnItem.status === 'approved' || returnItem.status === 'processed'
                  ? 'success'
                  : returnItem.status === 'rejected'
                  ? 'error'
                  : returnItem.status === 'pending_kpo_approval' || returnItem.status === 'pending'
                  ? 'warning'
                  : 'default'
              }
              size="md"
            />
          </View>
        </Card>

        {/* Shop Info */}
        <Card style={styles.shopCard}>
          <Text style={styles.sectionTitle}>Shop Information</Text>
          <View style={styles.shopInfo}>
            <View style={styles.infoRow}>
              <Ionicons name="storefront" size={18} color={colors.text.muted} />
              <Text style={styles.infoLabel}>Shop Name:</Text>
              <Text style={styles.infoValue}>{returnItem.shopName}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="person" size={18} color={colors.text.muted} />
              <Text style={styles.infoLabel}>Owner:</Text>
              <Text style={styles.infoValue}>{returnItem.ownerName}</Text>
            </View>
          </View>
        </Card>

        {/* Return Items */}
        <Card style={styles.itemsCard}>
          <Text style={styles.sectionTitle}>Return Items ({returnItem.items.length})</Text>
          {returnItem.items.map((item, index) => (
            <View key={index} style={styles.itemRow}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.productName}</Text>
                <View style={styles.itemDetails}>
                  <Text style={styles.itemDetail}>
                    Qty: {item.quantity} {item.unit}
                  </Text>
                  <Text style={styles.itemDetail}>
                    Price: Rs. {item.unitPrice.toLocaleString()}
                  </Text>
                  <Text style={styles.itemDetail}>
                    Reason: {RETURN_REASON_LABELS[item.returnReason]}
                  </Text>
                </View>
                {item.condition && (
                  <Text style={styles.itemCondition}>Condition: {item.condition}</Text>
                )}
              </View>
              <View style={styles.itemValue}>
                <Text style={styles.itemValueText}>
                  Rs. {(item.quantity * item.unitPrice).toLocaleString()}
                </Text>
              </View>
            </View>
          ))}
        </Card>

        {/* Total Value */}
        <Card style={styles.totalCard}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Return Value</Text>
            <Text style={styles.totalValue}>Rs. {returnItem.totalValue.toLocaleString()}</Text>
          </View>
        </Card>

        {/* Status Information */}
        {returnItem.status === 'pending_kpo_approval' || returnItem.status === 'pending' ? (
          <Card style={styles.statusCard}>
            <View style={styles.statusInfo}>
              <Ionicons name="hourglass-outline" size={20} color={colors.warning} />
              <View style={styles.statusText}>
                <Text style={styles.statusTitle}>Pending KPO Approval</Text>
                <Text style={styles.statusDescription}>
                  This return is waiting for KPO approval. You will be notified once it's reviewed.
                </Text>
              </View>
            </View>
          </Card>
        ) : returnItem.status === 'approved' ? (
          <Card style={styles.statusCard}>
            <View style={styles.statusInfo}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <View style={styles.statusText}>
                <Text style={styles.statusTitle}>Approved</Text>
                {returnItem.approvedAt && (
                  <Text style={styles.statusDescription}>
                    Approved on {new Date(returnItem.approvedAt).toLocaleDateString('en-PK')}
                  </Text>
                )}
              </View>
            </View>
          </Card>
        ) : returnItem.status === 'rejected' ? (
          <Card style={styles.statusCard}>
            <View style={styles.statusInfo}>
              <Ionicons name="close-circle" size={20} color={colors.error} />
              <View style={styles.statusText}>
                <Text style={styles.statusTitle}>Rejected</Text>
                {returnItem.rejectionReason && (
                  <Text style={styles.statusDescription}>
                    Reason: {returnItem.rejectionReason}
                  </Text>
                )}
                {returnItem.approvedAt && (
                  <Text style={styles.statusDescription}>
                    Rejected on {new Date(returnItem.approvedAt).toLocaleDateString('en-PK')}
                  </Text>
                )}
              </View>
            </View>
          </Card>
        ) : returnItem.status === 'processed' ? (
          <Card style={styles.statusCard}>
            <View style={styles.statusInfo}>
              <Ionicons name="checkmark-done-circle" size={20} color={colors.info} />
              <View style={styles.statusText}>
                <Text style={styles.statusTitle}>Processed</Text>
                {returnItem.receivedAt && (
                  <Text style={styles.statusDescription}>
                    Received at warehouse on {new Date(returnItem.receivedAt).toLocaleDateString('en-PK')}
                  </Text>
                )}
              </View>
            </View>
          </Card>
        ) : null}

        {/* Collection Info */}
        {returnItem.collectedAt && (
          <Card style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="cube-outline" size={18} color={colors.text.muted} />
              <Text style={styles.infoLabel}>Collected:</Text>
              <Text style={styles.infoValue}>
                {new Date(returnItem.collectedAt).toLocaleDateString('en-PK')}
              </Text>
            </View>
          </Card>
        )}

        {/* Notes */}
        {returnItem.notes && (
          <Card style={styles.notesCard}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notesText}>{returnItem.notes}</Text>
          </Card>
        )}

        {/* Shop Notes */}
        {returnItem.shopNotes && (
          <Card style={styles.notesCard}>
            <Text style={styles.sectionTitle}>Shop Notes</Text>
            <Text style={styles.notesText}>{returnItem.shopNotes}</Text>
          </Card>
        )}

        {/* Warehouse Notes */}
        {returnItem.warehouseNotes && (
          <Card style={styles.notesCard}>
            <Text style={styles.sectionTitle}>Warehouse Notes</Text>
            <Text style={styles.notesText}>{returnItem.warehouseNotes}</Text>
          </Card>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  backIcon: {
    padding: spacing.xs,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text.primary,
  },
  placeholder: {
    width: 40,
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  notFoundText: {
    ...typography.body,
    color: colors.text.muted,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  backButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[500],
  },
  backButtonText: {
    ...typography.bodyMedium,
    color: colors.text.inverse,
    fontWeight: '600',
  },
  infoCard: {
    marginBottom: spacing.md,
  },
  infoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  infoLeft: {
    flex: 1,
  },
  returnNumber: {
    ...typography.h3,
    color: colors.primary[500],
    marginBottom: spacing.xs,
  },
  returnDate: {
    ...typography.caption,
    color: colors.text.muted,
  },
  shopCard: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  shopInfo: {
    gap: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  infoLabel: {
    ...typography.body,
    color: colors.text.secondary,
    minWidth: 80,
  },
  infoValue: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '600',
    flex: 1,
  },
  itemsCard: {
    marginBottom: spacing.md,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    ...typography.bodyMedium,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  itemDetails: {
    gap: spacing.xs,
  },
  itemDetail: {
    ...typography.caption,
    color: colors.text.muted,
  },
  itemCondition: {
    ...typography.caption,
    color: colors.warning,
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  itemValue: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  itemValueText: {
    ...typography.bodyMedium,
    fontWeight: '600',
    color: colors.text.primary,
  },
  totalCard: {
    marginBottom: spacing.md,
    backgroundColor: colors.primary[50],
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    ...typography.h3,
    color: colors.text.primary,
  },
  totalValue: {
    ...typography.h3,
    color: colors.primary[500],
    fontWeight: '700',
  },
  statusCard: {
    marginBottom: spacing.md,
    backgroundColor: colors.gray[50],
  },
  statusInfo: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statusText: {
    flex: 1,
  },
  statusTitle: {
    ...typography.bodyMedium,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  statusDescription: {
    ...typography.caption,
    color: colors.text.muted,
  },
  notesCard: {
    marginBottom: spacing.md,
  },
  notesText: {
    ...typography.body,
    color: colors.text.secondary,
    lineHeight: 20,
  },
});

