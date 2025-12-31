import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useInvoiceStore, useAuthStore } from '../../../src/stores';
import { Card, EmptyState, LoadingSpinner, Badge } from '../../../src/components';
import { colors, typography, spacing, borderRadius } from '../../../src/theme';
import { Invoice, InvoiceStatus } from '../../../src/types/invoice';

export default function InvoicesScreen() {
  const { invoices, loadInvoices, isLoading } = useInvoiceStore();
  const { user } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | InvoiceStatus>('all');

  useEffect(() => {
    loadInvoices();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadInvoices();
    setRefreshing(false);
  };

  // Only show invoices for salesman
  if (user?.role !== 'salesman') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.notAuthorized}>
          <Ionicons name="lock-closed" size={64} color={colors.gray[300]} />
          <Text style={styles.notAuthorizedText}>
            Invoice management is only available for Salesman
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const filteredInvoices = invoices.filter((invoice) => {
    if (filter === 'all') return true;
    return invoice.status === filter;
  }).sort((a, b) => {
    return new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime();
  });

  const handleInvoicePress = (invoiceId: string) => {
    router.push(`/(tabs)/invoices/${invoiceId}`);
  };

  const renderHeader = () => (
    <View>
      <View style={styles.header}>
        <Text style={styles.title}>Invoices</Text>
        <Text style={styles.subtitle}>{invoices.length} total</Text>
      </View>

      <View style={styles.filters}>
        {(['all', 'generated', 'sent', 'paid', 'cancelled'] as const).map((filterOption) => (
          <TouchableOpacity
            key={filterOption}
            style={[styles.filterButton, filter === filterOption && styles.filterButtonActive]}
            onPress={() => setFilter(filterOption)}
          >
            <Text
              style={[
                styles.filterButtonText,
                filter === filterOption && styles.filterButtonTextActive,
              ]}
            >
              {filterOption === 'all' ? 'All' : filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderInvoice = ({ item: invoice }: { item: Invoice }) => (
    <Card style={styles.invoiceCard} onPress={() => handleInvoicePress(invoice.id)}>
      <View style={styles.invoiceHeader}>
        <View style={styles.invoiceInfo}>
          <Text style={styles.invoiceNumber}>{invoice.invoiceNumber}</Text>
          <Text style={styles.shopName}>{invoice.shopName}</Text>
          <Text style={styles.orderNumber}>Order: {invoice.orderNumber}</Text>
        </View>
        <Badge
          label={invoice.status.toUpperCase()}
          variant={
            invoice.status === 'paid'
              ? 'success'
              : invoice.status === 'cancelled'
              ? 'error'
              : 'default'
          }
          size="sm"
        />
      </View>

      <View style={styles.invoiceDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="calendar" size={14} color={colors.text.muted} />
          <Text style={styles.detailText}>
            {new Date(invoice.invoiceDate).toLocaleDateString('en-PK')}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="cash" size={14} color={colors.text.muted} />
          <Text style={styles.detailText}>
            Rs. {invoice.grandTotal.toLocaleString()}
          </Text>
        </View>
        {invoice.paymentMode !== 'cash' && (
          <View style={styles.detailRow}>
            <Ionicons name="card" size={14} color={colors.info} />
            <Text style={[styles.detailText, { color: colors.info }]}>
              {invoice.paymentMode === 'credit' ? 'Credit' : 'Partial'}
            </Text>
          </View>
        )}
      </View>

      {invoice.invoiceSigned && (
        <View style={styles.signatureBadge}>
          <Ionicons name="checkmark-circle" size={14} color={colors.success} />
          <Text style={styles.signatureText}>Signed by customer</Text>
        </View>
      )}
    </Card>
  );

  if (isLoading && invoices.length === 0) {
    return <LoadingSpinner fullScreen message="Loading invoices..." />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={filteredInvoices}
        keyExtractor={(item) => item.id}
        renderItem={renderInvoice}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary[500]}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="receipt-outline"
            title="No invoices yet"
            description="Invoices will appear here after deliveries are completed"
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  notAuthorized: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  notAuthorizedText: {
    ...typography.body,
    color: colors.text.muted,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  header: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.body,
    color: colors.text.muted,
    marginTop: 2,
  },
  filters: {
    flexDirection: 'row',
    paddingHorizontal: spacing.base,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  filterButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.gray[100],
  },
  filterButtonActive: {
    backgroundColor: colors.primary[500],
  },
  filterButtonText: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
  },
  filterButtonTextActive: {
    color: colors.text.inverse,
  },
  listContent: {
    padding: spacing.base,
    paddingBottom: 100,
  },
  invoiceCard: {
    marginBottom: spacing.md,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  invoiceInfo: {
    flex: 1,
  },
  invoiceNumber: {
    ...typography.bodyMedium,
    color: colors.primary[500],
    marginBottom: 2,
  },
  shopName: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  orderNumber: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: 2,
  },
  invoiceDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  detailText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  signatureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success + '15',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  signatureText: {
    ...typography.caption,
    color: colors.success,
  },
});

