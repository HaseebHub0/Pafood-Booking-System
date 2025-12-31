import { Stack } from 'expo-router';
import { colors } from '../../../../src/theme';

export default function CreateReportLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.surface,
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
          title: 'Report Info',
        }}
      />
      <Stack.Screen
        name="products"
        options={{
          title: 'Product Sales',
        }}
      />
      <Stack.Screen
        name="shops"
        options={{
          title: 'Shop Records',
        }}
      />
      <Stack.Screen
        name="expenses"
        options={{
          title: 'Expenses',
        }}
      />
      <Stack.Screen
        name="cash"
        options={{
          title: 'Cash Deposit',
        }}
      />
      <Stack.Screen
        name="summary"
        options={{
          title: 'Summary',
        }}
      />
    </Stack>
  );
}

