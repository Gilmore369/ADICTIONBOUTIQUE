'use client'

import { useEffect, useState } from 'react'
import { Moon, Palette, Sun } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

type DisplayMode = 'light' | 'dark'

function clearCustomColor() {
  const root = document.documentElement
  root.style.removeProperty('--color-primary')
  root.style.removeProperty('--color-primary-hover')
  root.style.removeProperty('--color-primary-foreground')
  root.style.removeProperty('--primary')
  root.style.removeProperty('--primary-foreground')
  localStorage.removeItem('theme-color')
  localStorage.removeItem('theme-preset')
}

function applyMode(mode: DisplayMode) {
  document.documentElement.classList.toggle('dark', mode === 'dark')
  localStorage.setItem('theme-mode', mode)
}

export function ThemeSettings() {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<DisplayMode>('light')

  useEffect(() => {
    const savedMode = localStorage.getItem('theme-mode')
    const nextMode: DisplayMode = savedMode === 'dark' ? 'dark' : 'light'

    clearCustomColor()
    applyMode(nextMode)
  }, [])

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setMode(document.documentElement.classList.contains('dark') ? 'dark' : 'light')
    }
    setOpen(nextOpen)
  }

  const handleModeChange = (nextMode: DisplayMode) => {
    clearCustomColor()
    applyMode(nextMode)
    setMode(nextMode)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Cambiar tema" aria-label="Cambiar tema">
          <Palette className="h-4 w-4" />
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-[240px] gap-0 p-3">
        <DialogHeader className="pb-2.5">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Palette className="h-4 w-4 text-muted-foreground" />
            Tema
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          {[
            { value: 'light' as const, Icon: Sun, label: 'Claro' },
            { value: 'dark' as const, Icon: Moon, label: 'Oscuro' },
          ].map(({ value, Icon, label }) => {
            const isActive = mode === value

            return (
              <button
                key={value}
                type="button"
                onClick={() => handleModeChange(value)}
                className={`flex h-8 items-center justify-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors ${
                  isActive
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
