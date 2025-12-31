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
import { useDailyReportStore, useAuthStore } from '../../../src/stores';
import { Card, Badge, EmptyState, LoadingSpinner } from '../../../src/components';
import { colors, typography, spacing, borderRadius, shadows } from '../../../src/theme';
import { DailyReport, ReportStatus } from '../../../src/types';

type FilterOption = 'all' | ReportStatus;

const FILTER_OPTIONS: { label: string; value: FilterOption }[] = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Submitted', value: 'submitted' },
];

export default function ReportsListScreen() {
  const { reports, loadReports, isLoading } = useDailyReportStore();
  const { user } = useAuthStore();
  const [filter, setFilter] = useState<FilterOption>('all');
  const [refreshing, setRefreshing] = useState(false);

  // Only allow salesmen - bookers should not access this
  const isSalesman = user?.role === 'salesman';

  useEffect(() => {
    if (isSalesman) {
      loadReports();
    }
  }, [isSalesman]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReports();
    setRefreshing(false);
  };

  const filteredReports = filter === 'all' 
    ? reports 
    : reports.filter(r => r.status === filter);

  const sortedReports = [...filteredReports].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const handleReportPress = (report: DailyReport) => {
    router.push(`/(tabs)/reports/${report.id}`);
  };

  const handleCreateReport = () => {
    router.push('/(tabs)/reports/create');
  };

  const getStatusColor = (status: ReportStatus) => {
    switch (status) {
      case 'draft':
        return colors.warning;
      case 'submitted':
        return colors.success;
      default:
        return colors.gray[500];
    }
  };

  const renderReport = ({ item }: { item: DailyReport }) => (
    <TouchableOpacity
      style={styles.reportCard}
      onPress={() => handleReportPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.reportHeader}>
        <View style={styles.reportInfo}>
          <Text style={styles.reportNumber}>{item.reportNumber}</Text>
          <Text style={styles.reportDate}>
            {new Date(item.date).toLocaleDateString('en-PK', {
              weekday: 'short',
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </Text>
        </View>
        <Badge
          label={item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          color={getStatusColor(item.status)}
        />
      </View>

      <View style={styles.reportDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="navigate-outline" size={16} color={colors.text.muted} />
          <Text style={styles.detailText}>{item.routeName || 'No route'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="person-outline" size={16} color={colors.text.muted} />
          <Text style={styles.detailText}>{item.bookerName}</Text>
        </View>
      </View>

      <View style={styles.reportFooter}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Total Sale</Text>
          <Text style={styles.statValue}>
            Rs. {item.totals.totalSale.toLocaleString()}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Cash</Text>
          <Text style={styles.statValue}>
            Rs. {item.cashDeposit.total.toLocaleString()}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Credit</Text>
          <Text style={styles.statValue}>
            Rs. {item.totals.credit.toLocaleString()}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  // Block bookers from accessing Daily Sale Reports
  if (!isSalesman) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.notAuthorized}>
          <Ionicons name="lock-closed" size={64} color={colors.gray[300]} />
          <Text style={styles.notAuthorizedText}>
            Daily Sale Reports are only available for Salesman
          </Text>
          <Text style={styles.notAuthorizedSubtext}>
            Bookers can view Targets & Performance instead
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading && reports.length === 0) {
    return <LoadingSpinner />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Daily Sale Reports</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleCreateReport}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={24} color={colors.text.inverse} />
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <FlatList
          horizontal
          data={FILTER_OPTIONS}
          keyExtractor={(item) => item.value}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterButton,
                filter === item.value && styles.filterButtonActive,
              ]}
              onPress={() => setFilter(item.value)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterText,
                  filter === item.value && styles.filterTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Stats Summary */}
      {sortedReports.length > 0 && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{sortedReports.length}</Text>
            <Text style={styles.summaryLabel}>Reports</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>
              {sortedReports.filter(r => r.status === 'submitted').length}
            </Text>
            <Text style={styles.summaryLabel}>Submitted</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>
              {sortedReports.filter(r => r.status === 'draft').length}
            </Text>
            <Text style={styles.summaryLabel}>Drafts</Text>
          </View>
        </View>
      )}

      {/* Reports List */}
      <FlatList
        data={sortedReports}
        keyExtractor={(item) => item.id}
        renderItem={renderReport}
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
            icon="document-text-outline"
            title="No sale reports yet"
            description="Create your first daily sale report"
            actionLabel="New Sale Report"
            onAction={handleCreateReport}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.text.primary,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  filtersContainer: {
    marginBottom: spacing.md,
  },
  filtersList: {
    paddingHorizontal: spacing.base,
    gap: spacing.sm,
  },
  filterButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray[100],
    marginRight: spacing.sm,
  },
  filterButtonActive: {
    backgroundColor: colors.primary[500],
  },
  filterText: {
    ...typography.captionMedium,
    color: colors.text.secondary,
  },
  filterTextActive: {
    color: colors.text.inverse,
  },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    marginHorizontal: spacing.base,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    ...typography.h3,
    color: colors.primary[500],
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.text.muted,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  listContent: {
    padding: spacing.base,
    paddingTop: 0,
    paddingBottom: 100,
  },
  reportCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  reportInfo: {},
  reportNumber: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  reportDate: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: 2,
  },
  reportDetails: {
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
    marginBottom: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  detailText: {
    ...typography.body,
    color: colors.text.secondary,
  },
  reportFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.muted,
  },
  statValue: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    marginTop: 2,
  },
  notAuthorized: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  notAuthorizedText: {
    ...typography.h4,
    color: colors.text.muted,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  notAuthorizedSubtext: {
    ...typography.body,
    color: colors.text.muted,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});

