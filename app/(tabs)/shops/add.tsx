import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useShopStore, useAuthStore } from '../../../src/stores';
import { Button, Input } from '../../../src/components';
import { colors, typography, spacing, borderRadius, shadows } from '../../../src/theme';
import { ShopFormData } from '../../../src/types';

// Toast will be loaded conditionally in handleSubmit

export default function AddShopScreen() {
  const { addShop, loadShops } = useShopStore();
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState<ShopFormData>({
    shopId: '',
    shopName: '',
    ownerName: '',
    phone: '',
    address: '',
    area: '',
    city: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof ShopFormData, string>>>({});

  // Sync region from user profile when it loads
  useEffect(() => {
    if (user) {
      console.log('AddShop: User profile detected:', user.name, 'Region:', user.regionId, 'Branch:', (user as any).branch);
      setFormData(prev => ({
        ...prev,
        area: (user as any).branch || user.area || '', // Use branch if available, fallback to area
        city: user.regionId || (user as any).region || '',
      }));
    }
  }, [user]);

  const updateField = (field: keyof ShopFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof ShopFormData, string>> = {};

    if (!formData.shopId?.trim()) newErrors.shopId = 'Required';
    if (!formData.shopName?.trim()) newErrors.shopName = 'Required';
    if (!formData.ownerName?.trim()) newErrors.ownerName = 'Required';
    if (!formData.phone?.trim()) newErrors.phone = 'Required';
    if (!formData.address?.trim()) newErrors.address = 'Required';

    setErrors(newErrors);
    
    if (Object.keys(newErrors).length > 0) {
      Alert.alert('Incomplete Form', 'Please fill all fields marked in red.');
      return false;
    }

    if (!user) {
      Alert.alert('Error', 'User profile not found. Please re-login.');
      return false;
    }

    // Check if user has regionId (required for branch-based filtering)
    if (!user.regionId) {
      Alert.alert('Profile Error', 'Your account has no Region assigned. Please contact KPO to assign a region.');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    console.log('AddShop: Submit clicked');
    if (isLoading) return;
    
    if (!validateForm()) {
      console.log('AddShop: Validation failed');
      return;
    }

    setIsLoading(true);
    try {
      const shopData: ShopFormData = {
        ...formData,
        city: user?.regionId || (user as any)?.region || 'Unknown',
        area: (user as any)?.branch || user?.area || 'Unknown', // Use branch if available
      };
      
      console.log('AddShop: Calling addShop with:', JSON.stringify(shopData));
      await addShop(shopData);
      console.log('AddShop: addShop call finished successfully');
      
      // Force refresh the list after adding
      await loadShops();
      
      // Show success toast (if available) or alert (fallback for web)
      if (Platform.OS !== 'web') {
        try {
          const Toast = require('react-native-toast-message').default;
          Toast.show({
            type: 'success',
            text1: 'Shop Added',
            text2: 'Shop added successfully!',
            position: 'top',
            visibilityTime: 2000,
          });
          // Navigate back immediately (toast will persist since it's in root layout)
          router.back();
        } catch (error) {
          // Toast not available, use Alert fallback
          Alert.alert('Success', 'Shop added successfully!', [
            {
              text: 'OK',
              onPress: () => router.back(),
            },
          ]);
        }
      } else {
        // Web: use Alert
      Alert.alert('Success', 'Shop added successfully!', [
        {
          text: 'OK',
            onPress: () => router.back(),
        },
      ]);
      }
    } catch (error: any) {
      console.error('AddShop: Operation failed:', error);
      Alert.alert('Error', error.message || 'Failed to add shop. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerInfo}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
            </TouchableOpacity>
            <View style={styles.iconContainer}>
              <Ionicons name="storefront" size={36} color={colors.primary[500]} />
            </View>
            <Text style={styles.headerTitle}>Add New Shop</Text>
            <Text style={styles.headerSubtitle}>
              New shop will be added to {(user as any)?.branch || user?.area || 'your branch'}, {user?.regionId || (user as any)?.region || '...'}
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                  <Ionicons name="information-circle" size={20} color={colors.primary[500]} />
                <Text style={styles.sectionTitle}>Shop Details</Text>
              </View>
              
              <View style={styles.sectionContent}>
                <Input
                  label="Manual Shop ID"
                  placeholder="e.g., S-101"
                  value={formData.shopId}
                  onChangeText={(text) => updateField('shopId', text)}
                  error={errors.shopId}
                  required
                  leftIcon="key-outline"
                  autoCapitalize="characters"
                />

                <Input
                  label="Shop Name"
                  placeholder="e.g., Madina General Store"
                  value={formData.shopName}
                  onChangeText={(text) => updateField('shopName', text)}
                  error={errors.shopName}
                  required
                  leftIcon="storefront-outline"
                />

                <Input
                  label="Owner Name"
                  placeholder="Full name of the owner"
                  value={formData.ownerName}
                  onChangeText={(text) => updateField('ownerName', text)}
                  error={errors.ownerName}
                  required
                  leftIcon="person-outline"
                />

                <Input
                  label="Phone Number"
                  placeholder="03XX-XXXXXXX"
                  value={formData.phone}
                  onChangeText={(text) => updateField('phone', text)}
                  error={errors.phone}
                  required
                  keyboardType="phone-pad"
                  leftIcon="call-outline"
                />

                <Input
                  label="Street / Landmark"
                  placeholder="e.g., Near Bilal Masjid, Street 4"
                  value={formData.address}
                  onChangeText={(text) => updateField('address', text)}
                  error={errors.address}
                  required
                  multiline
                  numberOfLines={2}
                  leftIcon="location-outline"
                  style={{ minHeight: 60, textAlignVertical: 'top' }}
                />
              </View>
            </View>

            {user && (
              <View style={styles.autoInfoBox}>
                <Ionicons name="shield-checkmark" size={16} color={colors.success} />
                <Text style={styles.autoInfoText}>
                  Branch: {(user as any)?.branch || user?.area || 'Auto-assigned'} • Region: {user?.regionId || (user as any)?.region || 'N/A'}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title={isLoading ? "Saving..." : "Save Shop"}
            onPress={handleSubmit}
            loading={isLoading}
            fullWidth
            size="lg"
            variant="primary"
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.base,
    paddingBottom: spacing.xl,
  },
  headerInfo: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: borderRadius['2xl'],
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    marginTop: spacing.md,
    ...shadows.sm,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text.primary,
    marginBottom: spacing.xs,
    fontWeight: '700',
  },
  headerSubtitle: {
    ...typography.body,
    color: colors.text.muted,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  form: {
    gap: spacing.lg,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.base,
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.gray[100],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.base,
    gap: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  sectionTitle: {
    ...typography.h4,
    color: colors.text.primary,
    fontWeight: '600',
  },
  sectionContent: {
    gap: spacing.sm,
  },
  autoInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDF4',
    padding: spacing.sm,
    borderRadius: borderRadius.lg,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  autoInfoText: {
    ...typography.caption,
    color: colors.success,
    fontWeight: '600',
  },
  footer: {
    padding: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing['3xl'],
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    ...shadows.md,
  },
});
