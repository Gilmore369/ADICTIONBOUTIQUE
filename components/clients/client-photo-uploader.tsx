'use client'

/**
 * ClientPhotoUploader — sube foto DNI o foto del cliente al bucket
 * product-images/clients/{type}/ y guarda la URL pública.
 *
 * Reemplaza el input URL anterior que pedía pegar un link manualmente.
 */

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Upload, X, Loader2, Eye } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  type: 'dni' | 'photo'
  value: string
  onChange: (url: string) => void
}

export function ClientPhotoUploader({ type, value, onChange }: Props) {
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Solo se permiten imágenes (JPG, PNG, WEBP)')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen debe pesar menos de 5 MB')
      return
    }

    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('type', type)
      const res = await fetch('/api/upload/client-photo', { method: 'POST', body: fd })
      const json = await res.json()
      if (json.success && json.data?.public_url) {
        onChange(json.data.public_url)
        toast.success(type === 'dni' ? 'Foto del DNI subida' : 'Foto del cliente subida')
      } else {
        toast.error(json.error || 'Error al subir la imagen')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleRemove = () => {
    onChange('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
        disabled={uploading}
      />

      {value ? (
        <div className="flex items-center gap-3 p-2 border border-border rounded-lg bg-muted/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt={type === 'dni' ? 'DNI' : 'Cliente'}
            className="h-16 w-16 rounded object-cover border border-border flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground truncate">
              {type === 'dni' ? 'Foto del DNI cargada' : 'Foto del cliente cargada'}
            </p>
            <div className="flex gap-1.5 mt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => window.open(value, '_blank')}
              >
                <Eye className="h-3 w-3 mr-1" />
                Ver
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="h-3 w-3 mr-1" />
                Cambiar
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                onClick={handleRemove}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Subiendo...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              {type === 'dni' ? 'Subir foto del DNI' : 'Subir foto del cliente'}
            </>
          )}
        </Button>
      )}
    </div>
  )
}
