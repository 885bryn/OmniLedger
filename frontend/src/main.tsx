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

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Missing #root element in frontend entrypoint')
}

createRoot(rootElement).render(
  <StrictMode>
    <AppProviders>
      <AppRouter />
    </AppProviders>
  </StrictMode>,
)
