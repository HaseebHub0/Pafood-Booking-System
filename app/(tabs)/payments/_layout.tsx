import { Stack } from 'expo-router';
import { colors } from '../../../src/theme';

export default function PaymentsLayout() {
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
          title: 'Payment Collection',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="collect"
        options={{
          title: 'Collect Payment',
        }}
      />
      <Stack.Screen
        name="outstanding/[orderId]"
        options={{
          title: 'Collect Outstanding Payment',
        }}
      />
    </Stack>
  );
}

