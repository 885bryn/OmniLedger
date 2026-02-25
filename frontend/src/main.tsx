import { StrictMode } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

type ChildrenProps = {
  children: ReactNode
}

function AppProviders({ children }: ChildrenProps) {
  return children
}

function AppRouter() {
  return <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <AppRouter />
    </AppProviders>
  </StrictMode>,
)
