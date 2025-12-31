import { Stack } from 'expo-router';
import { colors } from '../../../src/theme';

export default function VisitsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.text.primary,
        headerTitleStyle: {
          fontWeight: '600',
        },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Today\'s Visits',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="report"
        options={{
          title: 'Visit Report',
        }}
      />
    </Stack>
  );
}

