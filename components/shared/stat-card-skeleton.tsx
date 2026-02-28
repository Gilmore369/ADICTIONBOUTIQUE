/**
 * Stat Card Skeleton
 * 
 * Loading skeleton for dashboard stat cards
 * Design tokens: card padding 16px, border-radius 8px
 */

import { Card } from '@/components/ui/card'

export function StatCardSkeleton() {
  return (
    <Card className="p-4 animate-pulse">
      <div className="h-4 w-24 bg-gray-200 rounded" />
      <div className="h-8 w-32 bg-gray-300 rounded mt-2" />
    </Card>
  )
}
