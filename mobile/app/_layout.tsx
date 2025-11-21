// app/_layout.tsx
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';

const queryClient = new QueryClient();

function RootGate() {
  const { user, loading } = useAuth();

  // Mientras AuthProvider rehidrata token/usuario, él mismo muestra el spinner
  if (loading) return null;

  if (!user) {
    // Usuario no autenticado → mandar siempre al flujo de login
    return <Redirect href="/(auth)/login" />;
  }

  // Usuario autenticado → mandar al grupo de tabs (Home, Ahorro, etc.)
  return <Redirect href="/(tabs)" />;
}

export default function RootLayout() {
  const scheme = useColorScheme();

  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {/* Navegación principal: grupo de auth y grupo de tabs */}
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
          </Stack>

          {/* Guardia de autenticación a nivel raíz */}
          <RootGate />
        </AuthProvider>
      </QueryClientProvider>

      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
