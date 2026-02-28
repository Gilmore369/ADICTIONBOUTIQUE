'use client'

/**
 * AppShell — Client-side wrapper that manages sidebar collapse state.
 * Replaces the static md:pl-64 in the server layout so the sidebar
 * width change propagates to the main content area in real time.
 */

import { useState, useEffect } from 'react'
import { Sidebar } from './sidebar'
import { Header } from './header'

const SIDEBAR_KEY = 'sidebar_collapsed'

interface AppShellProps {
  children: React.ReactNode
  user: { email: string; name?: string | null }
}

export function AppShell({ children, user }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false)

  // Restore saved preference on mount
  useEffect(() => {
    try {
      if (localStorage.getItem(SIDEBAR_KEY) === 'true') setCollapsed(true)
    } catch { /* ignore */ }
  }, [])

  const handleToggle = () => {
    setCollapsed(prev => {
      const next = !prev
      try { localStorage.setItem(SIDEBAR_KEY, String(next)) } catch { /* ignore */ }
      return next
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar collapsed={collapsed} onToggleCollapse={handleToggle} />

      {/* Main area shifts left/right with sidebar */}
      <div
        className={`transition-[padding-left] duration-300 ease-in-out ${
          collapsed ? 'md:pl-16' : 'md:pl-64'
        }`}
      >
        <Header user={user} />
        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
