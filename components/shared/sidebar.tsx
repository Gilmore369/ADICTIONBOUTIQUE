'use client'

/**
 * Sidebar Component — grouped by business area.
 *
 * Layout:
 *   - Brand header (logo + store name)
 *   - Sections (Inicio, Ventas, Clientes y cobranzas, Inventario,
 *     Catálogo, Agenda, Reportes, Administración) each with a small
 *     uppercase label and its items beneath.
 *   - Items can be plain links or expandable groups with sub-items.
 *   - Collapsed (icon-only) mode hides labels but keeps icons + tooltips.
 *   - Hover-to-expand: when collapsed, hovering reveals the full menu
 *     temporarily as an overlay (z-50, shadow).
 *   - Mobile: slides in/out, full width.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  // Section icons
  Home, ShoppingCart, Users, Warehouse, Package, CalendarDays,
  BarChart3, Settings,
  // Item icons
  LayoutDashboard, Images, FileText, RotateCcw, DollarSign,
  CreditCard, Wallet, Box, Tag, Layers, Ruler, Truck, PackagePlus,
  UserCog, ScrollText, Map, AlertTriangle,
  // Chrome
  Menu, X, ChevronDown, ChevronRight,
  PanelLeftClose, PanelLeftOpen,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

// ─── Types ────────────────────────────────────────────────────────────────────

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
  adminOnly?: boolean
}

interface NavGroup {
  label: string
  icon: React.ComponentType<{ className?: string }>
  items: NavItem[]
  adminOnly?: boolean
}

// ─── Navigation tree ──────────────────────────────────────────────────────────

const groups: NavGroup[] = [
  {
    label: 'Inicio', icon: Home,
    items: [
      { title: 'Dashboard',           href: '/dashboard',       icon: LayoutDashboard },
      { title: 'Revista de Productos', href: '/catalogs/visual', icon: Images },
    ],
  },
  {
    label: 'Ventas', icon: ShoppingCart,
    items: [
      { title: 'Punto de Venta',    href: '/pos',     icon: ShoppingCart },
      { title: 'Ventas Realizadas', href: '/sales',   icon: FileText     },
      { title: 'Devoluciones',      href: '/returns', icon: RotateCcw    },
      { title: 'Caja Diaria',       href: '/cash',    icon: DollarSign   },
    ],
  },
  {
    label: 'Clientes y Cobranzas', icon: Users,
    items: [
      { title: 'Clientes',             href: '/clients',              icon: Users      },
      { title: 'Deudas Pendientes',    href: '/debt',                 icon: CreditCard },
      { title: 'Registrar Cobro',      href: '/collections/payments', icon: Wallet     },
      { title: 'Historial de Cobros',  href: '/collections/history',  icon: FileText   },
      { title: 'Acciones de Cobranza', href: '/collections/actions',  icon: CalendarDays },
    ],
  },
  {
    label: 'Inventario', icon: Warehouse,
    items: [
      { title: 'Stock Actual',  href: '/inventory/stock',       icon: Box         },
      { title: 'Movimientos',   href: '/inventory/movements',   icon: PackagePlus },
      { title: 'Carga Masiva',  href: '/inventory/bulk-entry',  icon: PackagePlus },
    ],
  },
  {
    label: 'Catálogo', icon: Package,
    items: [
      { title: 'Productos',   href: '/catalogs/products',   icon: Box     },
      { title: 'Líneas',      href: '/catalogs/lines',      icon: Layers  },
      { title: 'Categorías',  href: '/catalogs/categories', icon: Tag     },
      { title: 'Marcas',      href: '/catalogs/brands',     icon: Tag     },
      { title: 'Tallas',      href: '/catalogs/sizes',      icon: Ruler   },
      { title: 'Proveedores', href: '/catalogs/suppliers',  icon: Truck   },
    ],
  },
  {
    label: 'Agenda', icon: CalendarDays,
    items: [
      { title: 'Calendario', href: '/agenda', icon: CalendarDays },
    ],
  },
  {
    label: 'Reportes', icon: BarChart3,
    items: [
      { title: 'Ventas',                  href: '/reports?tab=sales',     icon: ShoppingCart  },
      { title: 'Inventario',              href: '/reports?tab=inventory', icon: Warehouse     },
      { title: 'Clientes',                href: '/reports?tab=clients',   icon: Users         },
      { title: 'Cobranzas',               href: '/reports?tab=collections', icon: Wallet      },
      { title: 'Productos Más Vendidos',  href: '/reports?tab=top-products', icon: Package    },
      { title: 'Stock Bajo',              href: '/reports?tab=low-stock', icon: AlertTriangle },
    ],
  },
  {
    label: 'Administración', icon: Settings, adminOnly: true,
    items: [
      { title: 'Usuarios',       href: '/admin/users', icon: UserCog,    adminOnly: true },
      { title: 'Logs/Auditoría', href: '/admin/logs',  icon: ScrollText, adminOnly: true },
      { title: 'Configuración',  href: '/settings',    icon: Settings,   adminOnly: true },
    ],
  },
]

// ─── Component ────────────────────────────────────────────────────────────────

interface SidebarProps {
  collapsed?: boolean
  onToggleCollapse?: () => void
}

export function Sidebar({ collapsed = false, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [storeLogo, setStoreLogo] = useState<string | null>(null)
  const [storeName, setStoreName] = useState('Adiction Boutique')
  const [isAdmin, setIsAdmin] = useState(false)
  const [hovered, setHovered] = useState(false)

  const effectiveCollapsed = collapsed && !hovered

  // ── Load store branding ─────────────────────────────────────────────────────
  useEffect(() => {
    const loadLocal = () => {
      const logo = localStorage.getItem('store_logo')
      const cfg  = localStorage.getItem('store_config')
      if (logo) setStoreLogo(logo)
      if (cfg) {
        try {
          const p = JSON.parse(cfg)
          if (p.name) setStoreName(p.name)
        } catch { /* ignore */ }
      }
    }
    loadLocal()

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
      .catch(() => { /* localStorage fallback */ })

    window.addEventListener('storage', loadLocal)
    return () => window.removeEventListener('storage', loadLocal)
  }, [])

  // ── Detect admin role from localStorage (set at login) ──────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem('user_roles') || '[]'
      const roles: string[] = JSON.parse(raw).map((r: string) => r.toLowerCase())
      setIsAdmin(roles.includes('admin'))
    } catch { /* ignore */ }
  }, [])

  // Active item check — matches both `/foo` and `/foo?tab=bar` against current path
  const isItemActive = (href: string) => {
    const pathOnly = href.split('?')[0]
    if (href.includes('?tab=')) {
      // For Reportes sub-items, the href is `/reports?tab=X`; the current
      // pathname won't include the query string — treat all of them as
      // potentially-active and let the page itself highlight which tab is open.
      return pathname === pathOnly
    }
    return pathname === pathOnly || pathname.startsWith(pathOnly + '/')
  }

  // ── Render single item (or expandable submenu) ─────────────────────────────
  const renderItem = (item: NavItem) => {
    const Icon = item.icon
    const active = isItemActive(item.href)
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          onClick={() => setMobileOpen(false)}
          title={effectiveCollapsed ? item.title : undefined}
          className={cn(
            'flex items-center gap-3 rounded-lg text-sm transition-colors',
            effectiveCollapsed ? 'justify-center h-10 mx-auto w-10' : 'px-3 py-2',
            active
              ? 'bg-foreground/5 dark:bg-foreground/10 text-foreground font-medium'
              : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
          )}
        >
          <Icon className="h-4 w-4 flex-shrink-0" />
          {!effectiveCollapsed && <span className="truncate">{item.title}</span>}
        </Link>
      </li>
    )
  }

  // ── Render a section (label + items) ───────────────────────────────────────
  const renderGroup = (group: NavGroup, idx: number) => {
    if (group.adminOnly && !isAdmin) return null
    const visibleItems = group.items.filter(i => !i.adminOnly || isAdmin)
    if (visibleItems.length === 0) return null

    return (
      <div key={group.label} className={cn(idx === 0 ? '' : 'mt-4')}>
        {!effectiveCollapsed ? (
          <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 select-none">
            {group.label}
          </p>
        ) : (
          // Visual divider in collapsed mode (skip for first group)
          idx > 0 && <div className="mx-2 my-2 h-px bg-border/60" aria-hidden />
        )}
        <ul className="space-y-0.5">
          {visibleItems.map(renderItem)}
        </ul>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Mobile hamburger */}
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

      {/* Sidebar */}
      <aside
        onMouseEnter={() => collapsed && setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={cn(
          'fixed left-0 top-0 h-screen bg-background border-r border-border',
          'transition-all duration-200 ease-out flex flex-col',
          collapsed && hovered ? 'z-50 shadow-xl' : 'z-40',
          mobileOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0',
          effectiveCollapsed ? 'md:w-16' : 'md:w-64',
        )}
      >
        {/* Brand header */}
        <div className={cn(
          'flex items-center h-14 border-b border-border flex-shrink-0',
          effectiveCollapsed ? 'justify-center px-2' : 'gap-3 px-4',
        )}>
          {storeLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={storeLogo} alt="Logo" className="h-8 w-8 object-contain flex-shrink-0" />
          ) : (
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
              <span className="text-primary-foreground text-xs font-bold select-none">AB</span>
            </div>
          )}
          {!effectiveCollapsed && (
            <span className="text-sm font-semibold text-foreground truncate">
              {storeName}
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-2">
          {groups.map(renderGroup)}
        </nav>

        {/* Collapse toggle (desktop only) */}
        {onToggleCollapse && (
          <div className="hidden md:flex border-t border-border p-2 flex-shrink-0">
            <button
              onClick={onToggleCollapse}
              title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
              className={cn(
                'flex items-center gap-2 rounded-lg text-xs text-muted-foreground',
                'hover:bg-foreground/5 hover:text-foreground transition-colors py-2',
                effectiveCollapsed ? 'justify-center w-full px-2' : 'w-full px-3',
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
