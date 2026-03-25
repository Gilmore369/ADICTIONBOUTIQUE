'use client'

/**
 * Header Component
 * 
 * Top header bar with store selector, theme settings, and user profile dropdown.
 * 
 * Design Tokens Used:
 * - Spacing: 16px (padding), 8px (gaps)
 * - Border Radius: 8px (standard)
 * - Button: Height 36px
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { LogOut, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ThemeSettings } from './theme-settings'
import { StoreSelector } from '@/components/layout/store-selector'

const AVATAR_COLORS = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444','#14b8a6']

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function getAvatarColor(name: string) {
  let hash = 0
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function UserAvatar({ name }: { name: string }) {
  const initials = getInitials(name)
  const color = getAvatarColor(name)
  return (
    <div
      className="flex items-center justify-center w-8 h-8 rounded-full text-white text-xs font-bold flex-shrink-0"
      style={{ background: color }}
      title={name}
    >
      {initials}
    </div>
  )
}

interface HeaderProps {
  user?: {
    email?: string
    name?: string
  }
}

export function Header({ user }: HeaderProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const router = useRouter()
  const supabase = createBrowserClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-30 w-full bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
      <div className="flex items-center justify-between h-16 px-4 md:px-6">
        {/* Left side - could add breadcrumbs or page title here */}
        <div className="flex-1" />

        {/* Right side - Store Selector + Theme Settings + User profile */}
        <div className="flex items-center gap-2">
          {/* Store Selector */}
          <StoreSelector />
          
          {/* Theme Settings */}
          <ThemeSettings />
          
          {/* User Profile */}
          <div className="relative">
          <Button
            variant="ghost"
            className="flex items-center gap-2 px-2"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            <UserAvatar name={user?.name || user?.email || 'U'} />
            <span className="hidden md:inline text-sm font-medium text-gray-700 max-w-[120px] truncate">
              {user?.name || user?.email || 'Usuario'}
            </span>
          </Button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <>
              {/* Overlay to close dropdown */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsDropdownOpen(false)}
              />

              {/* Dropdown content */}
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                <div className="p-3 border-b border-gray-200 flex items-center gap-3">
                  <UserAvatar name={user?.name || user?.email || 'U'} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {user?.name || 'Usuario'}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {user?.email}
                    </p>
                  </div>
                </div>

                <div className="p-2">
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false)
                      router.push('/settings')
                    }}
                    className={cn(
                      'flex items-center gap-3 w-full px-3 py-2 text-sm text-gray-700',
                      'rounded-md hover:bg-gray-100 transition-colors'
                    )}
                  >
                    <Settings className="h-4 w-4" />
                    Configuración
                  </button>

                  <button
                    onClick={() => {
                      setIsDropdownOpen(false)
                      handleSignOut()
                    }}
                    className={cn(
                      'flex items-center gap-3 w-full px-3 py-2 text-sm text-red-600',
                      'rounded-md hover:bg-red-50 transition-colors'
                    )}
                  >
                    <LogOut className="h-4 w-4" />
                    Cerrar sesión
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
        </div>
      </div>
    </header>
  )
}
