# Google Maps Coordinate Extraction - Fixed

## Problem
When creating clients in both POS and CRM, pasting a shortened Google Maps link (e.g., `https://maps.app.goo.gl/i7uBK2yJ9Hy6acuy6`) was not extracting the latitude and longitude coordinates.

## Root Cause
1. The API endpoint `/api/expand-url` only had a GET handler, but components were calling it with POST
2. The shortened URL validation was too restrictive (only checking for `maps.app.goo.gl`, not `goo.gl`)
3. The API response format wasn't consistent between GET and POST

## Solution

### 1. Updated API Endpoint (`app/api/expand-url/route.ts`)
- Added POST handler to accept JSON body with `{ url: string }`
- Made validation more flexible to accept both `maps.app.goo.gl` and `goo.gl` URLs
- Ensured consistent response format: `{ success: boolean, expandedUrl: string }`
- Kept GET handler for backward compatibility

### 2. Updated CreateClientDialog (`components/clients/create-client-dialog.tsx`)
- Fixed API call to use POST method with JSON body
- Added support for generic `goo.gl` URLs (not just `maps.app.goo.gl`)
- Proper error handling and toast notifications
- Shows processing status while extracting coordinates

### 3. Updated ClientForm (`components/clients/client-form.tsx`)
- Fixed API call to use POST method with JSON body
- Added support for generic `goo.gl` URLs
- Consistent with CreateClientDialog implementation

## Where This Works

### POS (Point of Sale)
- Location: `app/(auth)/pos/page.tsx`
- Uses: `CreateClientDialog` component
- Trigger: "Nuevo cliente" button when creating a credit sale
- ✅ Now supports shortened Google Maps links

### CRM (Client Management)
- Location: `app/(auth)/clients/page.tsx`
- Uses: `ClientForm` component (via ClientsListView → CreateClientDialog)
- Trigger: "Nuevo Cliente" button in clients list
- ✅ Now supports shortened Google Maps links

## Supported URL Formats

The system now supports all these Google Maps URL formats:

1. **Shortened links** (NEW):
   - `https://maps.app.goo.gl/i7uBK2yJ9Hy6acuy6`
   - `https://goo.gl/maps/xxxxx`

2. **Standard formats** (already supported):
   - `https://www.google.com/maps/@-12.0464,-77.0428,17z`
   - `https://maps.google.com/?q=-12.0464,-77.0428`
   - `https://www.google.com/maps/place/.../@-12.0464,-77.0428`
   - `https://maps.google.com/?ll=-12.0464,-77.0428`

## How It Works

1. User pastes a Google Maps link (shortened or full)
2. If it's a shortened link (`goo.gl`), the system:
   - Calls `/api/expand-url` to expand it
   - Follows redirects to get the full URL
3. Extracts coordinates using multiple regex patterns
4. Validates coordinates are within valid ranges (lat: -90 to 90, lng: -180 to 180)
5. Auto-fills the latitude and longitude fields
6. Shows success toast with extracted coordinates

## Testing

To test the fix:

1. **In POS**:
   - Go to `/pos`
   - Select "CREDITO" as sale type
   - Click "Nuevo cliente" button
   - Paste this link: `https://maps.app.goo.gl/i7uBK2yJ9Hy6acuy6`
   - Verify coordinates are extracted and shown

2. **In CRM**:
   - Go to `/clients`
   - Click "Nuevo Cliente" button
   - Paste the same shortened link
   - Verify coordinates are extracted

## Files Modified

1. `app/api/expand-url/route.ts` - Added POST handler
2. `components/clients/create-client-dialog.tsx` - Fixed API call method
3. `components/clients/client-form.tsx` - Fixed API call method

## Status
✅ **FIXED** - Both POS and CRM client creation now support shortened Google Maps links
