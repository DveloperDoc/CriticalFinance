import { Stack, Redirect } from 'expo-router';
import React from 'react';
import { useAuth } from '@/providers/AuthProvider';

export default function AuthLayout() {
  const { token } = useAuth();
  if (token) return <Redirect href="/(tabs)" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}