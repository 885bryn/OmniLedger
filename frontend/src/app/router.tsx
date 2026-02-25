import { Navigate, createBrowserRouter } from 'react-router-dom'
import { DashboardPage } from '../pages/dashboard/dashboard-page'
import { EventsPage } from '../pages/events/events-page'
import { ItemCreateWizardPage } from '../pages/items/item-create-wizard-page'
import { ItemDetailPage } from '../pages/items/item-detail-page'
import { ItemEditPage } from '../pages/items/item-edit-page'
import { ItemListPage } from '../pages/items/item-list-page'
import { AppShell } from './shell/app-shell'

export const appRouter = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
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
        element: <Navigate to="/items/create/wizard" replace />,
      },
      {
        path: 'items/create/wizard',
        element: <ItemCreateWizardPage />,
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
