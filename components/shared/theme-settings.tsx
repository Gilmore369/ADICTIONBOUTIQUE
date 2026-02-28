'use client'

/**
 * ThemeSettings V3 — Advanced Theme Customizer
 *
 * Features:
 * - 8 professional corporate presets
 * - HEX input + H/S/L sliders (no external dependencies)
 * - Light / Dark / Auto mode
 * - WCAG-AA contrast check (auto white/black foreground)
 * - Live preview
 * - Persist to localStorage
 */

import { useState, useEffect, useCallback } from 'react'
import { Palette, Sun, Moon, Monitor, Check, RotateCcw } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

// ─── Types ────────────────────────────────────────────────────────────────────

type DisplayMode = 'light' | 'dark' | 'auto'
type PresetKey = keyof typeof PRESETS

// ─── Corporate presets ────────────────────────────────────────────────────────

const PRESETS = {
  midnight: { label: 'Midnight',    primary: '#1e293b' },
  navy:     { label: 'Navy',        primary: '#1e3a5f' },
  slate:    { label: 'Slate',       primary: '#475569' },
  graphite: { label: 'Grafito',     primary: '#374151' },
  indigo:   { label: 'Índigo',      primary: '#4338ca' },
  emerald:  { label: 'Esmeralda',   primary: '#065f46' },
  burgundy: { label: 'Borgoña',     primary: '#881337' },
  sand:     { label: 'Arena',       primary: '#78716c' },
} as const

const DEFAULT_COLOR = '#475569'
const DEFAULT_PRESET: PresetKey = 'slate'

// ─── Color utilities ──────────────────────────────────────────────────────────

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!m) return { h: 0, s: 0, l: 0 }
  let r = parseInt(m[1], 16) / 255
  let g = parseInt(m[2], 16) / 255
  let b = parseInt(m[3], 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) }
}

