import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useShopStore, useEditRequestStore, useAuthStore } from '../../../../src/stores';
import { Button, Card, Input } from '../../../../src/components';
import { colors, typography, spacing, borderRadius } from '../../../../src/theme';
import { CITIES, AREAS } from '../../../../src/types';

export default function EditShopScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getShopById } = useShopStore();
  const { createEditRequest } = useEditRequestStore();
  const { user } = useAuthStore();
  
  const shop = getShopById(id || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state
  const [shopName, setShopName] = useState(shop?.shopName || '');
  const [ownerName, setOwnerName] = useState(shop?.ownerName || '');
  const [phone, setPhone] = useState(shop?.phone || '');
  const [city, setCity] = useState(shop?.city || '');
  const [area, setArea] = useState(shop?.area || '');
  const [address, setAddress] = useState(shop?.address || '');
  const [creditLimit, setCreditLimit] = useState(shop?.creditLimit?.toString() || '');
  const [notes, setNotes] = useState('');

  if (!shop) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>Shop not found</Text>
        <Button title="Go Back" onPress={() => router.back()} variant="outline" />
      </View>
    );
  }

  const handleSubmit = async () => {
    if (!shopName.trim() || !ownerName.trim() || !phone.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      await createEditRequest({
        shopId: shop.id,
        changes: {
          shopName: shopName.trim(),
          ownerName: ownerName.trim(),
          phone: phone.trim(),
          city: city || undefined,
          area: area || undefined,
          address: address.trim() || undefined,
          creditLimit: creditLimit ? parseFloat(creditLimit) : undefined,
        },
        notes: notes.trim() || undefined,
      });

      Alert.alert(
        'Request Submitted',
        'Your edit request has been sent to KPO for approval.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit edit request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const cityOptions = CITIES.map((c) => c.label);
  const areaOptions = city ? (AREAS[city] || []).map((a) => a.label) : [];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Info Card */}
        <Card style={styles.infoCard}>
          <Text style={styles.infoText}>
            Changes will be sent to KPO for approval. Shop details will be updated after approval.
          </Text>
        </Card>

        {/* Form Fields */}
        <Input
          label="Shop Name *"
          value={shopName}
          onChangeText={setShopName}
          placeholder="Enter shop name"
        />

        <Input
          label="Owner Name *"
          value={ownerName}
          onChangeText={setOwnerName}
          placeholder="Enter owner name"
        />

        <Input
          label="Phone *"
          value={phone}
          onChangeText={setPhone}
          placeholder="Enter phone number"
          keyboardType="phone-pad"
        />

        <Input
          label="City"
          value={city}
          onChangeText={setCity}
          placeholder="Enter city"
        />

        <Input
          label="Area"
          value={area}
          onChangeText={setArea}
          placeholder="Enter area"
        />

        <Input
          label="Address"
          value={address}
          onChangeText={setAddress}
          placeholder="Enter address"
          multiline
          numberOfLines={2}
        />

        <Input
          label="Credit Limit"
          value={creditLimit}
          onChangeText={(text) => setCreditLimit(text.replace(/[^0-9.]/g, ''))}
          placeholder="Enter credit limit"
          keyboardType="numeric"
        />

        <Input
          label="Request Notes (Optional)"
          value={notes}
          onChangeText={setNotes}
          placeholder="Add any notes about these changes..."
          multiline
          numberOfLines={3}
        />
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
          title={isSubmitting ? 'Submitting...' : 'Submit Request'}
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={isSubmitting}
          style={styles.submitButton}
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
  infoCard: {
    backgroundColor: colors.info + '15',
    marginBottom: spacing.lg,
  },
  infoText: {
    ...typography.caption,
    color: colors.info,
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
  submitButton: {
    flex: 2,
  },
});

