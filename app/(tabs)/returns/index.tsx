import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useReturnStore, useAuthStore } from '../../../src/stores';
import { Card, EmptyState, LoadingSpinner, Badge, Button } from '../../../src/components';
import { colors, typography, spacing, borderRadius } from '../../../src/theme';
import { StockReturn, ReturnStatus } from '../../../src/types/return';
import { useCallback } from 'react';

export default function ReturnsScreen() {
  const { returns, loadReturns, isLoading } = useReturnStore();
  const { user } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | ReturnStatus>('all');

  // Load returns on mount
  useEffect(() => {
    loadReturns();
  }, []);

  // Refresh returns when screen comes into focus (e.g., after return creation or KPO approval)
  useFocusEffect(
    useCallback(() => {
      loadReturns();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReturns();
    setRefreshing(false);
  };

  // Only show returns for salesman
  if (user?.role !== 'salesman') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.notAuthorized}>
          <Ionicons name="lock-closed" size={64} color={colors.gray[300]} />
          <Text style={styles.notAuthorizedText}>
            Stock returns is only available for Salesman
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Filter returns - exclude pending_kpo_approval from "pending" filter (show only truly pending)
  const filteredReturns = returns.filter((returnItem) => {
    if (filter === 'all') return true;
    if (filter === 'pending') {
      // Show only returns that are truly pending (not approved/rejected/processed)
      return returnItem.status === 'pending_kpo_approval' || returnItem.status === 'pending';
    }
    return returnItem.status === filter;
  }).sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // Count pending approvals (for salesman to see)
  const pendingApprovalCount = returns.filter(
    (r) => r.status === 'pending_kpo_approval' || r.status === 'pending'
  ).length;

  const handleCreateReturn = () => {
    router.push('/(tabs)/returns/create');
  };

  const handleReturnPress = (returnId: string) => {
    router.push(`/(tabs)/returns/${returnId}`);
  };

  const renderHeader = () => (
    <View>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Stock Returns</Text>
          <Text style={styles.subtitle}>
            {returns.length} total • {pendingApprovalCount} pending approval
          </Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={handleCreateReturn}>
          <Ionicons name="add" size={24} color={colors.text.inverse} />
        </TouchableOpacity>
      </View>

      <View style={styles.filters}>
        {(['all', 'pending', 'approved', 'processed', 'rejected'] as const).map((filterOption) => (
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

  const renderReturn = ({ item: returnItem }: { item: StockReturn }) => (
    <Card style={styles.returnCard} onPress={() => handleReturnPress(returnItem.id)}>
      <View style={styles.returnHeader}>
        <View style={styles.returnInfo}>
          <Text style={styles.returnNumber}>{returnItem.returnNumber}</Text>
          <Text style={styles.shopName}>{returnItem.shopName}</Text>
          <Text style={styles.ownerName}>{returnItem.ownerName}</Text>
        </View>
        <Badge
          label={returnItem.status.toUpperCase()}
          variant={
            returnItem.status === 'processed'
              ? 'success'
              : returnItem.status === 'rejected'
              ? 'error'
              : returnItem.status === 'approved'
              ? 'info'
              : 'default'
          }
          size="sm"
        />
      </View>

      <View style={styles.returnDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="cube" size={14} color={colors.text.muted} />
          <Text style={styles.detailText}>
            {returnItem.items.length} {returnItem.items.length === 1 ? 'item' : 'items'}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="cash" size={14} color={colors.text.muted} />
          <Text style={styles.detailText}>
            Value: Rs. {returnItem.totalValue.toLocaleString()}
          </Text>
        </View>
        {returnItem.collectedAt && (
          <View style={styles.detailRow}>
            <Ionicons name="time" size={14} color={colors.text.muted} />
            <Text style={styles.detailText}>
              Collected: {new Date(returnItem.collectedAt).toLocaleDateString('en-PK')}
            </Text>
          </View>
        )}
      </View>

      {returnItem.rejectionReason && (
        <View style={styles.rejectionBadge}>
          <Ionicons name="alert-circle" size={14} color={colors.error} />
          <Text style={styles.rejectionText}>{returnItem.rejectionReason}</Text>
        </View>
      )}
    </Card>
  );

  if (isLoading && returns.length === 0) {
    return <LoadingSpinner fullScreen message="Loading returns..." />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={filteredReturns}
        keyExtractor={(item) => item.id}
        renderItem={renderReturn}
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
            icon="return-down-back-outline"
            title="No returns yet"
            description="Record expired or damaged products here"
            actionLabel="Create Return"
            onAction={handleCreateReturn}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
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
  returnCard: {
    marginBottom: spacing.md,
  },
  returnHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  returnInfo: {
    flex: 1,
  },
  returnNumber: {
    ...typography.bodyMedium,
    color: colors.primary[500],
    marginBottom: 2,
  },
  shopName: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  ownerName: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: 2,
  },
  returnDetails: {
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
  rejectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error + '15',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  rejectionText: {
    ...typography.caption,
    color: colors.error,
    flex: 1,
  },
});

