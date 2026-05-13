'use client'

/**
 * UserFormDialog
 * Diálogo modal para crear y editar usuarios. Validación cliente + server.
 */

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Shield, Store, User as UserIcon, Mail, Lock, Eye, EyeOff, Wand2, CheckCircle2, AlertCircle, Loader2, Upload, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useRef } from 'react'

export interface UserRow {
  id: string
  name: string
  email: string
  roles: string[]
  stores: string[]
  active: boolean
  created_at: string
  profile_photo_url?: string | null
}

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin', desc: 'Acceso total al sistema', tone: 'rose' as const },
  { value: 'vendedor', label: 'Vendedor', desc: 'POS, productos, clientes', tone: 'emerald' as const },
  { value: 'cajero', label: 'Cajero', desc: 'Caja, POS y operaciones', tone: 'amber' as const },
  { value: 'cobrador', label: 'Cobrador', desc: 'Mapa, visitas, cobros', tone: 'blue' as const },
]

const STORE_OPTIONS = [
  { value: 'MUJERES', label: 'Tienda Mujeres', tone: 'pink' as const },
  { value: 'HOMBRES', label: 'Tienda Hombres', tone: 'indigo' as const },
]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function generatePassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghjkmnpqrstuvwxyz'
  const nums  = '23456789'
  const syms  = '!@#$%&*'
  const all = upper + lower + nums + syms
  let pwd = ''
  pwd += upper[Math.floor(Math.random() * upper.length)]
  pwd += lower[Math.floor(Math.random() * lower.length)]
  pwd += nums[Math.floor(Math.random() * nums.length)]
  pwd += syms[Math.floor(Math.random() * syms.length)]
  for (let i = 0; i < 8; i++) pwd += all[Math.floor(Math.random() * all.length)]
  return pwd.split('').sort(() => Math.random() - 0.5).join('')
}

function passwordStrength(pwd: string): { score: number; label: string; color: string } {
  if (!pwd) return { score: 0, label: '', color: 'bg-muted' }
  let score = 0
  if (pwd.length >= 8) score++
  if (pwd.length >= 12) score++
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++
  if (/[0-9]/.test(pwd)) score++
  if (/[^a-zA-Z0-9]/.test(pwd)) score++
  const map = [
    { label: 'Muy débil', color: 'bg-red-500' },
    { label: 'Débil', color: 'bg-orange-500' },
    { label: 'Aceptable', color: 'bg-yellow-500' },
    { label: 'Buena', color: 'bg-blue-500' },
    { label: 'Fuerte', color: 'bg-emerald-500' },
    { label: 'Muy fuerte', color: 'bg-emerald-600' },
  ]
  return { score, ...map[score] }
}

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  editUser: UserRow | null
  onSuccess: () => void
}

