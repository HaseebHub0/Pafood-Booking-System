import { Stack } from 'expo-router';
import { colors } from '../../../src/theme';

export default function TargetsLayout() {
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
          title: 'Performance & Targets',
          headerShown: false,
        }}
      />
    </Stack>
  );
}

