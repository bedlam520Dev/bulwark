import React from 'react'
import { createRoot } from 'react-dom/client'
import { RemixDashboard } from './RemixDashboard'

// Initialize React Dashboard
export function initializeReactDashboard(): void {
  // Find the container or create one
  let container = document.getElementById('react-dashboard-root')
  
  if (!container) {
    container = document.createElement('div')
    container.id = 'react-dashboard-root'
    document.body.appendChild(container)
  }

  // Create React root and render
  const root = createRoot(container)
  root.render(<RemixDashboard />)
}

// Auto-initialize if we're in the development overlay environment
if (window === window.top) {
  // We're in the top-level window (dev overlay)
  initializeReactDashboard()
}