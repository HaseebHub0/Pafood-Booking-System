import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouteStore, useShopStore, useVisitStore, useAuthStore } from '../../../src/stores';
import { Button, Card, Badge, LoadingSpinner } from '../../../src/components';
import { colors, typography, spacing, borderRadius, shadows } from '../../../src/theme';
import { RouteShop } from '../../../src/types/route';
import RouteMapView from '../../../src/components/maps/RouteMapView';

export default function RouteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getRouteById, startRoute, completeRoute, updateShopStatus, deleteRoute } = useRouteStore();
  const { getShopById } = useShopStore();
  const { startVisit } = useVisitStore();
  const { user } = useAuthStore();
  
  const route = getRouteById(id || '');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!route) {
    return (
      <View style={styles.notFound}>
        <Ionicons name="alert-circle-outline" size={64} color={colors.gray[300]} />
        <Text style={styles.notFoundText}>Route not found</Text>
        <Button title="Go Back" onPress={() => router.back()} variant="outline" />
      </View>
    );
  }

  const stats = useRouteStore.getState().calculateRouteStats(route.id);
  const isBooker = user?.role === 'booker';

  const handleStartRoute = async () => {
    Alert.alert(
      'Start Route',
      'Are you ready to start this route? GPS tracking will begin.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start',
          onPress: async () => {
            setIsProcessing(true);
            await startRoute(route.id);
            setIsProcessing(false);
          },
        },
      ]
    );
  };

  const handleCompleteRoute = async () => {
    Alert.alert(
      'Complete Route',
      'Mark this route as completed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          onPress: async () => {
            setIsProcessing(true);
            await completeRoute(route.id);
            setIsProcessing(false);
            router.back();
          },
        },
      ]
    );
  };

  const handleShopStatusChange = async (
    shopId: string,
    currentStatus: RouteShop['status'],
    shopName: string
  ) => {
    if (route.status !== 'active') {
      Alert.alert('Info', 'Please start the route first');
      return;
    }

    let newStatus: RouteShop['status'] = 'visited';
    if (currentStatus === 'pending') {
      // Show options: Visited or Skipped
      Alert.alert(
        `Update ${shopName}`,
        'Select visit status:',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Visited',
            onPress: async () => {
              setIsProcessing(true);
              await updateShopStatus(route.id, shopId, 'visited');
              setIsProcessing(false);
            },
          },
          {
            text: 'Skipped',
            onPress: async () => {
              Alert.prompt(
                'Skip Reason',
                'Why is this shop being skipped?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Skip',
                    onPress: async (reason) => {
                      setIsProcessing(true);
                      await updateShopStatus(route.id, shopId, 'skipped', reason || undefined);
                      setIsProcessing(false);
                    },
                  },
                ],
                'plain-text'
              );
            },
          },
        ]
      );
    } else if (currentStatus === 'visited') {
      // Can mark as skipped
      Alert.alert(
        'Change Status',
        'Mark this shop as skipped?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Skip',
            onPress: async () => {
              setIsProcessing(true);
              await updateShopStatus(route.id, shopId, 'skipped');
              setIsProcessing(false);
            },
          },
        ]
      );
    } else {
      // Skipped - can mark as visited
      Alert.alert(
        'Change Status',
        'Mark this shop as visited?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Visited',
            onPress: async () => {
              setIsProcessing(true);
              await updateShopStatus(route.id, shopId, 'visited');
              setIsProcessing(false);
            },
          },
        ]
      );
    }
  };

  const handleVisitShop = async (shopId: string) => {
    if (route.status !== 'active') {
      Alert.alert('Info', 'Please start the route first');
      return;
    }

    const shop = getShopById(shopId);
    if (!shop) return;

    setIsProcessing(true);
    try {
      const visit = await startVisit({
        shopId,
        visitType: 'order',
      });

      if (visit) {
        // Navigate to order creation
        router.push({
          pathname: '/(tabs)/orders/create/products',
          params: { shopId, visitId: visit.id },
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to start visit');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Route',
      'Are you sure you want to delete this route?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteRoute(route.id);
            router.back();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Route Header */}
        <Card style={styles.headerCard}>
          <View style={styles.headerRow}>
            <View style={styles.headerInfo}>
              <Text style={styles.routeName}>{route.routeName}</Text>
              <Text style={styles.routeDate}>
                {new Date(route.date).toLocaleDateString('en-PK', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </Text>
            </View>
            <Badge
              label={route.status.toUpperCase()}
              variant={
                route.status === 'active'
                  ? 'success'
                  : route.status === 'completed'
                  ? 'success'
                  : 'default'
              }
              size="md"
            />
          </View>

          {/* Stats */}
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{stats?.totalShops || 0}</Text>
              <Text style={styles.statLabel}>Total Shops</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: colors.success }]}>
                {stats?.visitedShops || 0}
              </Text>
              <Text style={styles.statLabel}>Visited</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: colors.warning }]}>
                {stats?.pendingShops || 0}
              </Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: colors.error }]}>
                {stats?.skippedShops || 0}
              </Text>
              <Text style={styles.statLabel}>Skipped</Text>
            </View>
          </View>

          {/* Progress */}
          {route.status === 'active' && (
            <View style={styles.progressSection}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${stats?.completionPercent || 0}%`,
                      backgroundColor: colors.secondary[500],
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {Math.round(stats?.completionPercent || 0)}% Complete
              </Text>
            </View>
          )}

          {/* Timing */}
          {route.startTime && (
            <View style={styles.timingRow}>
              <Ionicons name="time-outline" size={16} color={colors.text.muted} />
              <Text style={styles.timingText}>
                Started: {new Date(route.startTime).toLocaleTimeString('en-PK', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          )}
        </Card>

        {/* Route Map View */}
        {isBooker && route.status === 'active' && (
          <View>
            <Text style={styles.sectionTitle}>Route Map</Text>
            <RouteMapView 
              route={route}
              shops={route.shops.map(rs => getShopById(rs.shopId)).filter((s): s is NonNullable<typeof s> => s !== null)}
            />
          </View>
        )}

        {/* Shops List */}
        <Text style={styles.sectionTitle}>Shops ({route.shops.length})</Text>
        {route.shops.map((routeShop, index) => {
          const shop = getShopById(routeShop.shopId);
          if (!shop) return null;

          return (
            <Card key={routeShop.shopId} style={styles.shopCard}>
              <View style={styles.shopHeader}>
                <View style={styles.shopSequence}>
                  <Text style={styles.sequenceNumber}>{routeShop.sequence}</Text>
                </View>
                <View style={styles.shopInfo}>
                  <Text style={styles.shopName}>{shop.shopName}</Text>
                  <Text style={styles.shopOwner}>{shop.ownerName}</Text>
                  <Text style={styles.shopAddress}>{shop.address}</Text>
                </View>
                <Badge
                  label={routeShop.status.toUpperCase()}
                  variant={
                    routeShop.status === 'visited'
                      ? 'success'
                      : routeShop.status === 'skipped'
                      ? 'error'
                      : 'default'
                  }
                  size="sm"
                />
              </View>

              {routeShop.notes && (
                <Text style={styles.shopNotes}>{routeShop.notes}</Text>
              )}

              {routeShop.actualArrival && (
                <Text style={styles.arrivalTime}>
                  Arrived: {new Date(routeShop.actualArrival).toLocaleTimeString('en-PK', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              )}

              {/* Actions */}
              {route.status === 'active' && isBooker && (
                <View style={styles.shopActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleShopStatusChange(routeShop.shopId, routeShop.status, shop.shopName)}
                  >
                    <Ionicons
                      name={routeShop.status === 'visited' ? 'checkmark-circle' : routeShop.status === 'skipped' ? 'close-circle' : 'ellipse-outline'}
                      size={20}
                      color={colors.primary[500]}
                    />
                    <Text style={styles.actionText}>
                      {routeShop.status === 'visited'
                        ? 'Mark Skipped'
                        : routeShop.status === 'skipped'
                        ? 'Mark Visited'
                        : 'Update Status'}
                    </Text>
                  </TouchableOpacity>
                  {routeShop.status === 'pending' && (
                    <TouchableOpacity
                      style={[styles.actionButton, styles.primaryAction]}
                      onPress={() => handleVisitShop(routeShop.shopId)}
                    >
                      <Ionicons name="cart" size={20} color={colors.text.inverse} />
                      <Text style={[styles.actionText, { color: colors.text.inverse }]}>
                        Create Order
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </Card>
          );
        })}

        {/* Delete Button */}
        {route.status === 'draft' && isBooker && (
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={20} color={colors.error} />
            <Text style={styles.deleteText}>Delete Route</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Footer Actions */}
      {isBooker && (
        <View style={styles.footer}>
          {route.status === 'draft' && (
            <Button
              title="Start Route"
              onPress={handleStartRoute}
              loading={isProcessing}
              fullWidth
              size="lg"
              icon={<Ionicons name="play" size={20} color={colors.text.inverse} />}
            />
          )}
          {route.status === 'active' && (
            <Button
              title="Complete Route"
              onPress={handleCompleteRoute}
              loading={isProcessing}
              fullWidth
              size="lg"
              variant="secondary"
              icon={<Ionicons name="checkmark-circle" size={20} color={colors.text.inverse} />}
            />
          )}
        </View>
      )}
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
    marginBottom: spacing.md,
  },
  headerInfo: {
    flex: 1,
  },
  routeName: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: 2,
  },
  routeDate: {
    ...typography.body,
    color: colors.text.secondary,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statBox: {
    flex: 1,
    minWidth: '22%',
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    alignItems: 'center',
  },
  statValue: {
    ...typography.h4,
    color: colors.text.primary,
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: 2,
  },
  progressSection: {
    marginTop: spacing.md,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.gray[200],
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  progressFill: {
    height: '100%',
    borderRadius: borderRadius.full,
  },
  progressText: {
    ...typography.caption,
    color: colors.text.muted,
    textAlign: 'center',
  },
  timingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.xs,
  },
  timingText: {
    ...typography.caption,
    color: colors.text.muted,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  shopCard: {
    marginBottom: spacing.md,
  },
  shopHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  shopSequence: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  sequenceNumber: {
    ...typography.bodyMedium,
    color: colors.text.inverse,
    fontWeight: '700',
  },
  shopInfo: {
    flex: 1,
  },
  shopName: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  shopOwner: {
    ...typography.caption,
    color: colors.text.secondary,
    marginTop: 2,
  },
  shopAddress: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: 2,
  },
  shopNotes: {
    ...typography.caption,
    color: colors.text.muted,
    fontStyle: 'italic',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  arrivalTime: {
    ...typography.caption,
    color: colors.info,
    marginTop: spacing.xs,
  },
  shopActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  primaryAction: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },
  actionText: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  deleteText: {
    ...typography.body,
    color: colors.error,
  },
  footer: {
    padding: spacing.base,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});

