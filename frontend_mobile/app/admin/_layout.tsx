import React from 'react';
import { Stack } from 'expo-router';

export default function AdminLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="pharmacies/[id]/staff" options={{ headerShown: false }} />
      <Stack.Screen name="pharmacies/[id]/locums" options={{ headerShown: false }} />
      <Stack.Screen name="pharmacies/add" options={{ headerShown: false }} />
      <Stack.Screen name="pharmacies/[id]/edit" options={{ headerShown: false }} />
    </Stack>
  );
}
