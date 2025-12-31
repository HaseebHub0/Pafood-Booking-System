import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTargetStore, useAuthStore } from '../../../src/stores';
import { Card, EmptyState, LoadingSpinner, Badge } from '../../../src/components';
import { colors, typography, spacing, borderRadius, shadows } from '../../../src/theme';
import { Target, formatPeriod } from '../../../src/types/targets';

export default function TargetsScreen() {
  const { targets, loadTargets, getCurrentTargets, calculatePerformanceMetrics, isLoading } = useTargetStore();
  const { user } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    totalSales: 0,
    salesTarget: 0,
    salesAchievement: 0,
    newShopsCreated: 0,
    newShopsTarget: 0,
    shopsAchievement: 0,
    recoveryAmount: undefined,
    recoveryTarget: undefined,
    recoveryAchievement: undefined,
    totalVisits: 0,
    visitsTarget: undefined,
    visitsAchievement: undefined,
    overallAchievement: 0,
  });
  const [metricsLoading, setMetricsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    await loadTargets();
    await loadMetrics();
  };

  const loadMetrics = async () => {
    try {
      setMetricsLoading(true);
      const calculatedMetrics = await calculatePerformanceMetrics();
      setMetrics(calculatedMetrics);
    } catch (error) {
      console.error('Error calculating metrics:', error);
    } finally {
      setMetricsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Only show targets for bookers
  if (user?.role !== 'booker') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.notAuthorized}>
          <Ionicons name="lock-closed" size={64} color={colors.gray[300]} />
          <Text style={styles.notAuthorizedText}>
            Targets & Performance is only available for Order Bookers
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentTargets = getCurrentTargets();

  const getAchievementColor = (percent: number) => {
    if (percent >= 100) return colors.success;
    if (percent >= 80) return colors.secondary[500];
    if (percent >= 50) return colors.warning;
    return colors.error;
  };

  const getTargetTypeLabel = (type: string) => {
    const labels: Record<string, { urdu: string; en: string; icon: string }> = {
      orders: { urdu: 'آرڈرز', en: 'Orders', icon: 'receipt' },
      new_shops: { urdu: 'نئی دکانیں', en: 'New Shops', icon: 'storefront' },
      recovery: { urdu: 'ریکوری', en: 'Recovery', icon: 'wallet' },
      visits: { urdu: 'ویزٹس', en: 'Visits', icon: 'location' },
    };
    return labels[type] || { urdu: type, en: type, icon: 'flag' };
  };

  const renderTargetCard = (target: Target) => {
    const achievementColor = getAchievementColor(target.achievementPercent);
    // Orders and shops are count-based, recovery is amount-based
    const currentValue = target.targetType === 'recovery' 
      ? target.currentAmount || 0 
      : target.currentCount || 0;
    const targetValue = target.targetType === 'recovery'
      ? (target.targetAmount || 0)
      : (target.targetCount || 0);
    const targetInfo = getTargetTypeLabel(target.targetType);
    const remaining = Math.max(0, targetValue - currentValue);
    const remainingPercent = targetValue > 0 ? (remaining / targetValue) * 100 : 0;

    return (
      <Card key={target.id} style={styles.targetCard}>
        <View style={styles.targetHeader}>
          <View style={styles.targetInfo}>
            <View style={styles.targetTypeRow}>
              <Ionicons name={targetInfo.icon as any} size={18} color={colors.primary[500]} />
              <Text style={styles.targetType}>
                {targetInfo.en} ({targetInfo.urdu})
              </Text>
            </View>
            <Text style={styles.targetPeriod}>
              {formatPeriod(target.period, target.periodValue)}
            </Text>
          </View>
          <Badge
            label={target.status === 'achieved' ? 'Complete' : target.status === 'exceeded' ? 'Exceeded' : target.status === 'in_progress' ? 'In Progress' : 'Not Started'}
            variant={
              target.status === 'achieved' || target.status === 'exceeded'
                ? 'success'
                : target.status === 'in_progress'
                ? 'info'
                : 'default'
            }
            size="sm"
          />
        </View>

        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Progress (ترقی)</Text>
            <Text style={[styles.progressPercent, { color: achievementColor }]}>
              {target.achievementPercent.toFixed(1)}%
            </Text>
          </View>
          
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(target.achievementPercent, 100)}%`,
                  backgroundColor: achievementColor,
                },
              ]}
            />
          </View>

          <View style={styles.progressDetails}>
            <View style={styles.progressRow}>
              <Text style={styles.progressLabelSmall}>Current (موجودہ):</Text>
              <Text style={styles.currentValue}>
                {target.targetType === 'recovery'
                  ? `Rs. ${currentValue.toLocaleString()}`
                  : `${currentValue}`}
              </Text>
            </View>
            <View style={styles.progressRow}>
              <Text style={styles.progressLabelSmall}>Target (ہدف):</Text>
              <Text style={styles.targetValue}>
                {target.targetType === 'recovery'
                  ? `Rs. ${targetValue.toLocaleString()}`
                  : `${targetValue}`}
              </Text>
            </View>
            {remaining > 0 && (
              <View style={styles.progressRow}>
                <Text style={styles.progressLabelSmall}>Remaining (باقی):</Text>
                <Text style={[styles.remainingValue, { color: colors.error }]}>
                  {target.targetType === 'sales' || target.targetType === 'recovery'
                    ? `Rs. ${remaining.toLocaleString()}`
                    : `${remaining}`}
                  {' '}({remainingPercent.toFixed(1)}%)
                </Text>
              </View>
            )}
          </View>
        </View>

        {target.notes && (
          <View style={styles.notesContainer}>
            <Ionicons name="information-circle-outline" size={16} color={colors.text.muted} />
            <Text style={styles.targetNotes}>{target.notes}</Text>
          </View>
        )}
      </Card>
    );
  };

  if ((isLoading || metricsLoading) && targets.length === 0) {
    return <LoadingSpinner fullScreen message="Loading targets and performance data..." />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary[500]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Performance & Targets</Text>
          <Text style={styles.subtitle}>{user?.name || 'Booker'}</Text>
        </View>

        {/* Overall Performance */}
        <Card style={styles.overallCard}>
          <View style={styles.overallHeader}>
            <View>
              <Text style={styles.overallTitle}>Overall Performance</Text>
              <Text style={styles.overallSubtitle}>
                Current Month: {new Date().toLocaleDateString('en-PK', { month: 'long', year: 'numeric' })}
              </Text>
            </View>
            <TouchableOpacity onPress={loadMetrics}>
              <Ionicons 
                name="refresh" 
                size={20} 
                color={colors.primary[500]} 
              />
            </TouchableOpacity>
          </View>
          
          <View style={styles.overallProgress}>
            <View style={[
              styles.overallCircle,
              { borderColor: getAchievementColor(metrics.overallAchievement) }
            ]}>
              <Text style={[styles.overallPercent, { color: getAchievementColor(metrics.overallAchievement) }]}>
                {metrics.overallAchievement.toFixed(0)}%
              </Text>
              <Text style={styles.overallLabel}>Overall Achievement</Text>
            </View>
          </View>

          {/* Detailed Metrics */}
          <View style={styles.metricsContainer}>
            {/* Orders Metric */}
            <Card style={styles.metricCard}>
              <View style={styles.metricHeader}>
                <View style={[styles.metricIcon, { backgroundColor: colors.primary[50] }]}>
                  <Ionicons name="receipt" size={20} color={colors.primary[500]} />
                </View>
                <View style={styles.metricInfo}>
                  <Text style={styles.metricLabel}>Orders Target (آرڈرز ہدف)</Text>
                  <Text style={styles.metricDescription}>
                    {Math.round(metrics.salesAchievement * (metrics.salesTarget || 1) / 100)} / {metrics.salesTarget} orders booked
                  </Text>
                  {metrics.salesTarget > 0 && (
                    <Text style={styles.metricRemaining}>
                      Remaining: {Math.max(0, metrics.salesTarget - Math.round(metrics.salesAchievement * metrics.salesTarget / 100))} orders
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.metricProgressBar}>
                <View
                  style={[
                    styles.metricProgressFill,
                    {
                      width: `${Math.min(metrics.salesAchievement, 100)}%`,
                      backgroundColor: getAchievementColor(metrics.salesAchievement),
                    },
                  ]}
                />
              </View>
              <Text style={[styles.metricPercent, { color: getAchievementColor(metrics.salesAchievement) }]}>
                {metrics.salesAchievement.toFixed(1)}% Complete
              </Text>
            </Card>

            {/* Shops Metric */}
            <Card style={styles.metricCard}>
              <View style={styles.metricHeader}>
                <View style={[styles.metricIcon, { backgroundColor: colors.secondary[50] }]}>
                  <Ionicons name="storefront" size={20} color={colors.secondary[500]} />
                </View>
                <View style={styles.metricInfo}>
                  <Text style={styles.metricLabel}>New Shops (نئی دکانیں)</Text>
                  <Text style={styles.metricDescription}>
                    {metrics.newShopsCreated} / {metrics.newShopsTarget} shops created
                  </Text>
                  {metrics.newShopsTarget > 0 && (
                    <Text style={styles.metricRemaining}>
                      Remaining: {Math.max(0, metrics.newShopsTarget - metrics.newShopsCreated)} shops
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.metricProgressBar}>
                <View
                  style={[
                    styles.metricProgressFill,
                    {
                      width: `${Math.min(metrics.shopsAchievement, 100)}%`,
                      backgroundColor: getAchievementColor(metrics.shopsAchievement),
                    },
                  ]}
                />
              </View>
              <Text style={[styles.metricPercent, { color: getAchievementColor(metrics.shopsAchievement) }]}>
                {metrics.shopsAchievement.toFixed(1)}% Complete
              </Text>
            </Card>

            {/* Recovery Metric */}
            {metrics.recoveryTarget && metrics.recoveryTarget > 0 && (
              <Card style={styles.metricCard}>
                <View style={styles.metricHeader}>
                  <View style={[styles.metricIcon, { backgroundColor: colors.success + '20' }]}>
                    <Ionicons name="wallet" size={20} color={colors.success} />
                  </View>
                  <View style={styles.metricInfo}>
                    <Text style={styles.metricLabel}>Recovery (ریکوری)</Text>
                    <Text style={styles.metricDescription}>
                      Rs. {(metrics.recoveryAmount || 0).toLocaleString()} / Rs. {metrics.recoveryTarget.toLocaleString()}
                    </Text>
                    <Text style={styles.metricRemaining}>
                      Remaining: Rs. {Math.max(0, metrics.recoveryTarget - (metrics.recoveryAmount || 0)).toLocaleString()}
                    </Text>
                  </View>
                </View>
                <View style={styles.metricProgressBar}>
                  <View
                    style={[
                      styles.metricProgressFill,
                      {
                        width: `${Math.min(metrics.recoveryAchievement || 0, 100)}%`,
                        backgroundColor: getAchievementColor(metrics.recoveryAchievement || 0),
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.metricPercent, { color: getAchievementColor(metrics.recoveryAchievement || 0) }]}>
                  {(metrics.recoveryAchievement || 0).toFixed(1)}% Complete
                </Text>
              </Card>
            )}
          </View>
        </Card>

        {/* Current Targets */}
        <Text style={styles.sectionTitle}>
          Current Targets ({currentTargets.length})
        </Text>
        {currentTargets.length > 0 ? (
          currentTargets.map(renderTargetCard)
        ) : (
          <Card style={styles.emptyCard}>
            <Ionicons name="flag-outline" size={40} color={colors.gray[300]} />
            <Text style={styles.emptyText}>No active targets</Text>
            <Text style={styles.emptySubtext}>Targets will appear here when assigned</Text>
          </Card>
        )}

        {/* All Targets */}
        {targets.length > currentTargets.length && (
          <>
            <Text style={styles.sectionTitle}>All Targets ({targets.length})</Text>
            {targets
              .filter((t) => !currentTargets.find((ct) => ct.id === t.id))
              .map(renderTargetCard)}
          </>
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
    paddingBottom: 100,
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
    marginBottom: spacing.lg,
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
  overallCard: {
    marginBottom: spacing.lg,
    paddingVertical: spacing.lg,
  },
  overallHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  overallTitle: {
    ...typography.h3,
    color: colors.text.primary,
    fontWeight: '700',
  },
  overallSubtitle: {
    ...typography.caption,
    color: colors.text.muted,
    marginBottom: spacing.lg,
  },
  overallProgress: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  overallCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  overallPercent: {
    fontSize: 36,
    fontWeight: '800',
    marginBottom: 4,
  },
  overallLabel: {
    ...typography.caption,
    color: colors.text.muted,
    fontSize: 12,
  },
  metricsContainer: {
    gap: spacing.md,
  },
  metricCard: {
    padding: spacing.md,
    marginBottom: 0,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  metricIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  metricInfo: {
    flex: 1,
  },
  metricLabel: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: 2,
  },
  metricDescription: {
    ...typography.caption,
    color: colors.text.muted,
  },
  metricProgressBar: {
    height: 10,
    backgroundColor: colors.gray[200],
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  metricProgressFill: {
    height: '100%',
    borderRadius: borderRadius.full,
  },
  metricPercent: {
    ...typography.bodyMedium,
    fontWeight: '600',
    textAlign: 'right',
  },
  metricRemaining: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: 2,
    fontSize: 11,
  },
  metricFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricDays: {
    ...typography.caption,
    color: colors.text.muted,
    fontSize: 11,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text.primary,
    marginBottom: spacing.md,
    marginTop: spacing.lg,
  },
  targetCard: {
    marginBottom: spacing.md,
  },
  targetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  targetInfo: {
    flex: 1,
  },
  targetTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 4,
  },
  targetType: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    fontWeight: '600',
  },
  targetPeriod: {
    ...typography.caption,
    color: colors.text.muted,
    marginLeft: 24,
  },
  progressSection: {
    marginTop: spacing.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  progressLabel: {
    ...typography.body,
    color: colors.text.secondary,
  },
  progressPercent: {
    ...typography.h4,
    fontWeight: '700',
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.gray[200],
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  progressFill: {
    height: '100%',
    borderRadius: borderRadius.full,
  },
  progressDetails: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabelSmall: {
    ...typography.caption,
    color: colors.text.muted,
  },
  currentValue: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    fontWeight: '600',
  },
  targetValue: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  remainingValue: {
    ...typography.bodyMedium,
    fontWeight: '600',
  },
  notesContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.xs,
  },
  targetNotes: {
    ...typography.caption,
    color: colors.text.muted,
    flex: 1,
    fontStyle: 'italic',
  },
  emptyCard: {
    alignItems: 'center',
    padding: spacing['2xl'],
  },
  emptyText: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  emptySubtext: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
});

