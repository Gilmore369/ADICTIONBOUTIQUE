'use client'

/**
 * Settings Form Component V2
 * 
 * Formulario para configurar datos de la tienda y subir logo
 * Corrige error 404 del logo y mejora el upload
 * 
 * Design tokens:
 * - Card padding: 16px
 * - Border radius: 8px
 * - Button height: 36px
 * - Spacing: 8px, 16px
 */

import { useState, useRef, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Upload, Save, Image as ImageIcon, X } from 'lucide-react'
import { toast } from 'sonner'

interface StoreConfig {
  name: string
  address: string
  phone: string
  ruc: string
  logo: string
}

export function SettingsForm() {
  const [config, setConfig] = useState<StoreConfig>({
    name: 'ADICTION BOUTIQUE',
    address: '',
    phone: '',
    ruc: '',
    logo: ''
  })
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load config: primero desde la API (Supabase), luego localStorage como fallback
  useEffect(() => {
    const loadConfig = async () => {
      try {
        // 1. Intentar cargar desde la API (Supabase — persiste entre dispositivos)
        const res = await fetch('/api/settings')
        if (res.ok) {
          const data = await res.json()
          const hasRealData = data.address || data.phone || data.ruc
          if (hasRealData) {
            setConfig(prev => ({
              ...prev,
              name:    data.name    || prev.name,
              address: data.address || prev.address,
              phone:   data.phone   || prev.phone,
              ruc:     data.ruc     || prev.ruc,
              logo:    data.logo    || prev.logo,
            }))
            if (data.logo) setLogoPreview(data.logo)
            // Sync to localStorage
            localStorage.setItem('store_config', JSON.stringify(data))
            if (data.logo) localStorage.setItem('store_logo', data.logo)
            return
          }
        }
      } catch { /* fallback a localStorage */ }

      // 2. Fallback: localStorage
      const savedLogo = localStorage.getItem('store_logo')
      const savedConfig = localStorage.getItem('store_config')
      if (savedLogo) {
        setLogoPreview(savedLogo)
        setConfig(prev => ({ ...prev, logo: savedLogo }))
      }
      if (savedConfig) {
        try {
          const parsed = JSON.parse(savedConfig)
          setConfig(prev => ({ ...prev, ...parsed }))
        } catch (error) {
          console.error('Error loading config:', error)
        }
      }
    }
    loadConfig()
  }, [])

  const processLogoFile = async (file: File) => {
    console.log('[Settings] Processing file:', file.name, file.type, file.size)

    // Validate file type
    if (!file.type.startsWith('image/')) {
      console.error('[Settings] Invalid file type:', file.type)
      toast.error('Por favor selecciona una imagen válida')
      return
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      console.error('[Settings] File too large:', file.size)
      toast.error('La imagen no debe superar 2MB')
      return
    }

    setUploading(true)
    console.log('[Settings] Reading file...')

    try {
      // Create preview
      const reader = new FileReader()
      reader.onloadend = async () => {
        const result = reader.result as string
        console.log('[Settings] File read successfully, size:', result.length)
        setLogoPreview(result)
        
        // Save to localStorage
        try {
          localStorage.setItem('store_logo', result)
          console.log('[Settings] Logo saved to localStorage')
        } catch (error) {
          console.error('[Settings] Error saving to localStorage:', error)
        }

        // Save to server
        try {
          const formData = new FormData()
          formData.append('logo', file)

          const response = await fetch('/api/settings/upload-logo', {
            method: 'POST',
            body: formData
          })

          if (!response.ok) {
            throw new Error('Error al subir el logo al servidor')
          }

          const data = await response.json()
          console.log('[Settings] Logo uploaded to server:', data)
          toast.success('Logo guardado exitosamente')
          window.dispatchEvent(new Event('storage'))
        } catch (error) {
          console.error('[Settings] Error uploading to server:', error)
          toast.error('Logo guardado localmente, pero no se pudo subir al servidor')
        } finally {
          setUploading(false)
        }
      }
      reader.onerror = () => {
        console.error('[Settings] Error reading file')
        toast.error('Error al leer la imagen')
        setUploading(false)
      }
      reader.readAsDataURL(file)
    } catch (error) {
      console.error('[Settings] Error processing file:', error)
      toast.error('Error al procesar la imagen')
      setUploading(false)
    }
  }

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('[Settings] File input changed')
    const file = e.target.files?.[0]
    if (!file) {
      console.log('[Settings] No file selected')
      return
    }
    processLogoFile(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const file = e.dataTransfer.files?.[0]
    if (file) {
      console.log('[Settings] File dropped:', file.name)
      processLogoFile(file)
    }
  }

  const handleRemoveLogo = () => {
    setLogoPreview(null)
    setConfig(prev => ({ ...prev, logo: '' }))
    localStorage.removeItem('store_logo')
    toast.success('Logo eliminado')
    window.dispatchEvent(new Event('storage'))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const configToSave = { ...config, logo: logoPreview || '' }

      // 1. Guardar en Supabase vía API (persiste entre dispositivos/navegadores)
      try {
        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(configToSave)
        })
        if (!res.ok) console.warn('[Settings] API save failed:', await res.text())
      } catch (apiErr) {
        console.warn('[Settings] API save error:', apiErr)
      }

      // 2. Guardar en localStorage como cache local
      localStorage.setItem('store_config', JSON.stringify(configToSave))
      if (logoPreview) localStorage.setItem('store_logo', logoPreview)

      // Disparar evento para que otros componentes se actualicen
      window.dispatchEvent(new Event('storage'))

      toast.success('Configuración guardada exitosamente')
    } catch (error) {
      console.error('Error saving config:', error)
      toast.error('Error al guardar la configuración')
    } finally {
      setSaving(false)
    }
  }

  const handleUploadClick = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    console.log('[Settings] Upload button clicked')
    console.log('[Settings] File input ref:', fileInputRef.current)
    
    if (fileInputRef.current) {
      try {
        // Reset value to allow selecting the same file again
        fileInputRef.current.value = ''
        
        // Trigger click on the input
        fileInputRef.current.click()
        console.log('[Settings] File input clicked successfully')
      } catch (error) {
        console.error('[Settings] Error clicking file input:', error)
        toast.error('Error al abrir el selector de archivos')
      }
    } else {
      console.error('[Settings] File input ref is null')
      toast.error('Error: No se pudo abrir el selector de archivos')
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Store Information */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Información de la Tienda</h2>
        <div className="space-y-4">
          <div>
            <Label>Nombre de la Tienda *</Label>
            <Input
              value={config.name}
              onChange={(e) => setConfig({ ...config, name: e.target.value })}
              placeholder="Ej: Mi Boutique"
            />
          </div>

          <div>
            <Label>Dirección *</Label>
            <Textarea
              value={config.address}
              onChange={(e) => setConfig({ ...config, address: e.target.value })}
              placeholder="Ej: Av. Principal 123, Trujillo"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Teléfono *</Label>
              <Input
                value={config.phone}
                onChange={(e) => setConfig({ ...config, phone: e.target.value })}
                placeholder="(044) 555-9999"
              />
            </div>

            <div>
              <Label>RUC *</Label>
              <Input
                value={config.ruc}
                onChange={(e) => setConfig({ ...config, ruc: e.target.value })}
                placeholder="20123456789"
                maxLength={11}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Logo Upload */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Logo de la Tienda</h2>
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Sube el logo que aparecerá en los tickets de venta y en el sidebar. Tamaño recomendado: 200x200px (máx. 2MB)
          </p>

          {/* Logo Preview */}
          <div className="flex items-center gap-4">
            <label
              htmlFor="logo-upload-input"
              className={`relative w-32 h-32 border-2 border-dashed rounded-lg flex items-center justify-center transition-colors ${
                isDragging 
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' 
                  : 'border-gray-300 bg-gray-50 dark:bg-gray-800 dark:border-gray-700'
              } ${uploading ? 'opacity-50 cursor-wait' : 'cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/20'}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              title="Click o arrastra una imagen aquí"
              style={{ pointerEvents: uploading ? 'none' : 'auto' }}
            >
              {logoPreview ? (
                <>
                  <img
                    src={logoPreview}
                    alt="Logo preview"
                    className="max-w-full max-h-full object-contain p-2"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemoveLogo()
                    }}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors shadow-md"
                    title="Eliminar logo"
                    disabled={uploading}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <div className="text-center pointer-events-none">
                  <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-xs text-gray-500">
                    {uploading ? 'Subiendo...' : isDragging ? 'Suelta aquí' : 'Click o arrastra'}
                  </p>
                </div>
              )}
            </label>

            <div className="flex-1 space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/svg+xml"
                onChange={handleLogoChange}
                className="hidden"
                id="logo-upload-input"
                disabled={uploading}
              />
              <div>
                {/* Label nativo - más confiable en Windows */}
                <label
                  htmlFor="logo-upload-input"
                  className={`inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 w-full sm:w-auto ${
                    uploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                  }`}
                  style={{ pointerEvents: uploading ? 'none' : 'auto' }}
                >
                  <Upload className="h-4 w-4" />
                  {uploading ? 'Subiendo...' : logoPreview ? 'Cambiar Imagen' : 'Seleccionar Imagen'}
                </label>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Formatos: JPG, PNG, GIF, SVG (máx. 2MB)
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  💡 Tres formas de subir:
                </p>
                <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5 ml-4">
                  <li>• Click en el cuadro de arriba</li>
                  <li>• Click en "Seleccionar Imagen"</li>
                  <li>• Arrastra y suelta la imagen</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
              Cómo subir tu logo
            </h3>
            <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-decimal list-inside">
              <li>Haz click en el cuadro de arriba o en "Seleccionar Imagen"</li>
              <li>También puedes arrastrar y soltar la imagen directamente</li>
              <li>El logo se guardará automáticamente en el servidor</li>
              <li>Aparecerá en el sidebar y en todos los tickets de venta</li>
              <li>Para cambiar el logo, simplemente sube una nueva imagen</li>
            </ol>
          </div>
        </div>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="gap-2"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Guardando...' : 'Guardar Configuración'}
        </Button>
      </div>
    </div>
  )
}
