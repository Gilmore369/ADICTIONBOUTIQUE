/**
 * API Route to expand shortened URLs
 * Used to expand Google Maps shortened links (maps.app.goo.gl) to get coordinates
 */

import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
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

export async function GET(request: NextRequest) {
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
