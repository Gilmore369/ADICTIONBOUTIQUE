'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Lock, Eye, EyeOff, Wand2, Loader2, AlertCircle, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UserRow } from './user-form-dialog'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  user: UserRow | null
  onSuccess: () => void
}

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

export function ResetPasswordDialog({ open, onOpenChange, user, onSuccess }: Props) {
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const valid = password.length >= 8

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid || !user) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/users/${user.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Error al restablecer')
        return
      }
      onSuccess()
      onOpenChange(false)
      setPassword('')
    } finally {
      setSaving(false)
    }
  }

  function copy() {
    navigator.clipboard.writeText(password)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setPassword(''); setError(''); setShow(false) } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-amber-600" />
            Restablecer contraseña
          </DialogTitle>
          <DialogDescription>
            Asigna una nueva contraseña a <strong>{user?.name}</strong>. El usuario perderá el acceso con la contraseña anterior.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div>
            <Label className="mb-1.5 block">Nueva contraseña</Label>
            <div className="relative">
              <Input
                type={show ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="pr-24 font-mono"
                autoFocus
              />
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1">
                {password && (
                  <button
                    type="button"
                    onClick={copy}
                    className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                    title="Copiar"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPassword(generatePassword())}
                  className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                  title="Generar"
                >
                  <Wand2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setShow(v => !v)}
                  className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                >
                  {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            {password && !valid && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Faltan {8 - password.length} caracteres
              </p>
            )}
          </div>

          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 dark:text-amber-200">
            <p className="font-semibold mb-1">⚠ Recuerda comunicar al usuario:</p>
            <p>Copia la nueva contraseña con el botón <Copy className="inline w-3 h-3" /> y envíala por un canal seguro (WhatsApp privado, correo). El sistema no la mostrará después de cerrar este diálogo.</p>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 text-red-700 dark:text-red-300 rounded-lg p-3 text-sm">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={!valid || saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Restablecer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
