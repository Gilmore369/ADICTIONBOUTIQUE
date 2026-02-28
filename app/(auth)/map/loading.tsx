import { Card } from '@/components/ui/card'

export default function MapLoading() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div>
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-2 animate-pulse"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse"></div>
      </div>

      {/* Legend Skeleton */}
      <Card className="p-4">
        <div className="h-4 bg-gray-200 rounded w-1/6 mb-2 animate-pulse"></div>
        <div className="flex gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-200 animate-pulse"></div>
              <div className="h-3 bg-gray-200 rounded w-16 animate-pulse"></div>
            </div>
          ))}
        </div>
      </Card>

      {/* Map Skeleton */}
      <Card className="p-0">
        <div className="h-[600px] bg-gray-200 animate-pulse"></div>
      </Card>

      {/* Stats Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-4">
            <div className="h-3 bg-gray-200 rounded w-2/3 mb-2 animate-pulse"></div>
            <div className="h-8 bg-gray-200 rounded w-1/2 animate-pulse"></div>
          </Card>
        ))}
      </div>
    </div>
  )
}
