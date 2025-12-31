import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useInvoiceStore, useAuthStore } from '../../../src/stores';
import { Button, Card, Badge, LoadingSpinner } from '../../../src/components';
import { colors, typography, spacing, borderRadius } from '../../../src/theme';
import { Invoice } from '../../../src/types/invoice';
import { printInvoice, shareInvoice } from '../../../src/utils/pdfGenerator';

export default function InvoiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getInvoiceById } = useInvoiceStore();
  const { user } = useAuthStore();
  
  const invoice = getInvoiceById(id || '');
  const [isPrinting, setIsPrinting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const isSalesman = user?.role === 'salesman';

  if (!invoice) {
    return (
      <View style={styles.notFound}>
        <Ionicons name="alert-circle-outline" size={64} color={colors.gray[300]} />
        <Text style={styles.notFoundText}>Invoice not found</Text>
        <Button title="Go Back" onPress={() => router.back()} variant="outline" />
      </View>
    );
  }

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      await printInvoice(invoice);
      Alert.alert('Success', 'Invoice sent to printer');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to print invoice');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleShare = async () => {
    setIsSharing(true);
    try {
      await shareInvoice(invoice);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to share invoice');
    } finally {
      setIsSharing(false);
    }
  };

  const invoiceDate = new Date(invoice.invoiceDate).toLocaleDateString('en-PK', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Card style={styles.headerCard}>
          <View style={styles.headerRow}>
            <View style={styles.headerInfo}>
              <Text style={styles.invoiceNumber}>{invoice.invoiceNumber}</Text>
              <Text style={styles.orderNumber}>Order: {invoice.orderNumber}</Text>
              <Text style={styles.invoiceDate}>Date: {invoiceDate}</Text>
            </View>
            <Badge
              label={(invoice.status || 'draft').toUpperCase()}
              variant={
                invoice.status === 'paid'
                  ? 'success'
                  : invoice.status === 'cancelled'
                  ? 'error'
                  : 'default'
              }
              size="md"
            />
          </View>
        </Card>

        {/* Shop Info */}
        <Card style={styles.shopCard}>
          <Text style={styles.sectionTitle}>Bill To</Text>
          <Text style={styles.shopName}>{invoice.shopName}</Text>
          <Text style={styles.shopOwner}>{invoice.ownerName}</Text>
          <Text style={styles.shopAddress}>{invoice.shopAddress}</Text>
          <Text style={styles.shopPhone}>Phone: {invoice.shopPhone}</Text>
        </Card>

        {/* Items */}
        <Text style={styles.sectionTitle}>Items ({invoice.items.length})</Text>
        {invoice.items.map((item, index) => (
          <Card key={index} style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.productName}</Text>
                <Text style={styles.itemDetails}>
                  {item.quantity} {item.unit} × Rs. {item.unitPrice.toLocaleString()}
                </Text>
              </View>
              {!isSalesman && item.discountPercent > 0 && (
                <View style={styles.discountBadge}>
                  <Text style={styles.discountText}>{item.discountPercent}% OFF</Text>
                </View>
              )}
            </View>
            <View style={styles.itemFooter}>
              <Text style={styles.itemTotal}>Rs. {item.lineTotal.toLocaleString()}</Text>
            </View>
          </Card>
        ))}

        {/* Totals */}
        <Card style={styles.totalsCard}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal:</Text>
            <Text style={styles.totalValue}>Rs. {invoice.subtotal.toLocaleString()}</Text>
          </View>
          {!isSalesman && invoice.totalDiscount > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Discount:</Text>
              <Text style={[styles.totalValue, { color: colors.error }]}>
                -Rs. {invoice.totalDiscount.toLocaleString()}
              </Text>
            </View>
          )}
          {invoice.taxAmount && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tax:</Text>
              <Text style={styles.totalValue}>Rs. {invoice.taxAmount.toLocaleString()}</Text>
            </View>
          )}
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.grandTotalLabel}>Grand Total:</Text>
            <Text style={styles.grandTotalValue}>Rs. {invoice.grandTotal.toLocaleString()}</Text>
          </View>
        </Card>

        {/* Payment Info */}
        <Card style={styles.paymentCard}>
          <Text style={styles.sectionTitle}>Payment</Text>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Mode:</Text>
            <Text style={styles.paymentValue}>{(invoice.paymentMode || 'cash').toUpperCase()}</Text>
          </View>
          {(invoice.paymentMode === 'partial' || invoice.paymentMode === 'credit') && (
            <>
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>Cash:</Text>
                <Text style={styles.paymentValue}>Rs. {invoice.cashAmount.toLocaleString()}</Text>
              </View>
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>Credit:</Text>
                <Text style={styles.paymentValue}>Rs. {invoice.creditAmount.toLocaleString()}</Text>
              </View>
            </>
          )}
          {invoice.paidAmount && (
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>Paid:</Text>
              <Text style={[styles.paymentValue, { color: colors.success }]}>
                Rs. {invoice.paidAmount.toLocaleString()}
              </Text>
            </View>
          )}
        </Card>

        {/* Signature */}
        {invoice.invoiceSigned && (
          <Card style={styles.signatureCard}>
            <View style={styles.signatureRow}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={styles.signatureText}>
                Signed by: {invoice.signedBy || 'Customer'}
              </Text>
            </View>
            {invoice.signedAt && (
              <Text style={styles.signatureDate}>
                {new Date(invoice.signedAt).toLocaleString('en-PK')}
              </Text>
            )}
          </Card>
        )}

        {/* Notes */}
        {invoice.notes && (
          <Card style={styles.notesCard}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notesText}>{invoice.notes}</Text>
          </Card>
        )}
      </ScrollView>

      {/* Footer Actions */}
      <View style={styles.footer}>
        <Button
          title={isPrinting ? 'Printing...' : 'Print Invoice'}
          onPress={handlePrint}
          loading={isPrinting}
          disabled={isPrinting || isSharing}
          variant="outline"
          style={styles.actionButton}
          icon={
            isPrinting ? (
              <ActivityIndicator size="small" color={colors.primary[500]} />
            ) : (
              <Ionicons name="print" size={20} color={colors.primary[500]} />
            )
          }
        />
        <Button
          title={isSharing ? 'Sharing...' : 'Share Invoice'}
          onPress={handleShare}
          loading={isSharing}
          disabled={isPrinting || isSharing}
          style={styles.actionButton}
          icon={
            isSharing ? (
              <ActivityIndicator size="small" color={colors.text.inverse} />
            ) : (
              <Ionicons name="share" size={20} color={colors.text.inverse} />
            )
          }
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
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  notFoundText: {
    ...typography.h4,
    color: colors.text.muted,
    marginVertical: spacing.lg,
  },
  headerCard: {
    marginBottom: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerInfo: {
    flex: 1,
  },
  invoiceNumber: {
    ...typography.h3,
    color: colors.primary[500],
    marginBottom: 4,
  },
  orderNumber: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  invoiceDate: {
    ...typography.caption,
    color: colors.text.muted,
  },
  shopCard: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  shopName: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    marginBottom: 4,
  },
  shopOwner: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  shopAddress: {
    ...typography.body,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  shopPhone: {
    ...typography.body,
    color: colors.text.secondary,
  },
  itemCard: {
    marginBottom: spacing.md,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    marginBottom: 2,
  },
  itemDetails: {
    ...typography.caption,
    color: colors.text.muted,
  },
  discountBadge: {
    backgroundColor: colors.success + '20',
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  discountText: {
    ...typography.caption,
    color: colors.success,
    fontWeight: '600',
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  itemTotal: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  totalsCard: {
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  totalLabel: {
    ...typography.body,
    color: colors.text.secondary,
  },
  totalValue: {
    ...typography.body,
    color: colors.text.primary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  grandTotalLabel: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  grandTotalValue: {
    ...typography.h3,
    color: colors.primary[500],
  },
  paymentCard: {
    marginBottom: spacing.lg,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  paymentLabel: {
    ...typography.body,
    color: colors.text.secondary,
  },
  paymentValue: {
    ...typography.body,
    color: colors.text.primary,
  },
  signatureCard: {
    marginBottom: spacing.lg,
    backgroundColor: colors.success + '10',
  },
  signatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  signatureText: {
    ...typography.body,
    color: colors.success,
  },
  signatureDate: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
  notesCard: {
    marginBottom: spacing.lg,
  },
  notesText: {
    ...typography.body,
    color: colors.text.secondary,
  },
  footer: {
    flexDirection: 'row',
    padding: spacing.base,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
  },
});

