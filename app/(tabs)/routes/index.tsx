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
import { useRouteStore, useAuthStore } from '../../../src/stores';
import { Card, EmptyState, LoadingSpinner, Badge } from '../../../src/components';
import { colors, typography, spacing, borderRadius, shadows } from '../../../src/theme';
import { Route } from '../../../src/types/route';

export default function RoutesScreen() {
  const { routes, loadRoutes, isLoading } = useRouteStore();
  const { user } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'today' | 'active'>('all');

  useEffect(() => {
    loadRoutes();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRoutes();
    setRefreshing(false);
  };

  // Only show routes for bookers
  if (user?.role !== 'booker') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.notAuthorized}>
          <Ionicons name="lock-closed" size={64} color={colors.gray[300]} />
          <Text style={styles.notAuthorizedText}>Route planning is only available for Order Bookers</Text>
        </View>
      </SafeAreaView>
    );
  }

  const today = new Date().toISOString().split('T')[0];
  
  const filteredRoutes = routes.filter((route) => {
    if (filter === 'today') return route.date === today;
    if (filter === 'active') return route.status === 'active';
    return true;
  }).sort((a, b) => {
    // Sort by date descending, then by status
    if (a.date !== b.date) {
      return b.date.localeCompare(a.date);
    }
    const statusOrder = { active: 0, draft: 1, completed: 2, cancelled: 3 };
    return (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
  });

  const handleCreateRoute = () => {
    router.push('/(tabs)/routes/create');
  };

  const handleRoutePress = (routeId: string) => {
    router.push(`/(tabs)/routes/${routeId}`);
  };

  const getStatusColor = (status: Route['status']) => {
    switch (status) {
      case 'active':
        return colors.secondary[500];
      case 'completed':
        return colors.success;
      case 'cancelled':
        return colors.error;
      default:
        return colors.gray[500];
    }
  };

  const renderRoute = ({ item: route }: { item: Route }) => {
    const stats = useRouteStore.getState().calculateRouteStats(route.id);
    
    return (
      <Card style={styles.routeCard} onPress={() => handleRoutePress(route.id)}>
        <View style={styles.routeHeader}>
          <View style={styles.routeInfo}>
            <Text style={styles.routeName}>{route.routeName}</Text>
            <Text style={styles.routeDate}>
              {new Date(route.date).toLocaleDateString('en-PK', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </Text>
          </View>
          <Badge
            label={route.status.toUpperCase()}
            variant={route.status === 'active' ? 'success' : route.status === 'completed' ? 'success' : 'default'}
            size="sm"
          />
        </View>

        <View style={styles.routeStats}>
          <View style={styles.statItem}>
            <Ionicons name="storefront" size={16} color={colors.text.muted} />
            <Text style={styles.statText}>{stats?.totalShops || 0} Shops</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={styles.statText}>{stats?.visitedShops || 0} Visited</Text>
          </View>
          {route.status === 'active' && route.startTime && (
            <View style={styles.statItem}>
              <Ionicons name="time" size={16} color={colors.info} />
              <Text style={styles.statText}>
                Started {new Date(route.startTime).toLocaleTimeString('en-PK', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          )}
        </View>

        {route.status === 'active' && (
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${stats?.completionPercent || 0}%`, backgroundColor: colors.secondary[500] },
              ]}
            />
          </View>
        )}
      </Card>
    );
  };

  if (isLoading && routes.length === 0) {
    return <LoadingSpinner fullScreen message="Loading routes..." />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>My Routes</Text>
        <TouchableOpacity style={styles.addButton} onPress={handleCreateRoute}>
          <Ionicons name="add" size={24} color={colors.text.inverse} />
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View style={styles.filters}>
        {(['all', 'today', 'active'] as const).map((filterOption) => (
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
              {filterOption === 'all' ? 'All' : filterOption === 'today' ? 'Today' : 'Active'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Routes List */}
      <FlatList
        data={filteredRoutes}
        keyExtractor={(item) => item.id}
        renderItem={renderRoute}
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
            icon="map-outline"
            title={filter === 'today' ? 'No routes for today' : filter === 'active' ? 'No active routes' : 'No routes yet'}
            description={
              filter === 'all'
                ? 'Create your first route plan to organize shop visits'
                : 'Create a route to get started'
            }
            actionLabel={filter === 'all' ? 'Create Route' : undefined}
            onAction={filter === 'all' ? handleCreateRoute : undefined}
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
  routeCard: {
    marginBottom: spacing.md,
  },
  routeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  routeInfo: {
    flex: 1,
  },
  routeName: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    marginBottom: 2,
  },
  routeDate: {
    ...typography.caption,
    color: colors.text.muted,
  },
  routeStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statText: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.gray[200],
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  progressFill: {
    height: '100%',
    borderRadius: borderRadius.full,
  },
});

