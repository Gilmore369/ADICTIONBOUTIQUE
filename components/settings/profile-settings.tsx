'use client'

/**
 * Profile Settings Component
 * 
 * Allows users to update their profile information including profile photo
 */

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ImageUpload } from '@/components/ui/image-upload'
import { toast } from 'sonner'
import { User, Camera, Save } from 'lucide-react'

interface ProfileSettingsProps {
  user: {
    id: string
    email: string
    name?: string | null
    profile_photo_url?: string | null
  }
}

export function ProfileSettings({ user }: ProfileSettingsProps) {
  const [name, setName] = useState(user.name || '')
  const [profilePhoto, setProfilePhoto] = useState(user.profile_photo_url || '')
  const [saving, setSaving] = useState(false)

  const handlePhotoUpload = async (file: File) => {
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload/user-photo', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (result.success) {
        setProfilePhoto(result.data.public_url)
        toast.success('Foto de perfil actualizada')
        // Refresh the page to update the header
        window.location.reload()
      } else {
        toast.error(result.error || 'Error al subir la foto')
      }
    } catch (error) {
      console.error('Error uploading photo:', error)
      toast.error('Error al subir la foto')
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/users/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
        }),
      })

      const result = await response.json()

      if (result.success) {
        toast.success('Perfil actualizado')
        // Refresh the page to update the header
        window.location.reload()
      } else {
        toast.error(result.error || 'Error al actualizar el perfil')
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      toast.error('Error al actualizar el perfil')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Información del Perfil
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Profile Photo */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Foto de Perfil</Label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-border bg-muted flex items-center justify-center">
                {profilePhoto ? (
                  <img
                    src={profilePhoto}
                    alt="Foto de perfil"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <div className="space-y-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handlePhotoUpload(file)
                  }}
                  className="hidden"
                  id="profile-photo-input"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById('profile-photo-input')?.click()}
                  className="flex items-center gap-2"
                >
                  <Camera className="h-4 w-4" />
                  Cambiar foto
                </Button>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG o WebP. Máximo 5MB.
                </p>
              </div>
            </div>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Nombre completo</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ingresa tu nombre completo"
            />
          </div>

          {/* Email (read-only) */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              value={user.email}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              El email no se puede cambiar
            </p>
          </div>

          {/* Save Button */}
          <Button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}