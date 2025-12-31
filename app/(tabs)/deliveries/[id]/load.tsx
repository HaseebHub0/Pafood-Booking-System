import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useLoadFormStore,
  useDeliveryStore,
  useAuthStore,
} from '../../../../src/stores';
import { Button, Card, LoadingSpinner } from '../../../../src/components';
import { colors, typography, spacing, borderRadius } from '../../../../src/theme';
import { LoadFormItem } from '../../../../src/types/loadForm';

export default function LoadFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getDeliveryById } = useDeliveryStore();
  const {
    createLoadFormFromDelivery,
    getLoadFormByDelivery,
    confirmLoad,
    markLoaded,
  } = useLoadFormStore();
  const { user } = useAuthStore();

  const delivery = getDeliveryById(id || '');
  const [loadForm, setLoadForm] = useState(getLoadFormByDelivery(id || ''));
  const [confirmedQuantities, setConfirmedQuantities] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (delivery && !loadForm) {
      createLoadFormFromDelivery(delivery.id).then((form) => {
        if (form) {
          setLoadForm(form);
          // Initialize confirmed quantities with order quantities
          const initialQuantities: Record<string, number> = {};
          form.items.forEach((item) => {
            initialQuantities[item.productId] = item.quantity;
          });
          setConfirmedQuantities(initialQuantities);
        }
      });
    }
  }, [delivery]);

  if (!delivery) {
    return (
      <View style={styles.notFound}>
        <Ionicons name="alert-circle-outline" size={64} color={colors.gray[300]} />
        <Text style={styles.notFoundText}>Delivery not found</Text>
        <Button title="Go Back" onPress={() => router.back()} variant="outline" />
      </View>
    );
  }

  if (!loadForm) {
    return <LoadingSpinner fullScreen message="Loading load form..." />;
  }

  const handleQuantityChange = (productId: string, change: number) => {
    const currentQty = confirmedQuantities[productId] || loadForm.items.find((i) => i.productId === productId)?.quantity || 0;
    const newQty = Math.max(0, currentQty + change);
    setConfirmedQuantities({
      ...confirmedQuantities,
      [productId]: newQty,
    });
  };

  const handleConfirmLoad = async () => {
    // Validate that at least some quantity is confirmed for each item
    const hasZeroQuantities = loadForm.items.some((item) => {
      const confirmedQty = confirmedQuantities[item.productId] || 0;
      return confirmedQty === 0;
    });

    if (hasZeroQuantities) {
      Alert.alert('Error', 'Please confirm quantity for all items or set to 0 explicitly');
      return;
    }

    setIsProcessing(true);
    try {
      await confirmLoad(loadForm.id, {
        deliveryId: delivery.id,
        confirmedQuantities,
        notes,
      });
      Alert.alert('Success', 'Load form confirmed!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to confirm load form');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMarkLoaded = async () => {
    Alert.alert(
      'Mark as Loaded',
      'Have you physically loaded all items into the delivery van?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Loaded',
          onPress: async () => {
            setIsProcessing(true);
            await markLoaded(loadForm.id);
            setIsProcessing(false);
            Alert.alert('Success', 'Load marked as complete!', [
              { text: 'OK', onPress: () => router.back() },
            ]);
          },
        },
      ]
    );
  };

  const totalConfirmedQuantity = Object.values(confirmedQuantities).reduce(
    (sum, qty) => sum + qty,
    0
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Info */}
        <Card style={styles.headerCard}>
          <View style={styles.headerRow}>
            <Ionicons name="cube" size={24} color={colors.primary[500]} />
            <View style={styles.headerInfo}>
              <Text style={styles.orderNumber}>{loadForm.orderNumber}</Text>
              <Text style={styles.shopName}>{loadForm.shopName}</Text>
            </View>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Status:</Text>
            <Text
              style={[
                styles.statusValue,
                loadForm.status === 'loaded' && { color: colors.success },
                loadForm.status === 'confirmed' && { color: colors.info },
              ]}
            >
              {loadForm.status === 'pending'
                ? 'Pending Confirmation'
                : loadForm.status === 'confirmed'
                ? 'Confirmed - Ready to Load'
                : 'Loaded'}
            </Text>
          </View>
        </Card>

        {/* Instructions */}
        <Card style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="information-circle" size={20} color={colors.info} />
            <Text style={styles.infoText}>
              Warehouse will prepare stock based on this list. Confirm quantities before loading.
            </Text>
          </View>
        </Card>

        {/* Items List */}
        <Text style={styles.sectionTitle}>
          Items to Load ({loadForm.items.length})
        </Text>
        {loadForm.items.map((item) => {
          const confirmedQty = confirmedQuantities[item.productId] ?? item.quantity;
          return (
            <Card key={item.productId} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.productName}</Text>
                  <Text style={styles.itemUnit}>{item.unit}</Text>
                </View>
              </View>

              <View style={styles.quantitySection}>
                <View style={styles.quantityRow}>
                  <Text style={styles.quantityLabel}>Order Quantity:</Text>
                  <Text style={styles.orderQuantity}>{item.quantity}</Text>
                </View>

                {loadForm.status === 'pending' && (
                  <View style={styles.confirmQuantityRow}>
                    <Text style={styles.quantityLabel}>Confirm Quantity:</Text>
                    <View style={styles.quantityControls}>
                      <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() => handleQuantityChange(item.productId, -1)}
                      >
                        <Ionicons name="remove" size={18} color={colors.primary[500]} />
                      </TouchableOpacity>
                      <Text style={styles.confirmedQuantity}>{confirmedQty}</Text>
                      <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() => handleQuantityChange(item.productId, 1)}
                      >
                        <Ionicons name="add" size={18} color={colors.primary[500]} />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {loadForm.status !== 'pending' && (
                  <View style={styles.confirmQuantityRow}>
                    <Text style={styles.quantityLabel}>Confirmed Quantity:</Text>
                    <Text style={styles.confirmedQuantity}>{item.confirmedQuantity || item.quantity}</Text>
                  </View>
                )}
              </View>
            </Card>
          );
        })}

        {/* Summary */}
        <Card style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Items:</Text>
            <Text style={styles.summaryValue}>
              {loadForm.status === 'pending'
                ? totalConfirmedQuantity
                : loadForm.items.reduce((sum, item) => sum + (item.confirmedQuantity || item.quantity), 0)}
            </Text>
          </View>
          {loadForm.confirmedAt && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Confirmed At:</Text>
              <Text style={styles.summaryValue}>
                {new Date(loadForm.confirmedAt).toLocaleString('en-PK')}
              </Text>
            </View>
          )}
          {loadForm.loadedAt && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Loaded At:</Text>
              <Text style={styles.summaryValue}>
                {new Date(loadForm.loadedAt).toLocaleString('en-PK')}
              </Text>
            </View>
          )}
        </Card>

        {/* Notes */}
        {loadForm.status === 'pending' && (
          <Card style={styles.notesCard}>
            <Text style={styles.label}>Load Notes (Optional)</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add any notes about the load..."
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </Card>
        )}

        {loadForm.loadNotes && (
          <Card style={styles.notesCard}>
            <Text style={styles.label}>Load Notes</Text>
            <Text style={styles.notesText}>{loadForm.loadNotes}</Text>
          </Card>
        )}
      </ScrollView>

      {/* Footer Actions */}
      {loadForm.status === 'pending' && (
        <View style={styles.footer}>
          <Button
            title="Confirm Load"
            onPress={handleConfirmLoad}
            loading={isProcessing}
            fullWidth
            size="lg"
            icon={<Ionicons name="checkmark-circle" size={20} color={colors.text.inverse} />}
          />
        </View>
      )}

      {loadForm.status === 'confirmed' && (
        <View style={styles.footer}>
          <Button
            title="Mark as Loaded"
            onPress={handleMarkLoaded}
            loading={isProcessing}
            fullWidth
            size="lg"
            variant="secondary"
            icon={<Ionicons name="cube" size={20} color={colors.text.inverse} />}
          />
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
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  headerInfo: {
    flex: 1,
  },
  orderNumber: {
    ...typography.bodyMedium,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  shopName: {
    ...typography.h4,
    color: colors.text.primary,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  statusLabel: {
    ...typography.body,
    color: colors.text.secondary,
  },
  statusValue: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: colors.info + '15',
    marginBottom: spacing.lg,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  infoText: {
    ...typography.caption,
    color: colors.info,
    flex: 1,
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  itemCard: {
    marginBottom: spacing.md,
  },
  itemHeader: {
    marginBottom: spacing.md,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    marginBottom: 2,
  },
  itemUnit: {
    ...typography.caption,
    color: colors.text.muted,
  },
  quantitySection: {
    marginTop: spacing.sm,
  },
  quantityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  confirmQuantityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  quantityLabel: {
    ...typography.body,
    color: colors.text.secondary,
  },
  orderQuantity: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  quantityButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[50],
    borderWidth: 1,
    borderColor: colors.primary[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmedQuantity: {
    ...typography.h4,
    color: colors.primary[500],
    minWidth: 40,
    textAlign: 'center',
  },
  summaryCard: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  summaryLabel: {
    ...typography.body,
    color: colors.text.secondary,
  },
  summaryValue: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  notesCard: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  notesInput: {
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...typography.body,
    color: colors.text.primary,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  notesText: {
    ...typography.body,
    color: colors.text.secondary,
  },
  footer: {
    padding: spacing.base,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});

