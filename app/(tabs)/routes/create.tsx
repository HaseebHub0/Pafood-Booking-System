import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouteStore, useShopStore, useAuthStore } from '../../../src/stores';
import { Button, Card, Input } from '../../../src/components';
import { colors, typography, spacing, borderRadius } from '../../../src/theme';
import { Shop } from '../../../src/types/shop';

export default function CreateRouteScreen() {
  const { shops, loadShops } = useShopStore();
  const { createRoute } = useRouteStore();
  const { user } = useAuthStore();
  
  const [routeName, setRouteName] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedShops, setSelectedShops] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);

  React.useEffect(() => {
    loadShops();
  }, []);

  const handleShopToggle = (shopId: string) => {
    const newSelected = new Set(selectedShops);
    if (newSelected.has(shopId)) {
      newSelected.delete(shopId);
    } else {
      newSelected.add(shopId);
    }
    setSelectedShops(newSelected);
  };

  const handleCreate = async () => {
    if (!routeName.trim()) {
      Alert.alert('Error', 'Please enter a route name');
      return;
    }

    if (selectedShops.size === 0) {
      Alert.alert('Error', 'Please select at least one shop');
      return;
    }

    setIsCreating(true);
    try {
      const route = await createRoute({
        routeName: routeName.trim(),
        date: selectedDate,
        shopIds: Array.from(selectedShops),
      });

      Alert.alert('Success', 'Route created successfully!', [
        {
          text: 'OK',
          onPress: () => router.replace(`/(tabs)/routes/${route.id}`),
        },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to create route. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const sortedShops = [...shops].sort((a, b) => a.shopName.localeCompare(b.shopName));

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Route Name */}
        <Text style={styles.label}>Route Name</Text>
        <Input
          value={routeName}
          onChangeText={setRouteName}
          placeholder="e.g., Gulberg Route - Morning"
          style={styles.input}
        />

        {/* Date */}
        <Text style={styles.label}>Date</Text>
        <Input
          value={selectedDate}
          onChangeText={setSelectedDate}
          placeholder="YYYY-MM-DD"
          style={styles.input}
        />

        {/* Shop Selection */}
        <View style={styles.shopHeader}>
          <Text style={styles.label}>Select Shops ({selectedShops.size} selected)</Text>
          <TouchableOpacity
            onPress={() => {
              if (selectedShops.size === shops.length) {
                setSelectedShops(new Set());
              } else {
                setSelectedShops(new Set(shops.map((s) => s.id)));
              }
            }}
          >
            <Text style={styles.selectAllText}>
              {selectedShops.size === shops.length ? 'Deselect All' : 'Select All'}
            </Text>
          </TouchableOpacity>
        </View>

        {sortedShops.map((shop) => {
          const isSelected = selectedShops.has(shop.id);
          return (
            <TouchableOpacity
              key={shop.id}
              style={styles.shopItem}
              onPress={() => handleShopToggle(shop.id)}
            >
              <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                {isSelected && <Ionicons name="checkmark" size={16} color={colors.text.inverse} />}
              </View>
              <View style={styles.shopInfo}>
                <Text style={styles.shopName}>{shop.shopName}</Text>
                <Text style={styles.shopOwner}>{shop.ownerName}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Button
          title="Cancel"
          onPress={() => router.back()}
          variant="outline"
          style={styles.cancelButton}
        />
        <Button
          title={isCreating ? 'Creating...' : 'Create Route'}
          onPress={handleCreate}
          disabled={isCreating || !routeName.trim() || selectedShops.size === 0}
          style={styles.createButton}
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
    paddingBottom: spacing.xl,
  },
  label: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  input: {
    marginBottom: spacing.md,
  },
  shopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  selectAllText: {
    ...typography.bodyMedium,
    color: colors.primary[500],
  },
  shopItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  checkboxSelected: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
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
    color: colors.text.muted,
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    padding: spacing.base,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.md,
  },
  cancelButton: {
    flex: 1,
  },
  createButton: {
    flex: 2,
  },
});

