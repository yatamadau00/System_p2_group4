import { useState } from 'react'
import type { EmailOtpType } from '@supabase/supabase-js'
import { useAuth } from '../hooks/useAuth'
import { isSupabaseConfigured, supabase } from '../services/supabaseClient'
import { EyeIcon, EyeOffIcon, PigeonIcon } from './icons'
import './AuthSheet.css'
import './AuthGate.css'

type AuthMode = 'login' | 'signup' | 'recovery'

/**
 * 全画面のログイン/新規登録ゲート。
 * ログインしていない間はアプリ本体を表示せず、この画面だけを出す（閉じられない）。
 */
export function AuthGate() {
  const { login, loginWithGoogle, signUp, requestPasswordReset, error, clearError } = useAuth()
  const [mode, setMode] = useState<AuthMode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [recoverySent, setRecoverySent] = useState(false)
  const [verifyingEmail, setVerifyingEmail] = useState(false)
  const [emailVerified, setEmailVerified] = useState(false)
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
  const urlParams = new URLSearchParams(window.location.search)
  const emailTokenHash = urlParams.get('token_hash')
  const emailTokenType = urlParams.get('type')
  const supportedEmailTokenTypes = new Set<EmailOtpType>(['email', 'email_change', 'recovery'])

  const handleVerifyEmailToken = async () => {
    if (
      !emailTokenHash ||
      !emailTokenType ||
      !supportedEmailTokenTypes.has(emailTokenType as EmailOtpType) ||
      !isSupabaseConfigured ||
      !supabase
    ) {
      setLocalError('確認リンクが正しくありません')
      return
    }

    setVerifyingEmail(true)
    setLocalError(null)
    clearError()
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: emailTokenHash,
        type: emailTokenType as EmailOtpType,
      })
      if (verifyError) throw verifyError
      setEmailVerified(true)
      window.history.replaceState({}, '', window.location.pathname)
    } catch (err: unknown) {
      setLocalError(
        err instanceof Error ? err.message : 'メールアドレスを確認できませんでした',
      )
    } finally {
      setVerifyingEmail(false)
    }
  }

  if (emailTokenHash && emailTokenType) {
    const isRecovery = emailTokenType === 'recovery'
    return (
      <div className="auth-gate">
        <div className="auth-gate__card">
          <div className="auth-gate__brand">
            <span className="auth-gate__mark">
              <PigeonIcon width={34} height={34} />
            </span>
            <h1 className="auth-gate__title">
              {isRecovery ? 'パスワード再設定' : 'メールアドレス確認'}
            </h1>
            <p className="auth-gate__lead">
              {isRecovery
                ? '確認後、新しいパスワードを設定します。'
                : 'ボタンを押すとメールアドレスの登録が完了します。'}
            </p>
          </div>

          <div className="auth-form">
            {(localError || error) && (
              <div className="auth-form__error">{localError || error}</div>
            )}
            {emailVerified ? (
              <div className="auth-form__success" role="status">
                確認が完了しました。画面が切り替わるまでお待ちください。
              </div>
            ) : (
              <button
                className="btn btn--primary btn--block"
                type="button"
                onClick={() => void handleVerifyEmailToken()}
                disabled={verifyingEmail}
              >
                {verifyingEmail
                  ? '確認中…'
                  : isRecovery
                    ? '本人確認して再設定へ進む'
                    : 'メールアドレスを確認する'}
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (mode === 'recovery') {
    return (
      <div className="auth-gate">
        <div className="auth-gate__card">
          <div className="auth-gate__brand">
            <span className="auth-gate__mark">
              <PigeonIcon width={34} height={34} />
            </span>
            <h1 className="auth-gate__title">パスワード再設定</h1>
            <p className="auth-gate__lead">
              登録済みのメールアドレスへ再設定用のリンクを送信します。
            </p>
          </div>

          <form className="auth-form" onSubmit={handleRecoverySubmit}>
            {displayError && <div className="auth-form__error">{displayError}</div>}
            {recoverySent ? (
              <div className="auth-form__success" role="status">
                登録済みのアドレスであれば、再設定メールが届きます。メール内のリンクを開いてください。
              </div>
            ) : (
              <>
                <div className="auth-form__group">
                  <label className="auth-form__label" htmlFor="gate-recovery-email">
                    メールアドレス
                  </label>
                  <input
                    className="auth-form__input"
                    id="gate-recovery-email"
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
        </div>
      </div>
    )
  }

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
      </div>
    </div>
  )
}
