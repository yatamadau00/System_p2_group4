import { useState, type FormEvent } from 'react'
import { EyeIcon, EyeOffIcon } from './icons'
import './RecoveryEmailForm.css'

interface RecoveryEmailFormProps {
  registerRecoveryEmail: (email: string, currentPassword: string) => Promise<void>
  currentEmail?: string
}

export function RecoveryEmailForm({ registerRecoveryEmail, currentEmail }: RecoveryEmailFormProps) {
  const [expanded, setExpanded] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setMessage(null)
    const cleanEmail = email.trim().toLowerCase()
    const cleanPassword = password.trim()
    if (!cleanEmail || !cleanPassword) {
      setMessage({ type: 'error', text: 'メールアドレスと現在のパスワードを入力してください' })
      return
    }
    if (currentEmail && cleanEmail === currentEmail.toLowerCase()) {
      setMessage({ type: 'error', text: '現在とは異なるメールアドレスを入力してください' })
      return
    }

    setSubmitting(true)
    try {
      await registerRecoveryEmail(cleanEmail, cleanPassword)
      setPassword('')
      setShowPassword(false)
      setMessage({
        type: 'success',
        text: `確認メールを送信しました。メール内のリンクを開いて${currentEmail ? '変更' : '登録'}を完了してください。`,
      })
    } catch (error: unknown) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : '確認メールを送信できませんでした',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="recovery-email">
      <div className="recovery-email__heading">
        <div>
          <strong>メールアドレス</strong>
          <p>本人確認とパスワード再設定に使用します</p>
        </div>
        <button
          type="button"
          className="btn btn--soft"
          onClick={() => {
            setExpanded((current) => !current)
            setMessage(null)
          }}
          aria-expanded={expanded}
        >
          {expanded ? '閉じる' : currentEmail ? '変更' : '登録する'}
        </button>
      </div>

      {expanded && (
        <form className="recovery-email__form" onSubmit={handleSubmit}>
          <div className="recovery-email__field">
            <label htmlFor="recovery-email">
              {currentEmail ? '新しいメールアドレス' : 'メールアドレス'}
            </label>
            <input
              id="recovery-email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={submitting}
              required
            />
          </div>
          <div className="recovery-email__field">
            <label htmlFor="recovery-email-password">現在のパスワード</label>
            <div className="recovery-email__password-wrap">
              <input
                id="recovery-email-password"
                name="current-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={submitting}
                required
              />
              <button
                type="button"
                className="recovery-email__toggle"
                onClick={() => setShowPassword((current) => !current)}
                disabled={submitting}
                aria-label={showPassword ? 'パスワードを非表示にする' : 'パスワードを表示する'}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>
          {message && (
            <p className={`recovery-email__message recovery-email__message--${message.type}`} role="status">
              {message.text}
            </p>
          )}
          <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
            {submitting ? '送信中…' : '確認メールを送信'}
          </button>
        </form>
      )}
    </section>
  )
}
