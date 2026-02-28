/**
 * React Query Provider
 * 
 * Configures TanStack Query (React Query) for client-side caching
 * with appropriate staleTime values per design system requirements.
 */

'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode, useState } from 'react'
import { PERFORMANCE } from '@/config/constants'

export function ReactQueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Default staleTime for catalogs (1 hour)
            staleTime: PERFORMANCE.CACHE_STALE_TIME.CATALOGS,
            // Retry failed requests
            retry: 1,
            // Refetch on window focus
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}
