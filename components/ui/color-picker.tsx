'use client'

/**
 * ColorPicker — Two variants:
 *
 *  1. ColorPicker (full, inline palette grid + custom input)
 *     Used in ProductForm edit mode.
 *
 *  2. CompactColorPicker (for table cells)
 *     Trigger = small swatch button.
 *     Opens AdvancedColorPicker overlay (canvas HSV + hue bar + RGB inputs
 *     + preset swatches row) — matches the photo-2 design.
 */

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
} from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Palette ───────────────────────────────────────────────────────────────────

export const BOUTIQUE_COLORS = [
  { name: 'Negro',    hex: '#111111' },
  { name: 'Gris',     hex: '#6B7280' },
  { name: 'Plata',    hex: '#C0C0C0' },
  { name: 'Blanco',   hex: '#FFFFFF' },
  { name: 'Rojo',     hex: '#DC2626' },
  { name: 'Vino',     hex: '#7F1D1D' },
  { name: 'Rosa',     hex: '#F472B6' },
  { name: 'Fucsia',   hex: '#EC4899' },
  { name: 'Naranja',  hex: '#F97316' },
  { name: 'Amarillo', hex: '#EAB308' },
  { name: 'Beige',    hex: '#D4A574' },
  { name: 'Camel',    hex: '#C19A6B' },
  { name: 'Verde',    hex: '#16A34A' },
  { name: 'Olivo',    hex: '#84894A' },
  { name: 'Menta',    hex: '#6EE7B7' },
  { name: 'Teal',     hex: '#0D9488' },
  { name: 'Celeste',  hex: '#38BDF8' },
  { name: 'Azul',     hex: '#2563EB' },
  { name: 'Marino',   hex: '#1E3A5F' },
  { name: 'Morado',   hex: '#7C3AED' },
]

// ── Color math helpers ────────────────────────────────────────────────────────

function hexForName(name: string) {
  return BOUTIQUE_COLORS.find(
    (c) => c.name.toLowerCase() === name.toLowerCase(),
  )?.hex ?? null
}

function nameForHex(hex: string) {
  return BOUTIQUE_COLORS.find(
    (c) => c.hex.toLowerCase() === hex.toLowerCase(),
  )?.name ?? null
}

function isLight(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 140
}

function hexToRgb(hex: string): [number, number, number] {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!r) return [0, 0, 0]
  return [parseInt(r[1], 16), parseInt(r[2], 16), parseInt(r[3], 16)]
}

function rgbToHex(r: number, g: number, b: number) {
  return (
    '#' + [r, g, b].map((x) => Math.max(0, Math.min(255, x)).toString(16).padStart(2, '0')).join('')
  )
}

function rgbToHsv(
  r: number,
  g: number,
  b: number,
): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const diff = max - min
  let h = 0
  const s = max === 0 ? 0 : diff / max
  const v = max
  if (diff !== 0) {
    if (max === r) h = ((g - b) / diff) % 6
    else if (max === g) h = (b - r) / diff + 2
    else h = (r - g) / diff + 4
    h = Math.round(h * 60)
    if (h < 0) h += 360
  }
  return [h, s, v]
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let r = 0, g = 0, b = 0
  if (h < 60) { r = c; g = x }
  else if (h < 120) { r = x; g = c }
  else if (h < 180) { g = c; b = x }
  else if (h < 240) { g = x; b = c }
  else if (h < 300) { r = x; b = c }
  else { r = c; b = x }
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ]
}

// ── Draw helpers ──────────────────────────────────────────────────────────────

function drawSVCanvas(canvas: HTMLCanvasElement, hue: number) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const { width: w, height: h } = canvas

  // Hue base
  const hGrad = ctx.createLinearGradient(0, 0, w, 0)
  hGrad.addColorStop(0, '#ffffff')
  hGrad.addColorStop(1, `hsl(${hue}, 100%, 50%)`)
  ctx.fillStyle = hGrad
  ctx.fillRect(0, 0, w, h)

  // Black overlay
  const vGrad = ctx.createLinearGradient(0, 0, 0, h)
  vGrad.addColorStop(0, 'rgba(0,0,0,0)')
  vGrad.addColorStop(1, 'rgba(0,0,0,1)')
  ctx.fillStyle = vGrad
  ctx.fillRect(0, 0, w, h)
}

function drawHueBar(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const { width: w, height: h } = canvas
  const grad = ctx.createLinearGradient(0, 0, w, 0)
  const steps = [0, 60, 120, 180, 240, 300, 360]
  steps.forEach((deg) => grad.addColorStop(deg / 360, `hsl(${deg},100%,50%)`))
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)
}

