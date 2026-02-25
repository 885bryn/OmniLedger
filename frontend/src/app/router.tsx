import { Navigate, createBrowserRouter } from 'react-router-dom'
import { AppShell } from './shell/app-shell'

function RoutePlaceholder({ title, detail }: { title: string; detail: string }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
    </section>
  )
}

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
        element: <RoutePlaceholder title="Dashboard" detail="Summary cards and due-first activity panels will live here." />,
      },
      {
        path: 'items',
        element: <RoutePlaceholder title="Items" detail="Item list view skeleton for filters, search, and sorting." />,
      },
      {
        path: 'items/create',
        element: <RoutePlaceholder title="Create Item" detail="Wizard entry route for new item creation." />,
      },
      {
        path: 'items/create/wizard',
        element: <RoutePlaceholder title="Create Item Wizard" detail="Step-by-step item and commitment workflow route." />,
      },
      {
        path: 'items/:itemId',
        element: <RoutePlaceholder title="Item Detail" detail="Net-status detail page with tabs and activity feed." />,
      },
      {
        path: 'items/:itemId/edit',
        element: <RoutePlaceholder title="Edit Item" detail="Form-driven item edit page route." />,
      },
      {
        path: 'events',
        element: <RoutePlaceholder title="Events" detail="Grouped due-date event timeline and completion actions." />,
      },
      {
        path: '*',
        element: <Navigate to="/dashboard" replace />,
      },
    ],
  },
])
