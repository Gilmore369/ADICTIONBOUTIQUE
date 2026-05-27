/**
 * Loading UI compartido para todas las rutas (auth)
 *
 * Skeleton más realista que imita la estructura general de las páginas:
 * título + KPIs en fila + filtros + tabla. Animación de pulse en
 * diferentes delays para crear sensación de fluidez.
 */
export default function AuthLoading() {
  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="space-y-2">
        <div className="h-7 w-56 rounded-md bg-muted animate-pulse" />
        <div className="h-4 w-80 rounded-md bg-muted/70 animate-pulse" />
      </div>

      {/* 4 KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card p-5 space-y-3"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="h-3 w-20 rounded bg-muted animate-pulse" />
            <div className="h-8 w-32 rounded bg-muted animate-pulse" />
            <div className="h-3 w-24 rounded bg-muted/70 animate-pulse" />
          </div>
        ))}
      </div>

      {/* Main block: filters + table */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        {/* Filter row */}
        <div className="flex flex-wrap gap-3">
          <div className="h-9 w-64 rounded-lg bg-muted animate-pulse" />
          <div className="h-9 w-32 rounded-lg bg-muted animate-pulse" />
          <div className="h-9 w-32 rounded-lg bg-muted animate-pulse" />
          <div className="ml-auto h-9 w-28 rounded-lg bg-muted animate-pulse" />
        </div>

        {/* Table skeleton */}
        <div className="space-y-2">
          {/* Header */}
          <div className="flex gap-3 pb-2 border-b border-border">
            {[0, 1, 2, 3, 4, 5].map(c => (
              <div key={c} className="h-3 flex-1 rounded bg-muted/80 animate-pulse" />
            ))}
          </div>
          {/* Rows */}
          {[0, 1, 2, 3, 4, 5, 6, 7].map(r => (
            <div key={r} className="flex gap-3 py-3 border-b border-border/40">
              {[0, 1, 2, 3, 4, 5].map(c => (
                <div
                  key={c}
                  className="h-4 flex-1 rounded bg-muted/60 animate-pulse"
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
