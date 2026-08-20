/* eslint-disable react-refresh/only-export-components */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, type PropsWithChildren } from 'react'
import { api, ApiError } from '../api/client'
import type { User } from '../types'

interface AuthValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<User>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient()
  const session = useQuery({
    queryKey: ['session'],
    queryFn: () => api<{ user: User }>('/auth/me'),
    retry: false,
    staleTime: 60_000,
  })

  const login = async (email: string, password: string) => {
    const result = await api<{ user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    queryClient.setQueryData(['session'], result)
    return result.user
  }

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' })
    queryClient.clear()
  }

  const unauthenticated = session.error instanceof ApiError && session.error.status === 401
  return (
    <AuthContext.Provider
      value={{ user: unauthenticated ? null : session.data?.user ?? null, loading: session.isLoading, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return value
}
