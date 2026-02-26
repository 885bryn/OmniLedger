import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from '../auth/auth-context'
import { AdminScopeProvider } from '../features/admin-scope/admin-scope-context'
import { appRouter } from './router'
import '../lib/i18n'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
})

export function AppProviders() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AdminScopeProvider>
          <RouterProvider router={appRouter} />
        </AdminScopeProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
