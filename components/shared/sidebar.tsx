'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  AlertTriangle,
  BarChart3,
  Box,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CreditCard,
  DollarSign,
  FileText,
  Home,
  Images,
  Layers,
  LayoutDashboard,
  Map,
  Menu,
  Package,
  PackagePlus,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  Ruler,
  ScrollText,
  Settings,
  ShoppingCart,
  Store,
  Tag,
  Truck,
  UserCog,
  Users,
  Wallet,
  Warehouse,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  adminOnly?: boolean
}

interface NavGroup {
  label: string
  icon: React.ComponentType<{ className?: string }>
  href?: string
  adminOnly?: boolean
  items: NavItem[]
}

const groups: NavGroup[] = [
  {
    label: 'Inicio',
    icon: Home,
    items: [
      { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { title: 'Revista de Productos', href: '/catalogs/visual', icon: Images },
    ],
  },
  {
    label: 'Ventas',
    icon: ShoppingCart,
    items: [
      { title: 'Punto de venta (POS)', href: '/pos', icon: ShoppingCart },
      { title: 'Ventas realizadas', href: '/sales', icon: FileText },
      { title: 'Devoluciones', href: '/returns', icon: RotateCcw },
      { title: 'Caja diaria', href: '/cash', icon: DollarSign },
    ],
  },
  {
    label: 'Clientes y cobranzas',
    icon: Users,
    items: [
      { title: 'Clientes', href: '/clients', icon: Users },
      { title: 'Dashboard CRM', href: '/clients/dashboard', icon: LayoutDashboard },
      { title: 'Lista Negra', href: '/clients/blacklist', icon: AlertTriangle },
      { title: 'Mapa', href: '/map', icon: Map },
      { title: 'Deudas pendientes', href: '/debt', icon: CreditCard },
      { title: 'Planes de crédito', href: '/debt/plans', icon: CreditCard },
      { title: 'Registrar cobro', href: '/collections/payments', icon: Wallet },
      { title: 'Historial de cobros', href: '/collections/history', icon: FileText },
      { title: 'Acciones de cobranza', href: '/collections/actions', icon: CalendarDays },
    ],
  },
  {
    label: 'Inventario',
    icon: Warehouse,
    items: [
      { title: 'Stock actual', href: '/inventory/stock', icon: Box },
      { title: 'Movimientos de inventario', href: '/inventory/movements', icon: PackagePlus },
      { title: 'Carga masiva', href: '/inventory/bulk-entry', icon: PackagePlus },
    ],
  },
  {
    label: 'Catálogo',
    icon: Package,
    items: [
      { title: 'Productos', href: '/catalogs/products', icon: Box },
      { title: 'Líneas', href: '/catalogs/lines', icon: Layers },
      { title: 'Categorías', href: '/catalogs/categories', icon: Tag },
      { title: 'Marcas', href: '/catalogs/brands', icon: Tag },
      { title: 'Tallas', href: '/catalogs/sizes', icon: Ruler },
      { title: 'Proveedores', href: '/catalogs/suppliers', icon: Truck },
    ],
  },
  {
    label: 'Agenda',
    icon: CalendarDays,
    items: [
      { title: 'Calendario', href: '/agenda', icon: CalendarDays },
    ],
  },
  {
    label: 'Reportes',
    icon: BarChart3,
    items: [
      { title: 'Ventas', href: '/reports?tab=sales', icon: ShoppingCart },
      { title: 'Inventario', href: '/reports?tab=inventory', icon: Warehouse },
      { title: 'Clientes', href: '/reports?tab=clients', icon: Users },
      { title: 'Cobranzas', href: '/reports?tab=collections', icon: Wallet },
      { title: 'Productos más vendidos', href: '/reports?tab=top-products', icon: Package },
      { title: 'Stock bajo', href: '/reports?tab=low-stock', icon: AlertTriangle },
    ],
  },
  {
    label: 'Administración',
    icon: Settings,
    adminOnly: true,
    items: [
      { title: 'Usuarios', href: '/admin/users', icon: UserCog, adminOnly: true },
      { title: 'Logs/Auditoría', href: '/admin/logs', icon: ScrollText, adminOnly: true },
      { title: 'Configuración', href: '/settings', icon: Settings, adminOnly: true },
    ],
  },
]

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
  const [openGroups, setOpenGroups] = useState<string[]>([
    'Inicio',
    'Ventas',
    'Clientes y cobranzas',
    'Inventario',
    'Catálogo',
    'Reportes',
  ])

  const effectiveCollapsed = collapsed && !hovered

  useEffect(() => {
    const loadLocal = () => {
      const logo = localStorage.getItem('store_logo')
      const cfg = localStorage.getItem('store_config')
      if (logo) setStoreLogo(logo)
      if (cfg) {
        try {
          const parsed = JSON.parse(cfg)
          if (parsed.name) setStoreName(parsed.name)
        } catch {}
      }
    }

    loadLocal()
    fetch('/api/settings')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return
        if (data.logo) {
          setStoreLogo(data.logo)
          localStorage.setItem('store_logo', data.logo)
        }
        if (data.name) {
          setStoreName(data.name)
          const cfg = JSON.parse(localStorage.getItem('store_config') || '{}')
          localStorage.setItem('store_config', JSON.stringify({ ...cfg, ...data }))
        }
      })
      .catch(() => {})

    window.addEventListener('storage', loadLocal)
    return () => window.removeEventListener('storage', loadLocal)
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user_roles') || '[]'
      const roles: string[] = JSON.parse(raw).map((r: string) => r.toLowerCase())
      setIsAdmin(roles.includes('admin'))
    } catch {}
  }, [])

  const visibleGroups = useMemo(() => {
    return groups
      .filter(group => !group.adminOnly || isAdmin)
      .map(group => ({
        ...group,
        items: group.items.filter(item => !item.adminOnly || isAdmin),
      }))
      .filter(group => group.items.length > 0)
  }, [isAdmin])

  const isItemActive = (href: string) => {
    const pathOnly = href.split('?')[0]
    return pathname === pathOnly || pathname.startsWith(pathOnly + '/')
  }

  const isGroupActive = (group: NavGroup) => group.items.some(item => isItemActive(item.href))

  useEffect(() => {
    const active = visibleGroups.find(isGroupActive)
    if (active) {
      setOpenGroups(prev => prev.includes(active.label) ? prev : [...prev, active.label])
    }
  }, [pathname, visibleGroups])

  const toggleGroup = (label: string) => {
    setOpenGroups(prev => prev.includes(label)
      ? prev.filter(item => item !== label)
      : [...prev, label]
    )
  }

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
            'flex items-center gap-3 rounded-md text-sm transition-colors',
            effectiveCollapsed ? 'mx-auto h-10 w-10 justify-center' : 'px-3 py-2',
            active
              ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
              : 'text-sidebar-foreground/72 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground'
          )}
        >
          <Icon className="h-4 w-4 shrink-0" />
          {!effectiveCollapsed && <span className="truncate">{item.title}</span>}
        </Link>
      </li>
    )
  }

  const renderGroup = (group: NavGroup, idx: number) => {
    const Icon = group.icon
    const active = isGroupActive(group)
    const open = effectiveCollapsed || openGroups.includes(group.label)

    return (
      <div key={group.label} className={idx === 0 ? '' : 'mt-2'}>
        {!effectiveCollapsed ? (
          <button
            type="button"
            onClick={() => toggleGroup(group.label)}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide transition-colors',
              active
                ? 'text-sidebar-accent-foreground'
                : 'text-sidebar-foreground/58 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{group.label}</span>
            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : (
          idx > 0 && <div className="mx-2 my-2 h-px bg-sidebar-border" aria-hidden />
        )}

        {open && (
          <ul className={cn('space-y-0.5', effectiveCollapsed ? '' : 'mt-1 pl-2')}>
            {group.items.map(renderItem)}
          </ul>
        )}
      </div>
    )
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="fixed left-4 top-4 z-50 md:hidden"
        onClick={() => setMobileOpen(v => !v)}
        aria-label="Abrir menú"
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        onMouseEnter={() => collapsed && setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={cn(
          'fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-200 ease-out',
          collapsed && hovered && 'z-50 shadow-xl',
          mobileOpen ? 'w-72 translate-x-0' : '-translate-x-full md:translate-x-0',
          effectiveCollapsed ? 'md:w-16' : 'md:w-72'
        )}
      >
        <div className={cn(
          'flex h-14 shrink-0 items-center border-b border-sidebar-border',
          effectiveCollapsed ? 'justify-center px-2' : 'gap-3 px-4'
        )}>
          {storeLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={storeLogo} alt="Logo" className="h-8 w-8 shrink-0 object-contain" />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary">
              <span className="select-none text-xs font-semibold text-sidebar-primary-foreground">AB</span>
            </div>
          )}
          {!effectiveCollapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{storeName}</p>
              <p className="truncate text-[11px] text-sidebar-foreground/55">Sistema boutique</p>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto p-2">
          {visibleGroups.map(renderGroup)}
        </nav>

        {onToggleCollapse && (
          <div className="hidden shrink-0 border-t border-sidebar-border p-2 md:flex">
            <button
              type="button"
              onClick={onToggleCollapse}
              title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
              className={cn(
                'flex items-center gap-2 rounded-md py-2 text-xs text-sidebar-foreground/65 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                effectiveCollapsed ? 'w-full justify-center px-2' : 'w-full px-3'
              )}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <>
                  <PanelLeftClose className="h-4 w-4 shrink-0" />
                  <span>Colapsar menú</span>
                </>
              )}
            </button>
          </div>
        )}
      </aside>
    </>
  )
}
