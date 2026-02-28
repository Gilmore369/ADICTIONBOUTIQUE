'use client'

/**
 * Image Upload Component
 *
 * Uploads image to Supabase Storage via /api/upload/product-image when
 * base_code is provided. Falls back to local data URL otherwise.
 *
 * Design tokens:
 * - Preview size: 80px (cuadrado con border-radius 8px)
 * - Spacing: 8px, 16px
 * - Button height: 36px
 */

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface ImageUploadProps {
  label?: string
  value?: string
  /** When provided, uploads to Supabase Storage as the primary model image */
  base_code?: string
  onChange: (url: string) => void
  onRemove?: () => void
  maxSizeMB?: number
}

export function ImageUpload({
  label = 'Imagen',
  value,
  base_code,
  onChange,
  onRemove,
  maxSizeMB = 2,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(value || null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Solo se permiten archivos de imagen')
      return
    }
    if (file.size / (1024 * 1024) > maxSizeMB) {
      toast.error(`La imagen debe ser menor a ${maxSizeMB}MB`)
      return
    }

    // Show local preview immediately
    const reader = new FileReader()
    reader.onloadend = () => setPreview(reader.result as string)
    reader.readAsDataURL(file)

    if (base_code) {
      // ── Upload to Supabase Storage ──────────────────────────────────────
      setUploading(true)
      try {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('base_code', base_code)
        fd.append('is_primary', 'true')

        const res  = await fetch('/api/upload/product-image', { method: 'POST', body: fd })
        const json = await res.json()

        if (json.success) {
          onChange(json.data.public_url)
          setPreview(json.data.public_url)
          toast.success('Imagen subida correctamente')
        } else {
          toast.error(json.error || 'Error al subir imagen')
          setPreview(null)
          if (fileInputRef.current) fileInputRef.current.value = ''
        }
      } catch (err) {
        console.error('[ImageUpload] Upload error:', err)
        toast.error('Error al conectar con el servidor')
        setPreview(null)
      } finally {
        setUploading(false)
      }
    } else {
      // ── No base_code: store as data URL (fallback) ──────────────────────
      reader.onloadend = () => {
        const dataUrl = reader.result as string
        setPreview(dataUrl)
        onChange(dataUrl)
        toast.success('Imagen cargada')
      }
    }
  }

  const handleRemove = () => {
    setPreview(null)
    onChange('')
    if (onRemove) onRemove()
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div>
      <Label className="text-xs">{label}</Label>

      <div className="flex items-center gap-3 mt-1">
        {/* Preview */}
        <div className="flex-shrink-0">
          {preview ? (
            <div className="relative">
              <img
                src={preview}
                alt="Preview"
                className="w-20 h-20 rounded-lg object-cover border border-border"
              />
              <button
                type="button"
                onClick={handleRemove}
                className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 hover:opacity-90 transition-opacity"
                disabled={uploading}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <div className="w-20 h-20 rounded-lg bg-muted border-2 border-dashed border-border flex items-center justify-center">
              <ImageIcon className="h-7 w-7 text-muted-foreground/40" />
            </div>
          )}
        </div>

        {/* Button + hint */}
        <div className="flex-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            disabled={uploading}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="gap-2"
          >
            {uploading
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Subiendo…</>
              : <><Upload className="h-4 w-4" /> {preview ? 'Cambiar' : 'Subir'}</>
            }
          </Button>
          <p className="text-xs text-muted-foreground mt-1">
            JPG, PNG, WEBP. Max {maxSizeMB}MB
          </p>
        </div>
      </div>
    </div>
  )
}
