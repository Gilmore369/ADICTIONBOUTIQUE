'use client'

/**
 * Sidebar Component
 *
 * Navigation sidebar with:
 * - Collapsible (icon-only) desktop mode — managed by AppShell
 * - Hover-to-expand: when collapsed, hovering temporarily shows full menu (overlay)
 * - Collapse button fixed at the bottom
 * - Mobile overlay mode
 * - Expandable submenus
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Package, Users, ShoppingCart, CreditCard, Wallet, Map,
  Menu, X, ChevronDown, ChevronRight, ChevronLeft, Box, Tag, Layers,
  Ruler, Truck, PackagePlus, Warehouse, BarChart3, DollarSign, Images,
  PanelLeftClose, PanelLeftOpen, FileText, AlertTriangle, RotateCcw, CalendarDays,
  UserCog, ScrollText,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface SubItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  subItems?: SubItem[]
}

const navItems: NavItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  
  // ── VENTAS ──
  { title: 'POS', href: '/pos', icon: ShoppingCart },
  { title: 'Catálogo Visual', href: '/catalogs/visual', icon: Images },
  { title: 'Historial de Ventas', href: '/sales', icon: FileText },
  { title: 'Devoluciones', href: '/returns', icon: RotateCcw },
  
  // ── FINANZAS ──
  { title: 'Caja', href: '/cash', icon: DollarSign },
  { title: 'Deuda', href: '/debt', icon: CreditCard },
  {
    title: 'Cobranzas', href: '/collections', icon: Wallet,
    subItems: [
      { title: 'Registrar Cobro', href: '/collections/payments', icon: Wallet },
      { title: 'Historial de Cobros', href: '/collections/history', icon: FileText },
      { title: 'Acciones de Cobranza', href: '/collections/actions', icon: CalendarDays },
    ],
  },
  { title: 'Agenda', href: '/agenda', icon: CalendarDays },
  
  // ── CLIENTES ──
  {
    title: 'Clientes', href: '/clients', icon: Users,
    subItems: [
      { title: 'Lista de Clientes', href: '/clients', icon: Users },
      { title: 'Dashboard CRM', href: '/clients/dashboard', icon: LayoutDashboard },
      { title: 'Lista Negra', href: '/clients/blacklist', icon: AlertTriangle },
      { title: 'Mapa', href: '/map', icon: Map },
    ],
  },
  
  // ── INVENTARIO ──
  {
    title: 'Inventario', href: '/inventory', icon: Warehouse,
    subItems: [
      { title: 'Stock', href: '/inventory/stock', icon: Box },
      { title: 'Movimientos', href: '/inventory/movements', icon: PackagePlus },
      { title: 'Ingreso Masivo', href: '/inventory/bulk-entry', icon: PackagePlus },
    ],
  },
  
  // ── CATÁLOGOS ──
  {
    title: 'Catálogos', href: '/catalogs', icon: Package,
    subItems: [
      { title: 'Productos', href: '/catalogs/products', icon: Box },
      { title: 'Líneas', href: '/catalogs/lines', icon: Layers },
      { title: 'Categorías', href: '/catalogs/categories', icon: Tag },
      { title: 'Marcas', href: '/catalogs/brands', icon: Tag },
      { title: 'Tallas', href: '/catalogs/sizes', icon: Ruler },
      { title: 'Proveedores', href: '/catalogs/suppliers', icon: Truck },
    ],
  },
  
  // ── REPORTES ──
  { title: 'Reportes', href: '/reports', icon: BarChart3 },

  // ── ADMIN ──
  { title: 'Admin Usuarios', href: '/admin/users', icon: UserCog, adminOnly: true },
  { title: 'Logs del Sistema', href: '/admin/logs', icon: ScrollText, adminOnly: true },
]

interface SidebarProps {
  /** Desktop collapsed state — managed by AppShell */
  collapsed?: boolean
  onToggleCollapse?: () => void
}

