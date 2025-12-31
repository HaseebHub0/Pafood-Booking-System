import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore, useDailyReportStore } from '../../../../src/stores';
import { Button, Input, Card } from '../../../../src/components';
import { colors, typography, spacing, borderRadius, shadows } from '../../../../src/theme';

export default function ReportInfoScreen() {
  const { user } = useAuthStore();
  const { createReport, currentReport } = useDailyReportStore();
  
  const [routeName, setRouteName] = useState('');
  const [bookerName, setBookerName] = useState(user?.name || '');
  const [salesmanName, setSalesmanName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // Block bookers - Daily Sale Reports not in workflow
  useEffect(() => {
    if (user?.role === 'booker') {
      router.replace('/(tabs)/reports');
    }
  }, [user]);

  useEffect(() => {
    // If resuming an existing report, populate the fields
    if (currentReport) {
      setRouteName(currentReport.routeName);
      setBookerName(currentReport.bookerName);
      setSalesmanName(currentReport.salesmanName);
      setDate(currentReport.date);
    }
  }, [currentReport]);

  const handleNext = () => {
    if (!currentReport) {
      createReport({
        routeName,
        bookerName,
        salesmanName,
        date,
      });
    } else {
      // Update existing report
      useDailyReportStore.getState().updateHeaderInfo({
        routeName,
        bookerName,
        salesmanName,
        date,
      });
    }
    
    router.push('/(tabs)/reports/create/products');
  };

  const isValid = bookerName.trim() !== '';

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Step Indicator */}
          <View style={styles.stepIndicator}>
            <View style={[styles.step, styles.stepActive]}>
              <Text style={styles.stepNumber}>1</Text>
            </View>
            <View style={styles.stepLine} />
            <View style={styles.step}>
              <Text style={styles.stepNumber}>2</Text>
            </View>
            <View style={styles.stepLine} />
            <View style={styles.step}>
              <Text style={styles.stepNumber}>3</Text>
            </View>
            <View style={styles.stepLine} />
            <View style={styles.step}>
              <Text style={styles.stepNumber}>4</Text>
            </View>
            <View style={styles.stepLine} />
            <View style={styles.step}>
              <Text style={styles.stepNumber}>5</Text>
            </View>
            <View style={styles.stepLine} />
            <View style={styles.step}>
              <Text style={styles.stepNumber}>6</Text>
            </View>
          </View>

          <Text style={styles.stepTitle}>Report Information</Text>
          <Text style={styles.stepDescription}>
            Enter the basic details for the daily sale report
          </Text>

          <Card variant="elevated" style={styles.formCard}>
            <Input
              label="Date"
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              leftIcon="calendar-outline"
            />

            <Input
              label="Route Name"
              value={routeName}
              onChangeText={setRouteName}
              placeholder="Enter route name"
              leftIcon="navigate-outline"
            />

            <Input
              label="Booker Name"
              value={bookerName}
              onChangeText={setBookerName}
              placeholder="Enter booker name"
              leftIcon="person-outline"
              required
            />

            <Input
              label="Salesman Name"
              value={salesmanName}
              onChangeText={setSalesmanName}
              placeholder="Enter salesman name"
              leftIcon="people-outline"
            />
          </Card>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title="Next: Product Sales"
            onPress={handleNext}
            disabled={!isValid}
            fullWidth
            icon="arrow-forward"
            iconPosition="right"
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.base,
    paddingBottom: spacing['2xl'],
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  step: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.gray[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepActive: {
    backgroundColor: colors.primary[500],
  },
  stepNumber: {
    ...typography.captionMedium,
    color: colors.text.inverse,
  },
  stepLine: {
    width: 20,
    height: 2,
    backgroundColor: colors.gray[200],
  },
  stepTitle: {
    ...typography.h3,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  stepDescription: {
    ...typography.body,
    color: colors.text.muted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  formCard: {
    padding: spacing.base,
  },
  footer: {
    padding: spacing.base,
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});

