import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../../src/stores';
import { Card } from '../../../src/components';
import { colors, typography, spacing, borderRadius, shadows } from '../../../src/theme';

export default function WorkScreen() {
  const { user } = useAuthStore();
  const isBooker = user?.role === 'booker';
  const isSalesman = user?.role === 'salesman';

  // Booker work options
  const bookerOptions = [
    {
      id: 'routes',
      title: 'Routes',
      icon: 'map',
      description: 'Plan and manage shop routes',
      route: '/(tabs)/routes',
      color: colors.primary[500],
    },
    {
      id: 'visits',
      title: 'Visits',
      icon: 'walk',
      description: 'Track shop visits and GPS',
      route: '/(tabs)/visits',
      color: colors.secondary[500],
    },
    {
      id: 'targets',
      title: 'Targets & Performance',
      icon: 'flag',
      description: 'View targets and achievements',
      route: '/(tabs)/targets',
      color: colors.info,
    },
  ];

  // Salesman work options - simplified to essential functions
  const salesmanOptions = [
    {
      id: 'deliveries',
      title: 'My Deliveries',
      icon: 'cube',
      description: 'View and complete deliveries',
      route: '/(tabs)/deliveries',
      color: colors.primary[500],
    },
    {
      id: 'payments',
      title: 'Collect Payment',
      icon: 'cash',
      description: 'Record payments from shops',
      route: '/(tabs)/payments',
      color: colors.success,
    },
    {
      id: 'returns',
      title: 'Stock Returns',
      icon: 'return-down-back',
      description: 'Record product returns',
      route: '/(tabs)/returns',
      color: colors.warning,
    },
  ];

  const options = isBooker ? bookerOptions : isSalesman ? salesmanOptions : [];

  const handleOptionPress = (route: string) => {
    router.push(route as any);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Work</Text>
        <Text style={styles.subtitle}>
          {isBooker ? 'Order Booker' : isSalesman ? 'Salesman' : 'Work'} Tools
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {options.map((option) => (
          <TouchableOpacity
            key={option.id}
            onPress={() => handleOptionPress(option.route)}
            activeOpacity={0.7}
          >
            <Card style={styles.optionCard}>
              <View style={[styles.iconContainer, { backgroundColor: option.color + '15' }]}>
                <Ionicons name={option.icon as any} size={28} color={option.color} />
              </View>
              <View style={styles.optionInfo}>
                <Text style={styles.optionTitle}>{option.title}</Text>
                <Text style={styles.optionDescription}>{option.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.text.muted} />
            </Card>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.base,
    paddingBottom: 100,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  optionInfo: {
    flex: 1,
  },
  optionTitle: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    marginBottom: 2,
  },
  optionDescription: {
    ...typography.caption,
    color: colors.text.muted,
  },
});