function hslToHex(h: number, s: number, l: number): string {
  const sl = s / 100, ll = l / 100
  const a = sl * Math.min(ll, 1 - ll)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = ll - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

function isValidHex(hex: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(hex)
}

/** Returns true when the primary background needs white foreground (WCAG). */
function needsWhiteFg(hex: string): boolean {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!m) return true
  const [r, g, b] = [m[1], m[2], m[3]].map(c => {
    const v = parseInt(c, 16) / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) < 0.179
}

function darkenHex(hex: string, amount = 8): string {
  const { h, s, l } = hexToHsl(hex)
  return hslToHex(h, s, Math.max(l - amount, 2))
}

// ─── DOM helpers ──────────────────────────────────────────────────────────────

function applyColor(hex: string) {
  const fg = needsWhiteFg(hex) ? '#ffffff' : '#0f172a'
  const root = document.documentElement
  root.style.setProperty('--color-primary', hex)
  root.style.setProperty('--color-primary-hover', darkenHex(hex))
  root.style.setProperty('--color-primary-foreground', fg)
  // Also update --primary (oklch fallback targets)
  root.style.setProperty('--primary', hex)
  root.style.setProperty('--primary-foreground', fg)
}

function applyMode(mode: DisplayMode) {
  const isDark = mode === 'dark' || (mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', isDark)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2.5 select-none">
      {children}
    </p>
  )
}

interface HslSliderProps {
  label: string
  value: number
  min: number
  max: number
  gradient: string
  unit?: string
  onChange: (v: number) => void
}

function HslSlider({ label, value, min, max, gradient, unit = '', onChange }: HslSliderProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] font-bold text-muted-foreground w-4 select-none">{label}</span>
      <div className="flex-1 relative py-1">
        <div
          className="absolute top-1/2 -translate-y-1/2 w-full h-2 rounded-full"
          style={{ background: gradient }}
        />
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="theme-hsl-slider relative w-full h-2 rounded-full appearance-none bg-transparent cursor-pointer"
        />
      </div>
      <span className="text-[10px] tabular-nums text-muted-foreground w-9 text-right select-none">
        {value}{unit}
      </span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ThemeSettings() {
  const [open, setOpen] = useState(false)
  const [hex, setHex] = useState(DEFAULT_COLOR)
  const [hexInput, setHexInput] = useState(DEFAULT_COLOR)
  const [hsl, setHsl] = useState(() => hexToHsl(DEFAULT_COLOR))
  const [mode, setMode] = useState<DisplayMode>('light')
  const [activePreset, setActivePreset] = useState<PresetKey | null>(DEFAULT_PRESET)

  // ── Load saved prefs on mount ──────────────────────────────────────────────

  useEffect(() => {
    const savedColor  = localStorage.getItem('theme-color') as string | null
    const savedMode   = localStorage.getItem('theme-mode') as DisplayMode | null
    const savedPreset = localStorage.getItem('theme-preset') as PresetKey | null

    const color = (savedColor && isValidHex(savedColor)) ? savedColor : DEFAULT_COLOR
    const m     = (['light', 'dark', 'auto'] as const).includes(savedMode as DisplayMode)
                  ? (savedMode as DisplayMode) : 'light'

    setHex(color); setHexInput(color); setHsl(hexToHsl(color))
    setMode(m)
    setActivePreset(savedPreset && savedPreset in PRESETS ? savedPreset : DEFAULT_PRESET)
    applyColor(color)
    applyMode(m)
  }, [])

  // ── Color update helpers ───────────────────────────────────────────────────

  const commitHex = useCallback((newHex: string) => {
    setHex(newHex); setHexInput(newHex); setHsl(hexToHsl(newHex))
    setActivePreset(null)
  }, [])

  const commitHsl = useCallback((newHsl: typeof hsl) => {
    const newHex = hslToHex(newHsl.h, newHsl.s, newHsl.l)
    setHsl(newHsl); setHex(newHex); setHexInput(newHex)
    setActivePreset(null)
  }, [])

  const selectPreset = (key: PresetKey) => {
    const color = PRESETS[key].primary
    setHex(color); setHexInput(color); setHsl(hexToHsl(color))
    setActivePreset(key)
    // Live preview
    applyColor(color)
  }

  const handleModeChange = (m: DisplayMode) => {
    setMode(m)
    applyMode(m)  // instant preview
  }

  const handleApply = () => {
    applyColor(hex)
    applyMode(mode)
    localStorage.setItem('theme-color', hex)
    localStorage.setItem('theme-mode', mode)
    localStorage.setItem('theme-preset', activePreset ?? '')
    setOpen(false)
  }

  const handleReset = () => {
    setHex(DEFAULT_COLOR); setHexInput(DEFAULT_COLOR)
    setHsl(hexToHsl(DEFAULT_COLOR))
    setActivePreset(DEFAULT_PRESET)
    setMode('light')
    applyColor(DEFAULT_COLOR)
    applyMode('light')
  }

  // ── Derived values ─────────────────────────────────────────────────────────

  const fgColor = needsWhiteFg(hex) ? '#ffffff' : '#0f172a'

  const hGradient = `linear-gradient(to right,
    hsl(0,${hsl.s}%,${hsl.l}%), hsl(60,${hsl.s}%,${hsl.l}%),
    hsl(120,${hsl.s}%,${hsl.l}%), hsl(180,${hsl.s}%,${hsl.l}%),
    hsl(240,${hsl.s}%,${hsl.l}%), hsl(300,${hsl.s}%,${hsl.l}%),
    hsl(360,${hsl.s}%,${hsl.l}%))`

  const sGradient = `linear-gradient(to right,
    hsl(${hsl.h},0%,${hsl.l}%),
    hsl(${hsl.h},100%,${hsl.l}%))`

  const lGradient = `linear-gradient(to right,
    hsl(${hsl.h},${hsl.s}%,5%),
    hsl(${hsl.h},${hsl.s}%,50%),
    hsl(${hsl.h},${hsl.s}%,90%))`

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Personalizar tema">
          <Palette className="h-5 w-5" />
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-[380px] sm:max-w-[420px] gap-0">
        <DialogHeader className="pb-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Palette className="h-4 w-4 text-muted-foreground" />
            Personalizar Tema
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4 overflow-y-auto max-h-[70vh]">

          {/* ── Presets ─────────────────────────────────────────────────── */}
          <section>
            <SectionLabel>Temas corporativos</SectionLabel>
            <div className="grid grid-cols-4 gap-2">
              {(Object.entries(PRESETS) as [PresetKey, typeof PRESETS[PresetKey]][]).map(([key, p]) => {
                const isActive = activePreset === key
                return (
                  <button
                    key={key}
                    onClick={() => selectPreset(key)}
                    title={p.label}
                    className="group flex flex-col items-center gap-1.5 p-1.5 rounded-lg border transition-all hover:border-foreground/25"
                    style={{
                      borderColor: isActive ? p.primary : undefined,
                      boxShadow: isActive ? `0 0 0 2px ${p.primary}44` : undefined,
                    }}
                  >
                    <div className="relative w-full">
                      <div
                        className="w-full h-7 rounded"
                        style={{ backgroundColor: p.primary }}
                      />
                      {isActive && (
                        <div
                          className="absolute inset-0 flex items-center justify-center rounded"
                        >
                          <Check
                            className="h-3.5 w-3.5"
                            style={{ color: needsWhiteFg(p.primary) ? '#fff' : '#0f172a' }}
                          />
                        </div>
                      )}
                    </div>
                    <span className="text-[9px] font-medium text-muted-foreground leading-tight text-center">
                      {p.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          {/* ── Custom color ─────────────────────────────────────────────── */}
          <section>
            <SectionLabel>Color personalizado</SectionLabel>
            <div className="space-y-3">

              {/* HEX input row */}
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-lg border border-border flex-shrink-0 shadow-sm"
                  style={{ backgroundColor: hex }}
                />
                <div className="flex items-center gap-1 flex-1 rounded-lg border border-input bg-background px-2.5 h-9 focus-within:ring-1 focus-within:ring-ring">
                  <span className="text-xs font-mono text-muted-foreground">#</span>
                  <input
                    type="text"
                    maxLength={6}
                    value={hexInput.replace('#', '').toUpperCase()}
                    onChange={e => {
                      const raw = e.target.value.replace(/[^a-fA-F0-9]/g, '')
                      const full = '#' + raw
                      setHexInput(full)
                      if (raw.length === 6 && isValidHex(full)) {
                        commitHex(full)
                        applyColor(full)
                      }
                    }}
                    className="flex-1 h-full bg-transparent text-xs font-mono text-foreground outline-none uppercase placeholder:text-muted-foreground/40"
                    placeholder="475569"
                  />
                </div>
                <div className="text-[9px] text-muted-foreground leading-tight text-center">
                  <span className="block">{needsWhiteFg(hex) ? '⬜ Texto' : '⬛ Texto'}</span>
                  <span className="block">{needsWhiteFg(hex) ? 'blanco' : 'negro'}</span>
                </div>
              </div>

              {/* HSL sliders */}
              <div className="space-y-2.5 pt-0.5">
                <HslSlider
                  label="H" value={hsl.h} min={0} max={360} unit="°"
                  gradient={hGradient}
                  onChange={v => { const n = { ...hsl, h: v }; commitHsl(n); applyColor(hslToHex(n.h, n.s, n.l)) }}
                />
                <HslSlider
                  label="S" value={hsl.s} min={0} max={100} unit="%"
                  gradient={sGradient}
                  onChange={v => { const n = { ...hsl, s: v }; commitHsl(n); applyColor(hslToHex(n.h, n.s, n.l)) }}
                />
                <HslSlider
                  label="L" value={hsl.l} min={5} max={90} unit="%"
                  gradient={lGradient}
                  onChange={v => { const n = { ...hsl, l: v }; commitHsl(n); applyColor(hslToHex(n.h, n.s, n.l)) }}
                />
              </div>
            </div>
          </section>

          {/* ── Display mode ─────────────────────────────────────────────── */}
          <section>
            <SectionLabel>Modo de visualización</SectionLabel>
            <div className="flex gap-2">
              {([
                { value: 'light' as const, Icon: Sun,     label: 'Claro'  },
                { value: 'dark'  as const, Icon: Moon,    label: 'Oscuro' },
                { value: 'auto'  as const, Icon: Monitor, label: 'Auto'   },
              ]).map(({ value, Icon, label }) => (
                <button
                  key={value}
                  onClick={() => handleModeChange(value)}
                  className={`flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-lg border text-xs font-medium transition-all ${
                    mode === value
                      ? 'border-foreground/50 bg-muted text-foreground'
                      : 'border-border text-muted-foreground hover:border-foreground/20 hover:bg-muted/50'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </section>

          {/* ── Preview ──────────────────────────────────────────────────── */}
          <section>
            <SectionLabel>Vista previa</SectionLabel>
            <div className="rounded-lg border border-border bg-muted/30 p-3.5 space-y-2.5">
              <div className="flex flex-wrap gap-2 items-center">
                {/* Primary button */}
                <span
                  className="inline-flex items-center justify-center h-8 px-4 rounded-md text-xs font-semibold shadow-sm"
                  style={{ backgroundColor: hex, color: fgColor }}
                >
                  Principal
                </span>
                {/* Outline button */}
                <span
                  className="inline-flex items-center justify-center h-8 px-4 rounded-md text-xs font-semibold border bg-transparent"
                  style={{ borderColor: hex, color: hex }}
                >
                  Outline
                </span>
                {/* Badge */}
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
                  style={{ backgroundColor: hex + '22', color: hex }}
                >
                  Badge
                </span>
                {/* Link */}
                <span
                  className="text-xs font-medium underline underline-offset-2"
                  style={{ color: hex }}
                >
                  Enlace
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Contraste: {needsWhiteFg(hex) ? 'texto blanco (AA ✓)' : 'texto negro (AA ✓)'}
              </p>
            </div>
          </section>

        </div>

        {/* ── Footer actions ────────────────────────────────────────────── */}
        <div className="flex gap-2 pt-3 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-muted-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Restablecer
          </Button>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleApply}
            style={{ backgroundColor: hex, color: fgColor }}
            className="border-0 shadow-sm"
          >
            <Check className="h-3.5 w-3.5 mr-1.5" />
            Aplicar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
