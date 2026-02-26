import { Navigate, createBrowserRouter, useLocation } from 'react-router-dom'
import { RequireAuth } from '../auth/require-auth'
import { LoginPage } from '../pages/auth/login-page'
import { RegisterPage } from '../pages/auth/register-page'
import { DashboardPage } from '../pages/dashboard/dashboard-page'
import { EventsPage } from '../pages/events/events-page'
import { ItemCreateWizardPage } from '../pages/items/item-create-wizard-page'
import { ItemDetailPage } from '../pages/items/item-detail-page'
import { ItemEditPage } from '../pages/items/item-edit-page'
import { ItemListPage } from '../pages/items/item-list-page'
import { AppShell } from './shell/app-shell'

function LegacyCreateWizardRedirect() {
  const location = useLocation()
  return <Navigate to={`/items/create${location.search}`} replace />
}

export const appRouter = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/register',
    element: <RegisterPage />,
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: <DashboardPage />,
      },
      {
        path: 'items',
        element: <ItemListPage />,
      },
      {
        path: 'items/create',
        element: <ItemCreateWizardPage />,
      },
      {
        path: 'items/create/wizard',
        element: <LegacyCreateWizardRedirect />,
      },
      {
        path: 'items/:itemId',
        element: <ItemDetailPage />,
      },
      {
        path: 'items/:itemId/edit',
        element: <ItemEditPage />,
      },
      {
        path: 'events',
        element: <EventsPage />,
      },
      {
        path: '*',
        element: <Navigate to="/dashboard" replace />,
      },
    ],
  },
])
