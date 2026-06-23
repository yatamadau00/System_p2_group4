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
} from '../services/authService'

interface AuthContextType {
  currentUser: User | null
  loading: boolean
  error: string | null
  login: (username: string, password: string) => Promise<void>
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

  // 起動時の自動ログイン処理
  useEffect(() => {
    async function restoreSession() {
      try {
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
  }, [])

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
