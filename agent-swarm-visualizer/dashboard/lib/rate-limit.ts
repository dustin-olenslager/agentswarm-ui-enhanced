import { NextRequest } from 'next/server'

interface RateLimitStore {
  [key: string]: {
    count: number
    resetTime: number
  }
}

// In-memory store (use Redis in production)
const store: RateLimitStore = {}

const WINDOW_SIZE = 15 * 60 * 1000 // 15 minutes
const CLEANUP_INTERVAL = 60 * 60 * 1000 // 1 hour

// Cleanup expired entries
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of Object.entries(store)) {
    if (now > value.resetTime) {
      delete store[key]
    }
  }
}, CLEANUP_INTERVAL)

export async function rateLimit(
  request: NextRequest,
  maxAttempts: number = 10
): Promise<{ error?: string; remaining?: number }> {
  const ip = request.ip || 
            request.headers.get('x-forwarded-for')?.split(',')[0] || 
            request.headers.get('x-real-ip') ||
            'unknown'
  
  const key = `rate_limit:${ip}`
  const now = Date.now()
  
  let entry = store[key]
  
  if (!entry || now > entry.resetTime) {
    // Create new entry or reset expired one
    entry = {
      count: 0,
      resetTime: now + WINDOW_SIZE
    }
    store[key] = entry
  }
  
  entry.count++
  
  if (entry.count > maxAttempts) {
    const resetIn = Math.ceil((entry.resetTime - now) / 1000 / 60) // minutes
    return {
      error: `Too many attempts. Try again in ${resetIn} minutes.`
    }
  }
  
  return {
    remaining: maxAttempts - entry.count
  }
}