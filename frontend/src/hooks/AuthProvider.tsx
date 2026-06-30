import { useCallback, useMemo, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { authApi } from '../api/resources'
import { ApiError } from '../api/client'
import type { User } from '../api/types'
import { AuthContext, type AuthContextValue } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  // Bootstrap the session from the httpOnly cookie. A 401 simply means "not
  // logged in" — surface it as a null user rather than an error screen.
  const { data, isLoading } = useQuery<User | null>({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return await authApi.me()
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          return null
        }
        throw err
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  })

  const login = useCallback(
    async (email: string, password: string) => {
      const { user } = await authApi.login(email, password)
      queryClient.setQueryData(['me'], user)
    },
    [queryClient],
  )

  const logout = useCallback(async () => {
    await authApi.logout()
    queryClient.setQueryData(['me'], null)
    // Drop cached domain data so the next user starts clean.
    queryClient.clear()
  }, [queryClient])

  const value = useMemo<AuthContextValue>(
    () => ({ user: data ?? null, isLoading, login, logout }),
    [data, isLoading, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
