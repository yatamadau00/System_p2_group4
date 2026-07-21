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
  beginEmailAccountLink,
  changeUserPassword,
  completeEmailAccountLink,
  completeGoogleAccountLink,
  getUserById,
  hashPassword,
  registerUser,
  resetLinkedUserPassword,
  syncGoogleUser,
} from '../services/authService'
import { isSupabaseConfigured, supabase } from '../services/supabaseClient'

interface AuthContextType {
  currentUser: User | null
  loading: boolean
  error: string | null
  passwordRecovery: boolean
  login: (username: string, password: string) => Promise<void>
  loginWithGoogle: () => Promise<void>
  linkGoogleAccount: () => Promise<void>
  unlinkGoogleAccount: () => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  registerRecoveryEmail: (email: string, currentPassword: string) => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  completePasswordRecovery: (newPassword: string) => Promise<void>
  dismissPasswordRecovery: () => void
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
const PENDING_GOOGLE_LINK_KEY = 'kotozute_pending_google_link_user_id'
const PENDING_EMAIL_LINK_TOKEN_KEY = 'kotozute_pending_email_link_token'

function createLinkToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [passwordRecovery, setPasswordRecovery] = useState(false)

  // 独自ログインとSupabase Authの両方から起動時のセッションを復元する
  useEffect(() => {
    let active = true

    async function restoreSession() {
      try {
        if (isSupabaseConfigured && supabase) {
          const { data, error: sessionError } = await supabase.auth.getSession()
          if (sessionError) throw sessionError
          if (data.session?.user) {
            const pendingUserId = localStorage.getItem(PENDING_GOOGLE_LINK_KEY)
            const pendingEmailToken = localStorage.getItem(PENDING_EMAIL_LINK_TOKEN_KEY)
            const isPasswordRecoveryRedirect =
              new URLSearchParams(window.location.search).get('password-recovery') === '1'
            if (data.session.user.is_anonymous) {
              const savedId = pendingUserId ?? localStorage.getItem(STORAGE_KEY)
              if (savedId) {
                const existingUser = await getUserById(savedId)
                if (existingUser && active) setCurrentUser(existingUser)
              }
              return
            }
            const user = pendingEmailToken
              ? await completeEmailAccountLink(
                  await hashPassword(pendingEmailToken),
                  data.session.user,
                )
              : pendingUserId
                ? await completeGoogleAccountLink(pendingUserId, data.session.user)
                : await syncGoogleUser(data.session.user)
            if (pendingEmailToken) localStorage.removeItem(PENDING_EMAIL_LINK_TOKEN_KEY)
            if (pendingUserId) localStorage.removeItem(PENDING_GOOGLE_LINK_KEY)
            if (isPasswordRecoveryRedirect && active) setPasswordRecovery(true)
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
      if ((event !== 'SIGNED_IN' && event !== 'PASSWORD_RECOVERY') || !session?.user) return
      if (session.user.is_anonymous) return
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
      const pendingUserId = localStorage.getItem(PENDING_GOOGLE_LINK_KEY)
      const pendingEmailToken = localStorage.getItem(PENDING_EMAIL_LINK_TOKEN_KEY)
      const userPromise = pendingEmailToken
        ? hashPassword(pendingEmailToken).then((tokenHash) =>
            completeEmailAccountLink(tokenHash, session.user),
          )
        : pendingUserId
          ? completeGoogleAccountLink(pendingUserId, session.user)
          : syncGoogleUser(session.user)
      void userPromise
        .then((user) => {
          if (!active) return
          setCurrentUser(user)
          localStorage.setItem(STORAGE_KEY, user.id)
          localStorage.removeItem(PENDING_GOOGLE_LINK_KEY)
          localStorage.removeItem(PENDING_EMAIL_LINK_TOKEN_KEY)
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

  const linkGoogleAccount = async () => {
    setError(null)
    if (!currentUser) throw new Error('先に既存アカウントへログインしてください')
    if (currentUser.authUserId) throw new Error('Googleアカウントはすでに連携済みです')
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Googleアカウント連携にはSupabaseの設定が必要です')
    }

    setLoading(true)
    localStorage.setItem(PENDING_GOOGLE_LINK_KEY, currentUser.id)
    try {
      const { error: anonymousError } = await supabase.auth.signInAnonymously()
      if (anonymousError) throw anonymousError
      const { error: linkError } = await supabase.auth.linkIdentity({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
      if (linkError) throw linkError
    } catch (err: unknown) {
      localStorage.removeItem(PENDING_GOOGLE_LINK_KEY)
      const message = err instanceof Error ? err.message : 'Googleアカウント連携に失敗しました'
      setError(message)
      setLoading(false)
      throw err
    }
  }

  const unlinkGoogleAccount = async () => {
    setError(null)
    if (!currentUser?.authUserId) {
      throw new Error('Googleアカウントは連携されていません')
    }
    if (!currentUser.hasPassword) {
      throw new Error('Googleで作成したアカウントは連携解除できません')
    }
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Googleアカウント連携にはSupabaseの設定が必要です')
    }

    setLoading(true)
    try {
      const { error: unlinkError } = await supabase.rpc('disconnect_google_account')
      if (unlinkError) throw unlinkError

      // DB関数でAuthユーザーを削除した後、ブラウザ内のセッションも破棄する。
      await supabase.auth.signOut({ scope: 'local' })
      setCurrentUser({
        ...currentUser,
        authUserId: null,
        email: undefined,
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Googleアカウント連携を解除できませんでした'
      setError(message)
      throw err
    } finally {
      setLoading(false)
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

  const changePassword = async (currentPassword: string, newPassword: string) => {
    setError(null)
    if (!currentUser?.hasPassword) {
      throw new Error('このアカウントには変更できるパスワードがありません')
    }

    setLoading(true)
    try {
      const [currentPasswordHash, newPasswordHash] = await Promise.all([
        hashPassword(currentPassword),
        hashPassword(newPassword),
      ])
      await changeUserPassword(currentUser.id, currentPasswordHash, newPasswordHash)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'パスワードを変更できませんでした'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const registerRecoveryEmail = async (email: string, currentPassword: string) => {
    setError(null)
    if (!currentUser?.hasPassword) {
      throw new Error('メールを登録できるパスワードアカウントではありません')
    }
    if (currentUser.authUserId) {
      throw new Error('このアカウントにはすでに認証情報が連携されています')
    }
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('メール登録にはSupabaseの設定が必要です')
    }

    setLoading(true)
    const token = createLinkToken()
    try {
      const [passwordHash, tokenHash] = await Promise.all([
        hashPassword(currentPassword),
        hashPassword(token),
      ])
      await beginEmailAccountLink(currentUser.id, passwordHash, tokenHash)
      localStorage.setItem(PENDING_EMAIL_LINK_TOKEN_KEY, token)

      const { error: anonymousError } = await supabase.auth.signInAnonymously()
      if (anonymousError) throw anonymousError
      const { error: emailError } = await supabase.auth.updateUser(
        { email },
        { emailRedirectTo: window.location.origin },
      )
      if (emailError) throw emailError
    } catch (err: unknown) {
      localStorage.removeItem(PENDING_EMAIL_LINK_TOKEN_KEY)
      await supabase.auth.signOut({ scope: 'local' })
      const message = err instanceof Error ? err.message : '確認メールを送信できませんでした'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const requestPasswordReset = async (email: string) => {
    setError(null)
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('パスワード再設定にはSupabaseの設定が必要です')
    }
    const redirectUrl = new URL(window.location.origin)
    redirectUrl.searchParams.set('password-recovery', '1')
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl.toString(),
    })
    if (resetError) {
      setError(resetError.message)
      throw resetError
    }
  }

  const completePasswordRecovery = async (newPassword: string) => {
    setError(null)
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('パスワード再設定にはSupabaseの設定が必要です')
    }
    try {
      const passwordHash = await hashPassword(newPassword)
      await resetLinkedUserPassword(passwordHash)
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) throw updateError
      setPasswordRecovery(false)
      window.history.replaceState({}, '', window.location.pathname)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'パスワードを再設定できませんでした'
      setError(message)
      throw err
    }
  }

  const dismissPasswordRecovery = () => {
    setPasswordRecovery(false)
    setError(null)
    window.history.replaceState({}, '', window.location.pathname)
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
        passwordRecovery,
        login,
        loginWithGoogle,
        linkGoogleAccount,
        unlinkGoogleAccount,
        changePassword,
        registerRecoveryEmail,
        requestPasswordReset,
        completePasswordRecovery,
        dismissPasswordRecovery,
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