// ── Advanced Color Picker ─────────────────────────────────────────────────────

interface AdvancedColorPickerProps {
  value: string          // color name (from palette) or hex
  onChange: (color: string) => void
  onClose: () => void
}

function AdvancedColorPicker({ value, onChange, onClose }: AdvancedColorPickerProps) {
  // Resolve initial hex
  const initialHex = (() => {
    const fromName = hexForName(value)
    if (fromName) return fromName
    if (/^#[0-9a-f]{6}$/i.test(value)) return value
    return '#DC2626'
  })()

  const [rgb, setRgb] = useState<[number, number, number]>(hexToRgb(initialHex))
  const [hsv, setHsv] = useState<[number, number, number]>(() => {
    const [r, g, b] = hexToRgb(initialHex)
    return rgbToHsv(r, g, b)
  })

  const [hue, saturation, brightness] = hsv

  const svCanvasRef = useRef<HTMLCanvasElement>(null)
  const hueCanvasRef = useRef<HTMLCanvasElement>(null)
  const svDragging = useRef(false)
  const hueDragging = useRef(false)

  // Sync from hsv → rgb whenever hsv changes
  useEffect(() => {
    const [r, g, b] = hsvToRgb(hue, saturation, brightness)
    setRgb([r, g, b])
  }, [hue, saturation, brightness])

  // Redraw SV canvas when hue changes
  useEffect(() => {
    const c = svCanvasRef.current
    if (c) drawSVCanvas(c, hue)
  }, [hue])

  // Draw hue bar once
  useEffect(() => {
    const c = hueCanvasRef.current
    if (c) drawHueBar(c)
  }, [])

  // ── Cursor positions ──────────────────────────────────────────────
  const svLeft = `${saturation * 100}%`
  const svTop = `${(1 - brightness) * 100}%`
  const hueLeft = `${(hue / 360) * 100}%`

  // ── SV canvas interaction ─────────────────────────────────────────
  const pickSV = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = svCanvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const s = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      const v = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height))
      setHsv([hue, s, v])
    },
    [hue],
  )

  const onSVMouseDown = (e: ReactMouseEvent) => {
    svDragging.current = true
    pickSV(e.clientX, e.clientY)
  }
  const onSVMouseMove = (e: ReactMouseEvent) => {
    if (svDragging.current) pickSV(e.clientX, e.clientY)
  }
  const onSVMouseUp = () => { svDragging.current = false }

  // ── Hue bar interaction ───────────────────────────────────────────
  const pickHue = useCallback((clientX: number) => {
    const canvas = hueCanvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const h = Math.max(0, Math.min(360, ((clientX - rect.left) / rect.width) * 360))
    setHsv([h, saturation, brightness])
  }, [saturation, brightness])

  const onHueMouseDown = (e: ReactMouseEvent) => {
    hueDragging.current = true
    pickHue(e.clientX)
  }
  const onHueMouseMove = (e: ReactMouseEvent) => {
    if (hueDragging.current) pickHue(e.clientX)
  }
  const onHueMouseUp = () => { hueDragging.current = false }

  // Global mouseup to stop dragging even outside
  useEffect(() => {
    const up = () => { svDragging.current = false; hueDragging.current = false }
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  }, [])

  // ── RGB inputs ────────────────────────────────────────────────────
  const handleRgbInput = (channel: 0 | 1 | 2, val: string) => {
    const n = Math.max(0, Math.min(255, parseInt(val, 10) || 0))
    const newRgb: [number, number, number] = [...rgb] as [number, number, number]
    newRgb[channel] = n
    setRgb(newRgb)
    setHsv(rgbToHsv(...newRgb))
  }

  // ── Preset swatch select ──────────────────────────────────────────
  const handlePreset = (hex: string) => {
    const [r, g, b] = hexToRgb(hex)
    setRgb([r, g, b])
    setHsv(rgbToHsv(r, g, b))
  }

  // ── Confirm ───────────────────────────────────────────────────────
  const handleConfirm = () => {
    const hex = rgbToHex(...rgb)
    const preset = nameForHex(hex)
    onChange(preset ?? hex)
    onClose()
  }

  const currentHex = rgbToHex(...rgb)
  const thumbColor = `hsl(${hue}, 100%, 50%)`

  return (
    <div className="w-[240px] rounded-2xl border border-gray-200 bg-white shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <span className="text-sm font-semibold text-gray-800">Color</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-3 space-y-3">
        {/* Preset swatches row */}
        <div className="grid grid-cols-10 gap-1">
          {BOUTIQUE_COLORS.map((c) => {
            const active =
              currentHex.toLowerCase() === c.hex.toLowerCase() ||
              (nameForHex(currentHex) ?? '') === c.name
            return (
              <button
                key={c.name}
                type="button"
                title={c.name}
                onClick={() => handlePreset(c.hex)}
                className={cn(
                  'h-5 w-5 rounded-md border transition-transform hover:scale-110',
                  c.hex.toUpperCase() === '#FFFFFF' || c.hex.toUpperCase() === '#C0C0C0'
                    ? 'border-gray-300'
                    : 'border-transparent',
                  active ? 'ring-2 ring-blue-500 ring-offset-1 scale-110' : '',
                )}
                style={{ backgroundColor: c.hex }}
              />
            )
          })}
        </div>

        {/* SV canvas */}
        <div className="relative select-none">
          <canvas
            ref={svCanvasRef}
            width={214}
            height={150}
            className="w-full cursor-crosshair rounded-xl"
            onMouseDown={onSVMouseDown}
            onMouseMove={onSVMouseMove}
            onMouseUp={onSVMouseUp}
          />
          {/* Thumb */}
          <div
            className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md"
            style={{
              left: svLeft,
              top: svTop,
              backgroundColor: currentHex,
            }}
          />
        </div>

        {/* Hue bar */}
        <div className="relative select-none">
          <canvas
            ref={hueCanvasRef}
            width={214}
            height={12}
            className="w-full cursor-ew-resize rounded-full"
            onMouseDown={onHueMouseDown}
            onMouseMove={onHueMouseMove}
            onMouseUp={onHueMouseUp}
          />
          {/* Thumb */}
          <div
            className="pointer-events-none absolute top-1/2 h-5 w-3 -translate-x-1/2 -translate-y-1/2 rounded-sm border-2 border-white shadow-md"
            style={{ left: hueLeft, backgroundColor: thumbColor }}
          />
        </div>

        {/* RGB inputs + hex preview */}
        <div className="flex items-center gap-2">
          {/* Color preview swatch */}
          <div
            className="h-8 w-8 shrink-0 rounded-lg border border-gray-200 shadow-inner"
            style={{ backgroundColor: currentHex }}
          />

          {/* R G B */}
          {(['R', 'G', 'B'] as const).map((label, i) => (
            <div key={label} className="flex-1 text-center">
              <div className="text-[10px] font-semibold text-gray-400">{label}</div>
              <input
                type="number"
                min={0}
                max={255}
                value={rgb[i]}
                onChange={(e) => handleRgbInput(i as 0 | 1 | 2, e.target.value)}
                className="w-full rounded-md border border-gray-200 bg-gray-50 px-1 py-0.5 text-center text-xs font-mono focus:border-blue-400 focus:outline-none"
              />
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-200 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 rounded-lg bg-blue-600 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
          >
            Elegir
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Full ColorPicker (inline, for product edit form) ──────────────────────────

export interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  placeholder?: string
  label?: string
  compact?: boolean
}

export function ColorPicker({ value, onChange, placeholder, label, compact }: ColorPickerProps) {
  const [customText, setCustomText] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const isPreset = BOUTIQUE_COLORS.some(
    (c) => c.name.toLowerCase() === value.toLowerCase(),
  )
  const selectedHex = hexForName(value)

  if (compact)
    return (
      <CompactColorPicker
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
    )

  const clearColor = () => {
    onChange('')
    setCustomText('')
    setShowCustom(false)
  }

  const handleCustomCommit = () => {
    const trimmed = customText.trim()
    if (trimmed) onChange(trimmed)
  }

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-700">{label}</span>
          {value && (
            <button type="button" onClick={clearColor} className="text-gray-400 hover:text-gray-600">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {value && (
        <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs">
          <div
            className="w-4 h-4 rounded-md flex-shrink-0 border border-gray-300"
            style={{ backgroundColor: selectedHex ?? (value.startsWith('#') ? value : '#ccc') }}
          />
          <span className="font-medium text-gray-700 flex-1 truncate">{value}</span>
          {!label && (
            <button type="button" onClick={clearColor} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-5 gap-0.5 p-2 bg-gray-50 rounded-xl border border-gray-200">
        {BOUTIQUE_COLORS.map((color) => {
          const light = isLight(color.hex)
          const whiteOutline =
            color.hex.toUpperCase() === '#FFFFFF' || color.hex.toUpperCase() === '#C0C0C0'
          const sel = value.toLowerCase() === color.name.toLowerCase()
          return (
            <button
              key={color.name}
              type="button"
              title={color.name}
              onClick={() => onChange(color.name)}
              className={cn(
                'group relative flex flex-col items-center gap-0.5 p-1 rounded-lg transition-all hover:bg-white',
                sel ? 'bg-blue-50 ring-1 ring-blue-400' : '',
              )}
            >
              <div
                className={cn(
                  'w-8 h-8 rounded-lg',
                  sel ? 'scale-105 ring-2 ring-blue-400 ring-offset-1' : '',
                  whiteOutline ? 'border border-gray-300' : '',
                )}
                style={{ backgroundColor: color.hex }}
              >
                {sel && (
                  <div className="w-full h-full flex items-center justify-center rounded-lg">
                    <Check className={cn('w-4 h-4', light ? 'text-gray-800' : 'text-white')} />
                  </div>
                )}
              </div>
              <span className={cn(
                'text-[9px] font-medium leading-none text-gray-600 max-w-[32px] truncate',
                sel ? 'text-blue-600' : '',
              )}>
                {color.name}
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => { setShowCustom(!showCustom); setTimeout(() => inputRef.current?.focus(), 50) }}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border transition-colors',
            showCustom || (!isPreset && value)
              ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
              : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300',
          )}
        >
          <div className="w-3 h-3 rounded-sm border border-dashed border-current" />
          <span>Personalizado</span>
          <ChevronDown className={cn('w-3 h-3 transition-transform', showCustom ? 'rotate-180' : '')} />
        </button>
        {!isPreset && value && (
          <span className="text-xs text-gray-500 truncate">← {value}</span>
        )}
      </div>

      {showCustom && (
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            onBlur={handleCustomCommit}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCustomCommit() } }}
            placeholder={placeholder ?? 'Ej: Azul Marino, Verde Agua…'}
            className="flex-1 h-8 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            type="button"
            onClick={handleCustomCommit}
            className="px-3 h-8 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            OK
          </button>
        </div>
      )}
    </div>
  )
}

// ── Compact ColorPicker (table cell) ──────────────────────────────────────────
// Uses fixed positioning so the picker escapes any overflow/scroll container.

export function CompactColorPicker({
  value,
  onChange,
  placeholder,
}: Omit<ColorPickerProps, 'compact'>) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

  const selectedHex = hexForName(value) ?? (value.startsWith('#') ? value : null)

  // Position the picker — always stays within viewport
  const handleOpen = () => {
    if (open) { setOpen(false); return }
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) {
      const PICKER_W = 248
      const PICKER_H = 420
      const GAP = 6
      const MARGIN = 8 // min distance from viewport edge

      // ── Vertical ──────────────────────────────────────────────────
      // Prefer opening ABOVE so it doesn't cover the row below
      const spaceAbove = rect.top
      const spaceBelow = window.innerHeight - rect.bottom
      let top: number
      if (spaceAbove >= PICKER_H + GAP) {
        // Enough space above → open above
        top = rect.top - PICKER_H - GAP
      } else if (spaceBelow >= PICKER_H + GAP) {
        // Enough space below → open below
        top = rect.bottom + GAP
      } else {
        // Neither — pick whichever has more room, clamp to viewport
        top = spaceAbove > spaceBelow
          ? Math.max(MARGIN, rect.top - PICKER_H - GAP)
          : Math.min(window.innerHeight - PICKER_H - MARGIN, rect.bottom + GAP)
      }

      // ── Horizontal ────────────────────────────────────────────────
      // Align left edge with trigger; shift left if it would overflow right
      let left = rect.left
      if (left + PICKER_W > window.innerWidth - MARGIN) {
        left = window.innerWidth - PICKER_W - MARGIN
      }
      left = Math.max(MARGIN, left)

      setPos({ top, left })
    }
    setOpen(true)
  }

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        pickerRef.current?.contains(e.target as Node)
      ) return
      setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <>
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        className={cn(
          'flex h-8 w-full items-center gap-1.5 rounded-lg border px-2 text-xs transition-colors',
          'border-gray-200 bg-white hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400',
        )}
      >
        <div
          className="h-4 w-4 shrink-0 rounded-md border border-gray-300"
          style={{ backgroundColor: selectedHex ?? '#E5E7EB' }}
        />
        <span className="flex-1 truncate text-left text-gray-700">
          {value || <span className="text-gray-400">{placeholder ?? 'Color'}</span>}
        </span>
        <ChevronDown className={cn('h-3 w-3 shrink-0 text-gray-400 transition-transform', open && 'rotate-180')} />
      </button>

      {/* Picker — rendered at fixed position, outside any scroll container */}
      {open && pos && (
        <div
          ref={pickerRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
        >
          <AdvancedColorPicker
            value={value}
            onChange={onChange}
            onClose={() => setOpen(false)}
          />
        </div>
      )}
    </>
  )
}
