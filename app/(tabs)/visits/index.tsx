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
import { useVisitStore, useAuthStore, useShopStore } from '../../../src/stores';
import { Card, EmptyState, LoadingSpinner, Badge } from '../../../src/components';
import { colors, typography, spacing, borderRadius } from '../../../src/theme';
import { Visit } from '../../../src/types/visit';

export default function VisitsScreen() {
  const { visits, loadVisits, getVisitsByDate, getDailySummary } = useVisitStore();
  const { user } = useAuthStore();
  const { getShopById } = useShopStore();
  const [refreshing, setRefreshing] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const todayVisits = getVisitsByDate(today);
  const summary = getDailySummary(today);

  useEffect(() => {
    loadVisits();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadVisits();
    setRefreshing(false);
  };

  // Only show visits for bookers
  if (user?.role !== 'booker') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.notAuthorized}>
          <Ionicons name="lock-closed" size={64} color={colors.gray[300]} />
          <Text style={styles.notAuthorizedText}>
            Visit tracking is only available for Order Bookers
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const renderHeader = () => (
    <View>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Today's Visits</Text>
          <Text style={styles.date}>
            {new Date().toLocaleDateString('en-PK', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.reportButton}
          onPress={() => router.push('/(tabs)/visits/report')}
        >
          <Ionicons name="document-text" size={20} color={colors.primary[500]} />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      {summary && (
        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{summary.visitedShops}</Text>
            <Text style={styles.statLabel}>Visited</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{summary.skippedShops}</Text>
            <Text style={styles.statLabel}>Skipped</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{summary.ordersCreated}</Text>
            <Text style={styles.statLabel}>Orders</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>
              {summary.visitStats.averageVisitDuration.toFixed(0)}m
            </Text>
            <Text style={styles.statLabel}>Avg Time</Text>
          </Card>
        </View>
      )}
    </View>
  );

  const renderVisit = ({ item: visit }: { item: Visit }) => {
    const shop = getShopById(visit.shopId);
    
    return (
      <Card style={styles.visitCard}>
        <View style={styles.visitHeader}>
          <View style={styles.visitInfo}>
            <Text style={styles.shopName}>{visit.shopName}</Text>
            <Text style={styles.visitType}>{visit.visitType.replace('_', ' ').toUpperCase()}</Text>
          </View>
          <Badge
            label={visit.status.replace('_', ' ').toUpperCase()}
            variant={
              visit.status === 'completed'
                ? 'success'
                : visit.status === 'skipped'
                ? 'error'
                : visit.status === 'in_progress'
                ? 'info'
                : 'default'
            }
            size="sm"
          />
        </View>

        <View style={styles.visitDetails}>
          {visit.startTime && (
            <View style={styles.detailRow}>
              <Ionicons name="time-outline" size={14} color={colors.text.muted} />
              <Text style={styles.detailText}>
                {new Date(visit.startTime).toLocaleTimeString('en-PK', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {visit.endTime &&
                  ` - ${new Date(visit.endTime).toLocaleTimeString('en-PK', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}`}
              </Text>
            </View>
          )}
          {visit.duration && (
            <View style={styles.detailRow}>
              <Ionicons name="hourglass-outline" size={14} color={colors.text.muted} />
              <Text style={styles.detailText}>{visit.duration} minutes</Text>
            </View>
          )}
          {visit.location && (
            <View style={styles.detailRow}>
              <Ionicons name="location" size={14} color={colors.text.muted} />
              <Text style={styles.detailText}>
                GPS: {visit.location.latitude.toFixed(4)}, {visit.location.longitude.toFixed(4)}
              </Text>
            </View>
          )}
          {visit.orderCreated && visit.orderNumber && (
            <View style={styles.detailRow}>
              <Ionicons name="cart" size={14} color={colors.success} />
              <Text style={[styles.detailText, { color: colors.success }]}>
                Order: {visit.orderNumber}
              </Text>
            </View>
          )}
        </View>

        {visit.skipReason && (
          <View style={styles.skipReason}>
            <Ionicons name="information-circle" size={14} color={colors.warning} />
            <Text style={styles.skipText}>
              Skipped: {visit.skipReason.replace('_', ' ')}
            </Text>
          </View>
        )}

        {visit.notes && (
          <Text style={styles.visitNotes}>{visit.notes}</Text>
        )}
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={todayVisits}
        keyExtractor={(item) => item.id}
        renderItem={renderVisit}
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
            icon="walk-outline"
            title="No visits today"
            description="Start a route or visit shops to track your visits"
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
  date: {
    ...typography.body,
    color: colors.text.muted,
    marginTop: 2,
  },
  reportButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    padding: spacing.sm,
    alignItems: 'center',
  },
  statValue: {
    ...typography.h4,
    color: colors.primary[500],
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: 2,
  },
  listContent: {
    padding: spacing.base,
    paddingBottom: 100,
  },
  visitCard: {
    marginBottom: spacing.md,
  },
  visitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  visitInfo: {
    flex: 1,
  },
  shopName: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    marginBottom: 2,
  },
  visitType: {
    ...typography.caption,
    color: colors.text.muted,
  },
  visitDetails: {
    marginTop: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  detailText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  skipReason: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warning + '15',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  skipText: {
    ...typography.caption,
    color: colors.warning,
    flex: 1,
  },
  visitNotes: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    fontStyle: 'italic',
  },
});

