import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { EyeIcon, EyeOffIcon, PigeonIcon } from './icons'
import './AuthSheet.css'
import './AuthGate.css'

type AuthMode = 'login' | 'signup'

/**
 * 全画面のログイン/新規登録ゲート。
 * ログインしていない間はアプリ本体を表示せず、この画面だけを出す（閉じられない）。
 */
export function AuthGate() {
  const { login, loginWithGoogle, signUp, error, clearError } = useAuth()
  const [mode, setMode] = useState<AuthMode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [displayName, setDisplayName] = useState('')
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
      // 成功すると currentUser が入り、App 側でゲートが外れる
    } catch (err) {
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

  const displayError = localError || error

  return (
    <div className="auth-gate">
      <div className="auth-gate__card">
        <div className="auth-gate__brand">
          <span className="auth-gate__mark">
            <PigeonIcon width={34} height={34} />
          </span>
          <h1 className="auth-gate__title">ことづて</h1>
          <p className="auth-gate__lead">
            {mode === 'login'
              ? 'ログインして、この場所の想いを受け取りましょう。'
              : 'アカウントを作って、ことづてを始めましょう。'}
          </p>
        </div>

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
            <label className="auth-form__label" htmlFor="gate-username">
              ユーザー名（英数字のみ）
            </label>
            <input
              className="auth-form__input"
              id="gate-username"
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
              <label className="auth-form__label" htmlFor="gate-displayName">
                表示名（日本語可）
              </label>
              <input
                className="auth-form__input"
                id="gate-displayName"
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
            <label className="auth-form__label" htmlFor="gate-password">
              パスワード
            </label>
            <div className="auth-form__password-field">
              <input
                className="auth-form__input auth-form__password-input"
                id="gate-password"
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
      </div>
    </div>
  )
}
