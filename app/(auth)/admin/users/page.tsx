'use client'

import { useEffect, useState } from 'react'
import { Users, UserPlus, Shield, Store, Pencil, UserX, UserCheck } from 'lucide-react'

interface UserRow {
  id: string
  name: string
  email: string
  roles: string[]
  stores: string[]
  active: boolean
  created_at: string
}

const ROLES = ['admin', 'vendedor', 'cobrador']
const STORES = ['MUJERES', 'HOMBRES']

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editUser, setEditUser] = useState<UserRow | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState({
    name: '', email: '', password: '',
    roles: ['vendedor'], stores: ['MUJERES'],
  })

  useEffect(() => { loadUsers() }, [])

  async function loadUsers() {
    setLoading(true)
    const res = await fetch('/api/admin/users')
    if (res.ok) setUsers(await res.json())
    setLoading(false)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error); return }
    setSuccess('Usuario creado exitosamente')
    setShowForm(false)
    setForm({ name: '', email: '', password: '', roles: ['vendedor'], stores: ['MUJERES'] })
    loadUsers()
    setTimeout(() => setSuccess(''), 3000)
  }

  async function handleUpdate(id: string, updates: Partial<UserRow>) {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (res.ok) { loadUsers(); setEditUser(null) }
  }

  async function handleToggleActive(user: UserRow) {
    await handleUpdate(user.id, { active: !user.active })
  }

  function toggleCheckbox(arr: string[], val: string) {
    return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-emerald-600" />
          <h1 className="text-2xl font-bold">Gestión de Usuarios</h1>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditUser(null) }}
          className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 text-sm font-medium"
        >
          <UserPlus className="w-4 h-4" /> Nuevo Usuario
        </button>
      </div>

      {success && <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm">{success}</div>}
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

      {/* Formulario crear / editar */}
      {(showForm || editUser) && (
        <div className="mb-6 p-5 border border-gray-200 rounded-xl bg-gray-50">
          <h2 className="font-semibold mb-4 text-gray-800">{editUser ? 'Editar Usuario' : 'Crear Usuario'}</h2>
          <form onSubmit={editUser ? (e) => { e.preventDefault(); handleUpdate(editUser.id, { name: form.name, roles: form.roles, stores: form.stores }) } : handleCreate}
            className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <input required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                defaultValue={editUser?.name} placeholder="Nombre completo" />
            </div>

            {!editUser && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input required type="email" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                    placeholder="correo@ejemplo.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
                  <input required type="password" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                    placeholder="Mínimo 8 caracteres" minLength={8} />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                <Shield className="w-3.5 h-3.5" /> Roles
              </label>
              <div className="flex gap-3">
                {ROLES.map(r => (
                  <label key={r} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="checkbox" checked={form.roles.includes(r)}
                      onChange={() => setForm({ ...form, roles: toggleCheckbox(form.roles, r) })} />
                    <span className="capitalize">{r}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                <Store className="w-3.5 h-3.5" /> Tiendas
              </label>
              <div className="flex gap-3">
                {STORES.map(s => (
                  <label key={s} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="checkbox" checked={form.stores.includes(s)}
                      onChange={() => setForm({ ...form, stores: toggleCheckbox(form.stores, s) })} />
                    <span className="capitalize">{s.toLowerCase()}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="md:col-span-2 flex gap-3">
              <button type="submit" className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700">
                {editUser ? 'Guardar cambios' : 'Crear usuario'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditUser(null) }}
                className="border border-gray-300 px-4 py-2 rounded-lg text-sm hover:bg-gray-100">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabla de usuarios */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Cargando usuarios...</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Usuario</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Roles</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tiendas</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map(u => (
                <tr key={u.id} className={`hover:bg-gray-50 ${!u.active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{u.name}</div>
                    <div className="text-gray-400 text-xs">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(u.roles || []).map(r => (
                        <span key={r} className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100 capitalize">{r}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(u.stores || []).map(s => (
                        <span key={s} className={`px-2 py-0.5 rounded-full text-xs font-medium border ${s === 'MUJERES' ? 'bg-pink-50 text-pink-700 border-pink-100' : 'bg-indigo-50 text-indigo-700 border-indigo-100'}`}>
                          {s === 'MUJERES' ? 'Mujeres' : 'Hombres'}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                      {u.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => { setEditUser(u); setForm({ name: u.name, email: u.email, password: '', roles: u.roles || [], stores: u.stores || [] }); setShowForm(false) }}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleToggleActive(u)}
                        className={`p-1.5 rounded-lg ${u.active ? 'hover:bg-red-50 text-red-400 hover:text-red-600' : 'hover:bg-emerald-50 text-emerald-400 hover:text-emerald-600'}`}>
                        {u.active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
