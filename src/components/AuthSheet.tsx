import { useState } from 'react'
import { Sheet } from './Sheet'
import { useAuth } from '../hooks/useAuth'
import { EyeIcon, EyeOffIcon } from './icons'
import './AuthSheet.css'

interface AuthSheetProps {
  onClose: () => void
}

type AuthMode = 'login' | 'signup' | 'recovery'

export function AuthSheet({ onClose }: AuthSheetProps) {
  const { login, loginWithGoogle, signUp, requestPasswordReset, error, clearError } = useAuth()
  const [mode, setMode] = useState<AuthMode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [recoverySent, setRecoverySent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const handleSwitchMode = () => {
    setMode((prev) => (prev === 'login' ? 'signup' : 'login'))
    setUsername('')
    setPassword('')
    setShowPassword(false)
    setDisplayName('')
    setLocalError(null)
    clearError()
  }

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)
    clearError()
    const email = recoveryEmail.trim().toLowerCase()
    if (!email) {
      setLocalError('メールアドレスを入力してください')
      return
    }
    setSubmitting(true)
    try {
      await requestPasswordReset(email)
      setRecoverySent(true)
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)
    clearError()

    const cleanUsername = username.trim()
    const cleanPassword = password.trim()
    const cleanDisplayName = displayName.trim()

    if (!cleanUsername) {
      setLocalError('ユーザー名を入力してください')
      return
    }
    if (!cleanPassword) {
      setLocalError('パスワードを入力してください')
      return
    }
    if (cleanPassword.length < 4) {
      setLocalError('パスワードは4文字以上で入力してください')
      return
    }
    if (mode === 'signup' && !cleanDisplayName) {
      setLocalError('表示名を入力してください')
      return
    }

    setSubmitting(true)
    try {
      if (mode === 'login') {
        await login(cleanUsername, cleanPassword)
      } else {
        await signUp(cleanUsername, cleanDisplayName, cleanPassword)
      }
      onClose()
    } catch (err) {
      // エラーは Context の `error` または throw されたエラーから取得
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoogleLogin = async () => {
    setLocalError(null)
    clearError()
    setSubmitting(true)
    try {
      await loginWithGoogle()
    } catch (err) {
      console.error(err)
      setSubmitting(false)
    }
  }

  const title = mode === 'login' ? 'ログイン' : mode === 'signup' ? 'アカウント作成' : 'パスワード再設定'
  const displayError = localError || error

  if (mode === 'recovery') {
    return (
      <Sheet title={title} onClose={onClose}>
        <form className="auth-form" onSubmit={handleRecoverySubmit}>
          <p className="auth-form__intro">
            登録済みのメールアドレスへ、パスワード再設定用のリンクを送信します。
          </p>
          {displayError && <div className="auth-form__error">{displayError}</div>}
          {recoverySent ? (
            <div className="auth-form__success" role="status">
              登録済みのアドレスであれば、再設定メールが届きます。メール内のリンクを開いてください。
            </div>
          ) : (
            <>
              <div className="auth-form__group">
                <label className="auth-form__label" htmlFor="recovery-email-request">
                  メールアドレス
                </label>
                <input
                  className="auth-form__input"
                  id="recovery-email-request"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                  disabled={submitting}
                  required
                  autoFocus
                />
              </div>
              <button className="btn btn--primary btn--block" type="submit" disabled={submitting}>
                {submitting ? '送信中…' : '再設定メールを送信'}
              </button>
            </>
          )}
          <button
            className="auth-form__switch-btn"
            type="button"
            onClick={() => {
              setMode('login')
              setRecoverySent(false)
              setLocalError(null)
              clearError()
            }}
            disabled={submitting}
          >
            ログインに戻る
          </button>
        </form>
      </Sheet>
    )
  }

  return (
    <Sheet title={title} onClose={onClose}>
      <form className="auth-form" onSubmit={handleSubmit}>
        {displayError && <div className="auth-form__error">{displayError}</div>}

        <button
          className="auth-form__google-btn"
          type="button"
          onClick={handleGoogleLogin}
          disabled={submitting}
        >
          <span className="auth-form__google-mark" aria-hidden="true">G</span>
          Googleでログイン
        </button>

        <div className="auth-form__divider"><span>または</span></div>

        <div className="auth-form__group">
          <label className="auth-form__label" htmlFor="username">
            ユーザー名（英数字のみ）
          </label>
          <input
            className="auth-form__input"
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
            placeholder="例: kotozute_user"
            disabled={submitting}
            required
            autoFocus
          />
        </div>

        {mode === 'signup' && (
          <div className="auth-form__group">
            <label className="auth-form__label" htmlFor="displayName">
              表示名（日本語可）
            </label>
            <input
              className="auth-form__input"
              id="displayName"
              name="name"
              type="text"
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="例: コトズテ太郎"
              disabled={submitting}
              required
            />
          </div>
        )}

        <div className="auth-form__group">
          <label className="auth-form__label" htmlFor="password">
            パスワード
          </label>
          <div className="auth-form__password-field">
            <input
              className="auth-form__input auth-form__password-input"
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="4文字以上"
              disabled={submitting}
              required
            />
            <button
              className="auth-form__password-toggle"
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              disabled={submitting}
              aria-label={showPassword ? 'パスワードを非表示にする' : 'パスワードを表示する'}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </div>

        {mode === 'login' && (
          <button
            className="auth-form__forgot-btn"
            type="button"
            onClick={() => {
              setMode('recovery')
              setLocalError(null)
              clearError()
            }}
            disabled={submitting}
          >
            パスワードを忘れた方
          </button>
        )}

        <button
          className="btn btn--primary btn--block"
          type="submit"
          disabled={submitting}
        >
          {submitting ? (
            <div className="spinner spinner--ink" style={{ width: 20, height: 20, margin: '0 auto' }} />
          ) : mode === 'login' ? (
            'ログインする'
          ) : (
            '登録して始める'
          )}
        </button>

        <div className="auth-form__footer">
          {mode === 'login' ? (
            <>
              アカウントをお持ちでないですか？
              <button
                className="auth-form__switch-btn"
                type="button"
                onClick={handleSwitchMode}
                disabled={submitting}
              >
                新規登録
              </button>
            </>
          ) : (
            <>
              すでにアカウントをお持ちですか？
              <button
                className="auth-form__switch-btn"
                type="button"
                onClick={handleSwitchMode}
                disabled={submitting}
              >
                ログイン
              </button>
            </>
          )}
        </div>
      </form>
    </Sheet>
  )
}
