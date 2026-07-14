import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { User } from '../types'
import {
  authenticateUser,
  getUserById,
  hashPassword,
  registerUser,
  syncGoogleUser,
} from '../services/authService'
import { isSupabaseConfigured, supabase } from '../services/supabaseClient'

interface AuthContextType {
  currentUser: User | null
  loading: boolean
  error: string | null
  login: (username: string, password: string) => Promise<void>
  loginWithGoogle: () => Promise<void>
  signUp: (
    username: string,
    displayName: string,
    password: string,
  ) => Promise<void>
  logout: () => Promise<void>
  clearError: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const STORAGE_KEY = 'kotozute_user_id'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 独自ログインとSupabase Authの両方から起動時のセッションを復元する
  useEffect(() => {
    let active = true

    async function restoreSession() {
      try {
        if (isSupabaseConfigured && supabase) {
          const { data, error: sessionError } = await supabase.auth.getSession()
          if (sessionError) throw sessionError
          if (data.session?.user) {
            const user = await syncGoogleUser(data.session.user)
            if (active) setCurrentUser(user)
            localStorage.setItem(STORAGE_KEY, user.id)
            return
          }
        }

        const savedId = localStorage.getItem(STORAGE_KEY)
        if (savedId) {
          const user = await getUserById(savedId)
          if (user) {
            setCurrentUser(user)
          } else {
            // 保存されていたIDが無効な場合
            localStorage.removeItem(STORAGE_KEY)
          }
        }
      } catch (err) {
        console.error('Session restoration failed:', err)
      } finally {
        setLoading(false)
      }
    }
    restoreSession()

    const authSubscription = supabase?.auth.onAuthStateChange((event, session) => {
      if (event !== 'SIGNED_IN' || !session?.user) return
      void syncGoogleUser(session.user)
        .then((user) => {
          if (!active) return
          setCurrentUser(user)
          localStorage.setItem(STORAGE_KEY, user.id)
          setError(null)
        })
        .catch((err: unknown) => {
          console.error('Google profile sync failed:', err)
          if (active) {
            setError(err instanceof Error ? err.message : 'Googleログインに失敗しました')
          }
        })
        .finally(() => {
          if (active) setLoading(false)
        })
    })

    return () => {
      active = false
      authSubscription?.data.subscription.unsubscribe()
    }
  }, [])

  const loginWithGoogle = async () => {
    setError(null)
    if (!isSupabaseConfigured || !supabase) {
      const configurationError = new Error('GoogleログインにはSupabaseの設定が必要です')
      setError(configurationError.message)
      throw configurationError
    }

    setLoading(true)
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
      if (oauthError) throw oauthError
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Googleログインに失敗しました'
      setError(message)
      setLoading(false)
      throw err
    }
  }

  const login = async (username: string, password: string) => {
    setError(null)
    setLoading(true)
    try {
      const hashed = await hashPassword(password)
      const user = await authenticateUser(username, hashed)
      setCurrentUser(user)
      localStorage.setItem(STORAGE_KEY, user.id)
    } catch (err: any) {
      setError(err.message || 'ログインに失敗しました')
      throw err
    } finally {
      setLoading(false)
    }
  }

  const signUp = async (
    username: string,
    displayName: string,
    password: string,
  ) => {
    setError(null)
    setLoading(true)
    try {
      const hashed = await hashPassword(password)
      const user = await registerUser(username, displayName, hashed)
      setCurrentUser(user)
      localStorage.setItem(STORAGE_KEY, user.id)
    } catch (err: any) {
      setError(err.message || '登録に失敗しました')
      throw err
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    if (supabase) {
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) console.error('Supabase sign out failed:', signOutError)
    }
    setCurrentUser(null)
    localStorage.removeItem(STORAGE_KEY)
  }

  const clearError = () => {
    setError(null)
  }

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        loading,
        error,
        login,
        loginWithGoogle,
        signUp,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider')
  }
  return context
}
