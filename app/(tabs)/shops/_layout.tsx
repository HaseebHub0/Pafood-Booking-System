import { Stack } from 'expo-router';
import { colors } from '../../../src/theme';

export default function ShopsLayout() {
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
          title: 'My Shops',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="add"
        options={{
          title: 'Add New Shop',
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          headerShown: false, // Nested layout handles headers
        }}
      />
    </Stack>
  );
}

