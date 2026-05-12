/**
 * API Route to expand shortened URLs
 * Used to expand Google Maps shortened links (maps.app.goo.gl) to get coordinates
 *
 * SEGURIDAD: este endpoint es público (lo usa el form de "crear cliente" antes
 * de tener sesión confirmada en algunos flows). Para evitar abuso como proxy
 * SSRF, limitamos a 10 requests por minuto por IP.
 */

import { NextRequest, NextResponse } from 'next/server'

// Rate limiter in-memory: 10 requests por minuto por IP
// (En clusters con múltiples workers PM2 cada worker tiene su propio mapa,
//  pero como límite blando de abuso es suficiente sin Redis.)
const RATE_LIMIT_WINDOW_MS = 60_000 // 1 minuto
const RATE_LIMIT_MAX = 10
const rateLimitMap = new Map<string, number[]>()

function getClientIp(req: NextRequest): string {
  // Apache reverse proxy → X-Forwarded-For
  const xff = req.headers.get('x-forwarded-for') || ''
  return xff.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown'
}

function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now()
  const timestamps = (rateLimitMap.get(ip) || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS)

  if (timestamps.length >= RATE_LIMIT_MAX) {
    const oldest = timestamps[0]
    return { allowed: false, remaining: 0, resetIn: Math.ceil((RATE_LIMIT_WINDOW_MS - (now - oldest)) / 1000) }
  }

  timestamps.push(now)
  rateLimitMap.set(ip, timestamps)

  // Limpieza periódica: si el mapa crece mucho, podar IPs sin actividad reciente
  if (rateLimitMap.size > 10_000) {
    for (const [k, v] of rateLimitMap) {
      if (v.every(t => now - t > RATE_LIMIT_WINDOW_MS)) rateLimitMap.delete(k)
    }
  }

  return { allowed: true, remaining: RATE_LIMIT_MAX - timestamps.length, resetIn: 0 }
}

function rateLimitResponse(resetIn: number) {
  return NextResponse.json(
    { success: false, error: `Demasiadas peticiones. Intenta en ${resetIn}s.` },
    { status: 429, headers: { 'Retry-After': String(resetIn) } }
  )
}

export async function POST(request: NextRequest) {
  // Rate limiting
  const ip = getClientIp(request)
  const limit = checkRateLimit(ip)
  if (!limit.allowed) return rateLimitResponse(limit.resetIn)

  try {
    const body = await request.json()
    const url = body.url

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'URL parameter is required' },
        { status: 400 }
      )
    }

    // Validate that it's a Google Maps URL
    if (!url.includes('maps.app.goo.gl') && !url.includes('goo.gl') && !url.includes('google.com/maps')) {
      return NextResponse.json(
        { success: false, error: 'Only Google Maps URLs are supported' },
        { status: 400 }
      )
    }

    // Use GET with browser-like User-Agent — Google blocks HEAD on maps.app.goo.gl
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)
    let expandedUrl = url
    let coordinates = null
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      })
      
      expandedUrl = response.url || url
      
      // Try to extract coordinates from HTML content
      const html = await response.text()
      
      // Pattern 1: Look for coordinates in URL format within HTML
      const urlPatterns = [
        /\/search\/(-?\d+\.?\d*),\s*\+?(-?\d+\.?\d*)/, // /search/lat,+lng
        /@(-?\d+\.?\d*),\s*\+?(-?\d+\.?\d*)/, // @lat,lng
        /!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/, // !3dlat!4dlng
        /center=(-?\d+\.?\d*),\s*\+?(-?\d+\.?\d*)/, // center=lat,lng
        /ll=(-?\d+\.?\d*),\s*\+?(-?\d+\.?\d*)/, // ll=lat,lng
        /q=(-?\d+\.?\d*),\s*\+?(-?\d+\.?\d*)/, // q=lat,lng
      ]
      
      for (const pattern of urlPatterns) {
        const match = html.match(pattern)
        if (match) {
          const lat = parseFloat(match[1])
          const lng = parseFloat(match[2])
          if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            coordinates = { lat, lng }
            break
          }
        }
      }
      
      // Pattern 2: Look in meta tags
      if (!coordinates) {
        const metaMatch = html.match(/<meta[^>]*content="([^"]*@-?\d+\.?\d*,-?\d+\.?\d*[^"]*)"/i)
        if (metaMatch) {
          const coordMatch = metaMatch[1].match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/)
          if (coordMatch) {
            const lat = parseFloat(coordMatch[1])
            const lng = parseFloat(coordMatch[2])
            if (!isNaN(lat) && !isNaN(lng)) {
              coordinates = { lat, lng }
            }
          }
        }
      }
      
      // Pattern 3: Look in JavaScript data
      if (!coordinates) {
        const jsPatterns = [
          /\[null,null,(-?\d+\.?\d*),(-?\d+\.?\d*)\]/,
          /"(-?\d+\.?\d+)","(-?\d+\.?\d+)"/,
          /center:\s*\{[^}]*lat:\s*(-?\d+\.?\d*)[^}]*lng:\s*(-?\d+\.?\d*)/,
        ]
        
        for (const pattern of jsPatterns) {
          const match = html.match(pattern)
          if (match) {
            const lat = parseFloat(match[1])
            const lng = parseFloat(match[2])
            if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
              coordinates = { lat, lng }
              break
            }
          }
        }
      }
      
    } finally {
      clearTimeout(timeoutId)
    }

    return NextResponse.json({
      success: true,
      originalUrl: url,
      expandedUrl,
      coordinates,
    })
  } catch (error) {
    console.error('Error expanding URL:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to expand URL',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  // Rate limiting
  const ip = getClientIp(request)
  const limit = checkRateLimit(ip)
  if (!limit.allowed) return rateLimitResponse(limit.resetIn)

  try {
    const searchParams = request.nextUrl.searchParams
    const url = searchParams.get('url')

    if (!url) {
      return NextResponse.json(
        { error: 'URL parameter is required' },
        { status: 400 }
      )
    }

    // Validate that it's a Google Maps URL
    if (!url.includes('maps.app.goo.gl') && !url.includes('google.com/maps')) {
      return NextResponse.json(
        { error: 'Only Google Maps URLs are supported' },
        { status: 400 }
      )
    }

    // Use GET with browser-like User-Agent — Google blocks HEAD on maps.app.goo.gl
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)
    let expandedUrl = url
    try {
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      })
      expandedUrl = response.url || url
    } finally {
      clearTimeout(timeoutId)
    }

    return NextResponse.json({
      success: true,
      originalUrl: url,
      expandedUrl,
    })
  } catch (error) {
    console.error('Error expanding URL:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to expand URL',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