export function UserFormDialog({ open, onOpenChange, editUser, onSuccess }: Props) {
  const isEdit = !!editUser
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [roles, setRoles] = useState<string[]>(['vendedor'])
  const [stores, setStores] = useState<string[]>(['MUJERES'])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string>('')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  // Reset form al abrir/cambiar usuario
  useEffect(() => {
    if (!open) return
    if (editUser) {
      setName(editUser.name)
      setEmail(editUser.email)
      setRoles(editUser.roles || [])
      setStores(editUser.stores || [])
      setProfilePhotoUrl(editUser.profile_photo_url || '')
    } else {
      setName('')
      setEmail('')
      setPassword('')
      setRoles(['vendedor'])
      setStores(['MUJERES'])
      setProfilePhotoUrl('')
    }
    setShowPwd(false)
    setError('')
  }, [open, editUser])

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Solo se permiten imágenes')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Máximo 5 MB')
      return
    }
    setUploadingPhoto(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('type', 'photo')
      const res = await fetch('/api/upload/client-photo', { method: 'POST', body: fd })
      const json = await res.json()
      if (json.success && json.data?.public_url) {
        setProfilePhotoUrl(json.data.public_url)
        toast.success('Foto subida')
      } else {
        toast.error(json.error || 'Error al subir')
      }
    } finally {
      setUploadingPhoto(false)
      if (photoInputRef.current) photoInputRef.current.value = ''
    }
  }

  const toggle = (list: string[], val: string, setter: (v: string[]) => void) => {
    setter(list.includes(val) ? list.filter(x => x !== val) : [...list, val])
  }

  // Validaciones cliente
  const nameValid = name.trim().length >= 2
  const emailValid = !isEdit ? EMAIL_RE.test(email.trim()) : true
  const pwdValid = isEdit ? true : password.length >= 8
  const rolesValid = roles.length > 0
  const storesValid = stores.length > 0
  const formValid = nameValid && emailValid && pwdValid && rolesValid && storesValid

  const pwdStrength = passwordStrength(password)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formValid) return
    setSaving(true)
    setError('')
    try {
      if (isEdit) {
        const res = await fetch(`/api/admin/users/${editUser.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), roles, stores, profile_photo_url: profilePhotoUrl || null }),
        })
        if (!res.ok) {
          const data = await res.json()
          setError(data.error || 'Error al actualizar')
          return
        }
      } else {
        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim().toLowerCase(),
            password,
            roles,
            stores,
            profile_photo_url: profilePhotoUrl || null,
          }),
        })
        if (!res.ok) {
          const data = await res.json()
          setError(data.error || 'Error al crear')
          return
        }
      }
      onSuccess()
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-emerald-600" />
            {isEdit ? 'Editar Usuario' : 'Crear Nuevo Usuario'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Modifica los datos del usuario. El email no es editable.'
              : 'Completa los datos para crear una cuenta de usuario.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          {/* Foto de perfil */}
          <div className="flex items-center gap-4 pb-3 border-b">
            <div className="relative">
              {profilePhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profilePhotoUrl}
                  alt="Avatar"
                  className="h-16 w-16 rounded-full object-cover border-2 border-border"
                />
              ) : (
                <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-950/40 border-2 border-border flex items-center justify-center text-lg font-bold text-emerald-700 dark:text-emerald-300">
                  {(name || email || '?').slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex-1">
              <Label className="text-sm">Foto de perfil</Label>
              <p className="text-xs text-muted-foreground mb-1.5">Opcional · aparecerá en la barra superior del usuario.</p>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
              />
              <div className="flex gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={uploadingPhoto}
                >
                  {uploadingPhoto ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}
                  {profilePhotoUrl ? 'Cambiar' : 'Subir foto'}
                </Button>
                {profilePhotoUrl && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs text-destructive hover:text-destructive"
                    onClick={() => setProfilePhotoUrl('')}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Datos básicos */}
          <div className="space-y-4">
            <div>
              <Label className="flex items-center gap-1.5 mb-1.5">
                <UserIcon className="w-3.5 h-3.5" />
                Nombre completo <span className="text-red-500">*</span>
              </Label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="María García López"
                className={cn(name && !nameValid && 'border-red-400')}
                autoFocus
              />
              {name && !nameValid && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Mínimo 2 caracteres
                </p>
              )}
            </div>

            {!isEdit && (
              <>
                <div>
                  <Label className="flex items-center gap-1.5 mb-1.5">
                    <Mail className="w-3.5 h-3.5" />
                    Correo electrónico <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="usuario@adictionboutique.com"
                    className={cn(email && !emailValid && 'border-red-400')}
                    autoComplete="off"
                  />
                  {email && !emailValid && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Formato inválido (ej: nombre@dominio.com)
                    </p>
                  )}
                </div>

                <div>
                  <Label className="flex items-center gap-1.5 mb-1.5">
                    <Lock className="w-3.5 h-3.5" />
                    Contraseña <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPwd ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                      className={cn('pr-20', password && !pwdValid && 'border-red-400')}
                      autoComplete="new-password"
                    />
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1">
                      <button
                        type="button"
                        onClick={() => setPassword(generatePassword())}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="Generar contraseña segura"
                      >
                        <Wand2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowPwd(v => !v)}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title={showPwd ? 'Ocultar' : 'Mostrar'}
                      >
                        {showPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {password && (
                    <div className="mt-2 space-y-1">
                      <div className="flex gap-1 h-1.5">
                        {[0, 1, 2, 3, 4].map(i => (
                          <div
                            key={i}
                            className={cn(
                              'flex-1 rounded-full transition-colors',
                              i < pwdStrength.score ? pwdStrength.color : 'bg-muted',
                            )}
                          />
                        ))}
                      </div>
                      <p className={cn(
                        'text-[11px] font-medium',
                        pwdStrength.score <= 1 && 'text-red-500',
                        pwdStrength.score === 2 && 'text-orange-500',
                        pwdStrength.score === 3 && 'text-yellow-600',
                        pwdStrength.score >= 4 && 'text-emerald-600',
                      )}>
                        {pwdStrength.label}
                        {password.length < 8 && ` · faltan ${8 - password.length} caracteres`}
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}

            {isEdit && (
              <div className="bg-muted/40 rounded-lg p-3 flex items-center gap-2">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">Email (no editable)</div>
                  <div className="text-sm font-medium">{editUser?.email}</div>
                </div>
              </div>
            )}
          </div>

          {/* Roles */}
          <div>
            <Label className="flex items-center gap-1.5 mb-2">
              <Shield className="w-3.5 h-3.5" />
              Roles <span className="text-red-500">*</span>
              <span className="text-xs text-muted-foreground font-normal ml-auto">
                Selecciona uno o más
              </span>
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              {ROLE_OPTIONS.map(r => {
                const active = roles.includes(r.value)
                const tone: Record<string, string> = {
                  rose: active ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40' : 'hover:border-rose-300',
                  emerald: active ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40' : 'hover:border-emerald-300',
                  amber: active ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40' : 'hover:border-amber-300',
                  blue: active ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40' : 'hover:border-blue-300',
                }
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => toggle(roles, r.value, setRoles)}
                    className={cn(
                      'relative text-left p-3 rounded-lg border-2 transition-all',
                      tone[r.tone],
                      !active && 'border-border bg-card',
                    )}
                  >
                    {active && (
                      <CheckCircle2 className="absolute top-2 right-2 w-4 h-4 text-emerald-600" />
                    )}
                    <div className="font-semibold text-sm capitalize">{r.label}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{r.desc}</div>
                  </button>
                )
              })}
            </div>
            {!rolesValid && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Debes asignar al menos un rol
              </p>
            )}
          </div>

          {/* Tiendas */}
          <div>
            <Label className="flex items-center gap-1.5 mb-2">
              <Store className="w-3.5 h-3.5" />
              Tiendas asignadas <span className="text-red-500">*</span>
              <span className="text-xs text-muted-foreground font-normal ml-auto">
                Filtra qué inventario puede ver/vender
              </span>
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {STORE_OPTIONS.map(s => {
                const active = stores.includes(s.value)
                const tone: Record<string, string> = {
                  pink: active ? 'border-pink-500 bg-pink-50 dark:bg-pink-950/40' : 'hover:border-pink-300',
                  indigo: active ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40' : 'hover:border-indigo-300',
                }
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => toggle(stores, s.value, setStores)}
                    className={cn(
                      'relative text-left p-3 rounded-lg border-2 transition-all',
                      tone[s.tone],
                      !active && 'border-border bg-card',
                    )}
                  >
                    {active && (
                      <CheckCircle2 className="absolute top-2 right-2 w-4 h-4 text-emerald-600" />
                    )}
                    <div className="font-semibold text-sm">{s.label}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {active ? 'Asignada' : 'No asignada'}
                    </div>
                  </button>
                )
              })}
            </div>
            {!storesValid && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Debes asignar al menos una tienda
              </p>
            )}
          </div>

          {/* Resumen visual */}
          {(rolesValid && storesValid) && (
            <div className="bg-muted/40 rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1.5">Resumen de permisos:</div>
              <div className="flex flex-wrap gap-1.5">
                {roles.map(r => (
                  <Badge key={r} variant="outline" className="capitalize">
                    <Shield className="w-3 h-3 mr-1" />{r}
                  </Badge>
                ))}
                {stores.map(s => (
                  <Badge
                    key={s}
                    variant="outline"
                    className={s === 'MUJERES' ? 'bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-300 border-pink-200' : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200'}
                  >
                    <Store className="w-3 h-3 mr-1" />
                    {s === 'MUJERES' ? 'Mujeres' : 'Hombres'}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 text-red-700 dark:text-red-300 rounded-lg p-3 flex items-start gap-2 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!formValid || saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEdit ? 'Guardar cambios' : 'Crear usuario'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
