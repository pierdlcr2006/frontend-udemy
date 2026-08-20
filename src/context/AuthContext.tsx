/* eslint-disable react-refresh/only-export-components */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useState, type PropsWithChildren } from 'react'
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
  const [signedOut, setSignedOut] = useState(() => window.sessionStorage.getItem('aula:signed-out') === '1')
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
    setSignedOut(false)
    window.sessionStorage.removeItem('aula:signed-out')
    queryClient.setQueryData(['session'], result)
    return result.user
  }

  const logout = async () => {
    // Close the local session before waiting for the network.
    setSignedOut(true)
    window.sessionStorage.setItem('aula:signed-out', '1')
    await queryClient.cancelQueries({ queryKey: ['session'] })
    queryClient.removeQueries({ queryKey: ['session'], exact: true })
    try {
      await Promise.race([
        api('/auth/logout', { method: 'POST' }),
        new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('logout-timeout')), 5000)),
      ])
    } catch {
      // The local session is already closed even if the server is unavailable.
    } finally {
      queryClient.removeQueries({ queryKey: ['session'], exact: true })
    }
  }

  const unauthenticated = session.error instanceof ApiError && session.error.status === 401
  const currentUser = signedOut ? null : unauthenticated ? null : session.data?.user ?? null
  return (
    <AuthContext.Provider
      value={{ user: currentUser, loading: signedOut ? false : session.isLoading, login, logout }} 
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
