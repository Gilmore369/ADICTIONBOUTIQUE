'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Users, UserPlus, Shield, Store, Pencil, UserX, UserCheck, Search, Key,
  Filter, X, Loader2, CheckCircle2, AlertTriangle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { UserFormDialog, type UserRow } from '@/components/admin/user-form-dialog'
import { ResetPasswordDialog } from '@/components/admin/reset-password-dialog'
import { cn } from '@/lib/utils'

const ROLE_TONE: Record<string, string> = {
  admin: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300',
  vendedor: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300',
  cobrador: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300',
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState<string>('')
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all')

  const [formOpen, setFormOpen] = useState(false)
  const [editUser, setEditUser] = useState<UserRow | null>(null)

  const [resetOpen, setResetOpen] = useState(false)
  const [resetUser, setResetUser] = useState<UserRow | null>(null)

  useEffect(() => { loadUsers() }, [])

  async function loadUsers() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/users')
      if (res.ok) setUsers(await res.json())
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleActive(user: UserRow) {
    const action = user.active ? 'desactivar' : 'reactivar'
    if (!confirm(`¿Seguro que deseas ${action} a "${user.name}"?`)) return
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !user.active }),
      })
      if (res.ok) {
        toast.success(`Usuario ${user.active ? 'desactivado' : 'reactivado'}`)
        loadUsers()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Error')
      }
    } catch (e: any) {
      toast.error(e?.message || 'Error de red')
    }
  }

  // Filtered + searched users
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter(u => {
      if (filterRole && !(u.roles || []).includes(filterRole)) return false
      if (filterActive === 'active' && !u.active) return false
      if (filterActive === 'inactive' && u.active) return false
      if (q) {
        const hay = `${u.name} ${u.email} ${(u.roles || []).join(' ')}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [users, search, filterRole, filterActive])

  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter(u => u.active).length,
    admins: users.filter(u => (u.roles || []).includes('admin')).length,
    vendedores: users.filter(u => (u.roles || []).includes('vendedor')).length,
    cobradores: users.filter(u => (u.roles || []).includes('cobrador')).length,
  }), [users])

  const hasActiveFilters = !!(search || filterRole || filterActive !== 'all')

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Users className="w-6 h-6 text-emerald-600" />
            Gestión de Usuarios
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Administra accesos, roles y tiendas asignadas
          </p>
        </div>
        <Button
          onClick={() => { setEditUser(null); setFormOpen(true) }}
          className="gap-2"
          size="lg"
        >
          <UserPlus className="w-4 h-4" />
          Nuevo Usuario
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="text-2xl font-bold mt-1">{stats.total}</div>
        </Card>
        <Card className="p-4 bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-200">
          <div className="text-xs text-emerald-700 dark:text-emerald-400">Activos</div>
          <div className="text-2xl font-bold mt-1 text-emerald-700 dark:text-emerald-400">{stats.active}</div>
        </Card>
        <Card className="p-4 bg-rose-50/50 dark:bg-rose-950/30 border-rose-200">
          <div className="text-xs text-rose-700 dark:text-rose-400">Admins</div>
          <div className="text-2xl font-bold mt-1 text-rose-700 dark:text-rose-400">{stats.admins}</div>
        </Card>
        <Card className="p-4 bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-200">
          <div className="text-xs text-emerald-700 dark:text-emerald-400">Vendedores</div>
          <div className="text-2xl font-bold mt-1 text-emerald-700 dark:text-emerald-400">{stats.vendedores}</div>
        </Card>
        <Card className="p-4 bg-blue-50/50 dark:bg-blue-950/30 border-blue-200">
          <div className="text-xs text-blue-700 dark:text-blue-400">Cobradores</div>
          <div className="text-2xl font-bold mt-1 text-blue-700 dark:text-blue-400">{stats.cobradores}</div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, email o rol..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-9"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Rol:</span>
            {['', 'admin', 'vendedor', 'cobrador'].map(r => (
              <button
                key={r || 'all'}
                onClick={() => setFilterRole(r)}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium rounded-md border transition-colors capitalize',
                  filterRole === r
                    ? 'bg-foreground text-background border-foreground'
                    : 'border-border hover:bg-muted'
                )}
              >
                {r || 'Todos'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Estado:</span>
            {([['all', 'Todos'], ['active', 'Activos'], ['inactive', 'Inactivos']] as const).map(([v, l]) => (
              <button
                key={v}
                onClick={() => setFilterActive(v)}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium rounded-md border transition-colors',
                  filterActive === v
                    ? 'bg-foreground text-background border-foreground'
                    : 'border-border hover:bg-muted'
                )}
              >
                {l}
              </button>
            ))}
          </div>

          {hasActiveFilters && (
            <button
              onClick={() => { setSearch(''); setFilterRole(''); setFilterActive('all') }}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              <X className="w-3 h-3" />Limpiar filtros
            </button>
          )}
        </div>
      </Card>

      {/* Users table */}
      {loading ? (
        <Card className="p-12 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground mt-3">Cargando usuarios...</p>
        </Card>
      ) : filteredUsers.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {hasActiveFilters ? 'No hay usuarios con esos filtros' : 'No hay usuarios registrados'}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-foreground/80">Usuario</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground/80">Roles</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground/80">Tiendas</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground/80">Estado</th>
                  <th className="text-right px-4 py-3 font-semibold text-foreground/80">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredUsers.map(u => (
                  <tr key={u.id} className={cn('hover:bg-muted/30 transition-colors', !u.active && 'opacity-60')}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {(u as any).profile_photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={(u as any).profile_photo_url}
                            alt={u.name}
                            className="w-9 h-9 rounded-full object-cover border border-border flex-shrink-0"
                          />
                        ) : (
                          <div className={cn(
                            'w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0',
                            (u.roles || []).includes('admin')
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                              : (u.roles || []).includes('cobrador')
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
                          )}>
                            {u.name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-foreground">{u.name}</div>
                          <div className="text-xs text-muted-foreground">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(u.roles || []).map(r => (
                          <Badge key={r} variant="outline" className={cn('capitalize', ROLE_TONE[r] || '')}>
                            {r}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(u.stores || []).map(s => (
                          <Badge
                            key={s}
                            variant="outline"
                            className={s === 'MUJERES'
                              ? 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/40 dark:text-pink-300'
                              : 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300'}
                          >
                            {s === 'MUJERES' ? 'Mujeres' : 'Hombres'}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={u.active
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : 'bg-muted text-muted-foreground'}
                      >
                        {u.active ? (
                          <><CheckCircle2 className="w-3 h-3 mr-1" />Activo</>
                        ) : (
                          <><AlertTriangle className="w-3 h-3 mr-1" />Inactivo</>
                        )}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => { setEditUser(u); setFormOpen(true) }}
                          title="Editar"
                          className="h-8 w-8"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => { setResetUser(u); setResetOpen(true) }}
                          title="Restablecer contraseña"
                          className="h-8 w-8 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                        >
                          <Key className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleActive(u)}
                          title={u.active ? 'Desactivar' : 'Reactivar'}
                          className={cn('h-8 w-8', u.active
                            ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40'
                            : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40')}
                        >
                          {u.active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Dialogs */}
      <UserFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editUser={editUser}
        onSuccess={() => {
          toast.success(editUser ? 'Usuario actualizado' : 'Usuario creado exitosamente')
          loadUsers()
        }}
      />

      <ResetPasswordDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        user={resetUser}
        onSuccess={() => toast.success('Contraseña restablecida')}
      />
    </div>
  )
}
