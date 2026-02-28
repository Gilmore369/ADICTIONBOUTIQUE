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
    address: 'Av. Principal 123, Trujillo',
    phone: '(044) 555-9999',
    ruc: '20123456789',
    logo: ''
  })
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load logo and config from localStorage on mount
  useEffect(() => {
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
  }, [])

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor selecciona una imagen válida')
      return
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('La imagen no debe superar 2MB')
      return
    }

    // Create preview and save
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      setLogoPreview(result)
      // Save immediately to localStorage
      try {
        localStorage.setItem('store_logo', result)
        toast.success('Logo cargado correctamente')
        // Trigger storage event for other components
        window.dispatchEvent(new Event('storage'))
      } catch (error) {
        console.error('Error saving logo:', error)
        toast.error('Error al guardar el logo (archivo muy grande)')
      }
    }
    reader.onerror = () => {
      toast.error('Error al leer la imagen')
    }
    reader.readAsDataURL(file)
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
      // Save to localStorage
      localStorage.setItem('store_config', JSON.stringify(config))
      
      if (logoPreview) {
        localStorage.setItem('store_logo', logoPreview)
      }

      toast.success('Configuración guardada exitosamente')
    } catch (error) {
      console.error('Error saving config:', error)
      toast.error('Error al guardar la configuración')
    } finally {
      setSaving(false)
    }
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
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
            <div className="relative w-32 h-32 border-2 border-dashed rounded-lg flex items-center justify-center bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
              {logoPreview ? (
                <>
                  <img
                    src={logoPreview}
                    alt="Logo preview"
                    className="max-w-full max-h-full object-contain p-2"
                  />
                  <button
                    onClick={handleRemoveLogo}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors"
                    title="Eliminar logo"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <div className="text-center">
                  <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-xs text-gray-500">Sin logo</p>
                </div>
              )}
            </div>

            <div className="flex-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={handleUploadClick}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                {logoPreview ? 'Cambiar Imagen' : 'Seleccionar Imagen'}
              </Button>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Formatos: JPG, PNG, GIF, SVG (máx. 2MB)
              </p>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
              Instrucciones para usar el logo
            </h3>
            <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-decimal list-inside">
              <li>Selecciona una imagen de tu logo (preferiblemente con fondo transparente)</li>
              <li>La imagen se guardará en tu navegador automáticamente</li>
              <li>El logo aparecerá en el sidebar y en todos los tickets de venta</li>
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
