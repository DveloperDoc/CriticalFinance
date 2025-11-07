import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnReconnect: true,
      refetchOnMount: false,
      refetchOnWindowFocus: false, // RN no tiene "window", evita efectos raros
    },
  },
});