export function Sidebar({ collapsed = false, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [expandedItems, setExpandedItems] = useState<string[]>(['/catalogs', '/inventory'])
  const [storeLogo, setStoreLogo] = useState<string | null>(null)
  const [storeName, setStoreName] = useState('Adiction Boutique')
  // Hover state: when collapsed, hovering temporarily shows full sidebar as overlay
  const [hovered, setHovered] = useState(false)

  // Effective collapsed: true only when collapsed AND not hovering
  const effectiveCollapsed = collapsed && !hovered

  useEffect(() => {
    // Load from localStorage first (instant)
    const loadLocal = () => {
      const logo   = localStorage.getItem('store_logo')
      const config = localStorage.getItem('store_config')
      if (logo) setStoreLogo(logo)
      if (config) {
        try {
          const p = JSON.parse(config)
          if (p.name) setStoreName(p.name)
        } catch { /* ignore */ }
      }
    }
    loadLocal()

    // Then fetch from API to get latest (syncs across all accounts)
    fetch('/api/settings')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return
        if (data.logo) {
          setStoreLogo(data.logo)
          try { localStorage.setItem('store_logo', data.logo) } catch { /* ignore */ }
        }
        if (data.name) {
          setStoreName(data.name)
          try {
            const cfg = JSON.parse(localStorage.getItem('store_config') || '{}')
            localStorage.setItem('store_config', JSON.stringify({ ...cfg, ...data }))
          } catch { /* ignore */ }
        }
      })
      .catch(() => { /* ignore — already have localStorage fallback */ })

    window.addEventListener('storage', loadLocal)
    return () => window.removeEventListener('storage', loadLocal)
  }, [])

  const toggleExpand = (href: string) =>
    setExpandedItems(prev =>
      prev.includes(href) ? prev.filter(i => i !== href) : [...prev, href]
    )

  // ── Detect admin from localStorage (set at login) ────────────────────────
  const [isAdmin, setIsAdmin] = useState(false)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('user_roles') || '[]'
      const roles: string[] = JSON.parse(raw).map((r: string) => r.toLowerCase())
      setIsAdmin(roles.includes('admin'))
    } catch { /* ignore */ }
  }, [])

  // ── Nav items renderer ────────────────────────────────────────────────────
  const renderNavItems = () =>
    navItems.filter(item => !(item as any).adminOnly || isAdmin).map(item => {
      const Icon        = item.icon
      const isActive    = pathname.startsWith(item.href)
      const isExpanded  = expandedItems.includes(item.href)
      const hasSubItems = !!item.subItems?.length

      // Collapsed desktop (icon-only): only show when effectiveCollapsed
      if (effectiveCollapsed) {
        return (
          <li key={item.href}>
            <Link
              href={item.subItems?.[0]?.href ?? item.href}
              title={item.title}
              className={cn(
                'flex items-center justify-center h-10 rounded-lg transition-colors',
                isActive
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                  : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
              )}
            >
              <Icon className="h-5 w-5" />
            </Link>
          </li>
        )
      }

      // Full sidebar
      return (
        <li key={item.href}>
          {hasSubItems ? (
            <>
              <button
                onClick={() => toggleExpand(item.href)}
                className={cn(
                  'w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900'
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <span className="truncate">{item.title}</span>
                </div>
                {isExpanded
                  ? <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" />
                  : <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
                }
              </button>

              {isExpanded && (
                <ul className="mt-0.5 ml-4 space-y-0.5 border-l border-gray-100 dark:border-gray-800 pl-2">
                  {item.subItems!.map(sub => {
                    const SubIcon     = sub.icon
                    const isSubActive = pathname === sub.href
                    return (
                      <li key={sub.href}>
                        <Link
                          href={sub.href}
                          onClick={() => setMobileOpen(false)}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                            isSubActive
                              ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-medium'
                              : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900'
                          )}
                        >
                          <SubIcon className="h-4 w-4 flex-shrink-0" />
                          {sub.title}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </>
          ) : (
            <Link
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900'
              )}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {item.title}
            </Link>
          )}
        </li>
      )
    })

  return (
    <>
      {/* ── Mobile hamburger ──────────────────────────────────────────────── */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden"
        onClick={() => setMobileOpen(v => !v)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar panel ─────────────────────────────────────────────────── */}
      <aside
        onMouseEnter={() => collapsed && setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={cn(
          'fixed left-0 top-0 h-screen bg-white dark:bg-gray-900',
          'border-r border-gray-200 dark:border-gray-800',
          'transition-all duration-300 ease-in-out flex flex-col',
          // When hovering while collapsed → use z-50 so it overlays content
          collapsed && hovered ? 'z-50 shadow-xl' : 'z-40',
          // Mobile: always w-64, slides in/out
          mobileOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0',
          // Desktop width: collapsed (and not hovered) = w-16, otherwise w-64
          effectiveCollapsed ? 'md:w-16' : 'md:w-64'
        )}
      >
        {/* ── Brand header ─────────────────────────────────────────────────── */}
        <div className={cn(
          'flex items-center h-16 border-b border-gray-200 dark:border-gray-800 flex-shrink-0',
          effectiveCollapsed ? 'justify-center px-2' : 'gap-3 px-4'
        )}>
          {storeLogo ? (
            <img src={storeLogo} alt="Logo" className="h-8 w-8 object-contain flex-shrink-0" />
          ) : (
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
              <span className="text-primary-foreground text-xs font-bold select-none">AB</span>
            </div>
          )}
          {!effectiveCollapsed && (
            <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {storeName}
            </span>
          )}
        </div>

        {/* ── Navigation ───────────────────────────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto p-2">
          <ul className="space-y-0.5">
            {renderNavItems()}
          </ul>
        </nav>

        {/* ── Collapse toggle — always at the bottom (desktop only) ─────── */}
        {onToggleCollapse && (
          <div className="hidden md:flex border-t border-gray-200 dark:border-gray-800 p-2 flex-shrink-0">
            <button
              onClick={onToggleCollapse}
              title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
              className={cn(
                'flex items-center gap-2 rounded-lg text-xs text-gray-500',
                'hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 transition-colors py-2',
                effectiveCollapsed ? 'justify-center w-full px-2' : 'w-full px-3'
              )}
            >
              {collapsed
                ? <PanelLeftOpen  className="h-4 w-4" />
                : <>
                    <PanelLeftClose className="h-4 w-4 flex-shrink-0" />
                    <span>Colapsar menú</span>
                  </>
              }
            </button>
          </div>
        )}
      </aside>
    </>
  )
}
