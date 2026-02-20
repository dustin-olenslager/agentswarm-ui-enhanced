import { NextRequest, NextResponse } from 'next/server'
import { SignJWT } from 'jose'
import bcrypt from 'bcryptjs'
import { rateLimit } from '@/lib/rate-limit'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production'
)

// Production users - should be in environment variables
const USERS = [
  {
    id: '1',
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD_HASH || '$2a$10$rOZKTaHKjkMm5b7KV7Vl7e0QzYgNlFtHG5gSx.gzFqGOXY1YZY7fG', // 'admin123'
    role: 'admin'
  },
  {
    id: '2',
    username: process.env.VIEWER_USERNAME || 'viewer',
    password: process.env.VIEWER_PASSWORD_HASH || '$2a$10$rOZKTaHKjkMm5b7KV7Vl7e4QzYgNlFtHG5gSx.gzFqGOXY1YZY7fG', // 'viewer123'
    role: 'viewer'
  }
].filter(user => user.username !== 'admin' || process.env.ADMIN_USERNAME) // Only include admin if configured

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(request, 5) // 5 attempts per window
    if (rateLimitResult.error) {
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { username, password } = body

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      )
    }

    // Find user
    const user = USERS.find(u => u.username === username)
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password)
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // Create JWT token
    const token = await new SignJWT({ 
      userId: user.id,
      username: user.username,
      role: user.role 
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(JWT_SECRET)

    // Set secure cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    })

    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60, // 24 hours
      path: '/'
    })

    return response

  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}