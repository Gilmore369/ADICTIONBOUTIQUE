# Map Module Components

Geographic visualization module for client locations with debt status indicators.

## Components

### ClientMap
Google Maps integration displaying client markers with color-coded debt status.

**Features:**
- Interactive map with client markers
- Color coding: Red (overdue), Yellow (upcoming), Green (no debt)
- Info windows with client details on marker click
- Auto-fit bounds to show all markers
- Responsive height (600px)

**Props:**
```typescript
interface ClientMapProps {
  clients: Client[]
}

interface Client {
  id: string
  name: string
  address: string | null
  lat: number | null
  lng: number | null
  debtStatus: 'overdue' | 'upcoming' | 'none'
  phone: string | null
  credit_used: number
}
```

**Design Tokens:**
- Border Radius: 8px (map container)
- Spacing: Standard border

### MapFilters
Filter controls for debt status categories.

**Features:**
- Checkbox filters: All, Overdue, Upcoming, No Debt
- Color indicators matching map markers
- Mutually exclusive "All" filter
- Responsive flex layout

**Props:**
```typescript
interface MapFiltersProps {
  filters: {
    overdue: boolean
    upcoming: boolean
    noDebt: boolean
    all: boolean
  }
  onFilterChange: (filters: MapFiltersProps['filters']) => void
}
```

**Design Tokens:**
- Spacing: 16px (card padding), 4px (gap between filters)
- Border Radius: 8px (card)
- Typography: 14px (body text)

## Page: /map

**Route:** `/app/(auth)/map/page.tsx`

**Features:**
- Fetches clients with geolocation from Supabase
- Calculates debt status based on installments
- Real-time filtering
- Loading state
- Client count display

**Data Flow:**
1. Load clients with lat/lng from `clients` table
2. Load installments from `installments` and `credit_plans` tables
3. Calculate debt status:
   - **Overdue:** Has installments past due date
   - **Upcoming:** Has installments due within 7 days
   - **None:** No pending installments
4. Apply filters and render map

## Setup

### Environment Variables
Add to `.env.local`:
```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
```

### Google Maps API
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable Maps JavaScript API
3. Create API key
4. Restrict key to your domain (production)

### Dependencies
```bash
npm install @googlemaps/js-api-loader
```

## Performance Considerations

- Only loads clients with valid lat/lng coordinates
- Filters applied client-side (no re-fetch)
- Map bounds auto-adjust to visible markers
- Info windows created once per marker

## Mobile Responsive

- Map height: 600px (fixed)
- Filters: Flex wrap on small screens
- Touch-friendly marker interaction
