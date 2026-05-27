'use client'

/**
 * NavProgress
 * Barra de progreso superior que aparece automáticamente durante
 * navegaciones entre rutas y peticiones lentas. Da feedback visual
 * inmediato para que la app se sienta fluida.
 */

import { useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export function NavProgress() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [visible, setVisible] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    // Cada cambio de ruta dispara la animación
    setVisible(true)
    setProgress(15)
    const t1 = setTimeout(() => setProgress(45), 150)
    const t2 = setTimeout(() => setProgress(75), 400)
    const t3 = setTimeout(() => setProgress(95), 900)
    const t4 = setTimeout(() => {
      setProgress(100)
      setTimeout(() => { setVisible(false); setProgress(0) }, 300)
    }, 1400)
    return () => { [t1, t2, t3, t4].forEach(clearTimeout) }
  }, [pathname, searchParams])

  if (!visible) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none">
      <div
        className="h-[3px] bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 shadow-[0_0_10px_rgba(99,102,241,0.5)] transition-[width] duration-300 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}
