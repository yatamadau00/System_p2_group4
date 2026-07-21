import { useState, type FormEvent } from 'react'
import { useAuth } from '../hooks/useAuth'
import { EyeIcon, EyeOffIcon } from './icons'
import { Sheet } from './Sheet'
import './AuthSheet.css'

export function PasswordRecoverySheet() {
  const { completePasswordRecovery, dismissPasswordRecovery, error, clearError } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setLocalError(null)
    clearError()
    const nextPassword = password.trim()
    if (nextPassword.length < 4) {
      setLocalError('パスワードは4文字以上で入力してください')
      return
    }
    if (nextPassword !== confirmation.trim()) {
      setLocalError('新しいパスワードが一致しません')
      return
    }

    setSubmitting(true)
    try {
      await completePasswordRecovery(nextPassword)
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet title="新しいパスワードを設定" onClose={dismissPasswordRecovery}>
      <form className="auth-form" onSubmit={handleSubmit}>
        <p className="auth-form__intro">本人確認が完了しました。新しいパスワードを入力してください。</p>
        {(localError || error) && <div className="auth-form__error">{localError || error}</div>}
        <div className="auth-form__group">
          <label className="auth-form__label" htmlFor="recovery-new-password">新しいパスワード</label>
          <div className="auth-form__password-field">
            <input
              className="auth-form__input auth-form__password-input"
              id="recovery-new-password"
              name="new-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={submitting}
              required
              autoFocus
            />
            <button
              className="auth-form__password-toggle"
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              disabled={submitting}
              aria-label={showPassword ? 'パスワードを非表示にする' : 'パスワードを表示する'}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </div>
        <div className="auth-form__group">
          <label className="auth-form__label" htmlFor="recovery-password-confirmation">新しいパスワード（確認）</label>
          <input
            className="auth-form__input"
            id="recovery-password-confirmation"
            name="new-password-confirmation"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            disabled={submitting}
            required
          />
        </div>
        <button className="btn btn--primary btn--block" type="submit" disabled={submitting}>
          {submitting ? '設定中…' : '新しいパスワードを設定'}
        </button>
      </form>
    </Sheet>
  )
}
