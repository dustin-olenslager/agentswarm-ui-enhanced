'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface User {
  id: string
  username: string
  role: string
}

export function AuthHeader() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetchUser()
  }, [])

  const fetchUser = async () => {
    try {
      const response = await fetch('/api/auth/me')
      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
      }
    } catch (error) {
      console.error('Failed to fetch user:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
      router.refresh()
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center space-x-4 animate-pulse">
        <div className="h-4 bg-gray-300 rounded w-20"></div>
        <div className="h-8 bg-gray-300 rounded w-16"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="flex items-center space-x-4 text-sm">
      <div className="flex items-center space-x-2">
        <div className={`w-2 h-2 rounded-full ${
          user.role === 'admin' ? 'bg-red-500' : 'bg-green-500'
        }`}></div>
        <span className="text-gray-700">
          {user.username}
        </span>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          user.role === 'admin' 
            ? 'bg-red-100 text-red-800' 
            : 'bg-green-100 text-green-800'
        }`}>
          {user.role}
        </span>
      </div>
      
      <button
        onClick={handleLogout}
        className="px-3 py-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
      >
        Logout
      </button>
    </div>
  )
}