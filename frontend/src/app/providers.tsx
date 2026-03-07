import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from '../auth/auth-context'
import { AdminScopeProvider } from '../features/admin-scope/admin-scope-context'
import { ThemeProvider } from '../features/theme/theme-provider'
import { ToastProvider } from '../features/ui/toast-provider'
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
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AdminScopeProvider>
            <ToastProvider>
              <RouterProvider router={appRouter} />
            </ToastProvider>
          </AdminScopeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
