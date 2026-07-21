import { useState, type FormEvent } from 'react'
import { EyeIcon, EyeOffIcon } from './icons'
import './ChangePasswordForm.css'

interface ChangePasswordFormProps {
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
}

export function ChangePasswordForm({ changePassword }: ChangePasswordFormProps) {
  const [expanded, setExpanded] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [visible, setVisible] = useState<Record<string, boolean>>({})
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

  const resetForm = () => {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setVisible({})
    setMessage(null)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setMessage(null)

    const current = currentPassword.trim()
    const next = newPassword.trim()
    const confirmation = confirmPassword.trim()
    if (!current || !next || !confirmation) {
      setMessage({ type: 'error', text: 'すべての項目を入力してください' })
      return
    }
    if (next.length < 4) {
      setMessage({ type: 'error', text: '新しいパスワードは4文字以上で入力してください' })
      return
    }
    if (next !== confirmation) {
      setMessage({ type: 'error', text: '新しいパスワードが一致しません' })
      return
    }
    if (current === next) {
      setMessage({ type: 'error', text: '現在とは異なるパスワードを入力してください' })
      return
    }

    setSubmitting(true)
    try {
      await changePassword(current, next)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setVisible({})
      setMessage({ type: 'success', text: 'パスワードを変更しました' })
    } catch (error: unknown) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'パスワードを変更できませんでした',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const passwordField = (
    id: string,
    label: string,
    value: string,
    onChange: (value: string) => void,
    autoComplete: 'current-password' | 'new-password',
  ) => {
    const isVisible = !!visible[id]
    return (
      <div className="change-password__field">
        <label htmlFor={id}>{label}</label>
        <div className="change-password__input-wrap">
          <input
            id={id}
            name={id}
            type={isVisible ? 'text' : 'password'}
            autoComplete={autoComplete}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            disabled={submitting}
            required
          />
          <button
            type="button"
            className="change-password__toggle"
            onClick={() => setVisible((current) => ({ ...current, [id]: !isVisible }))}
            disabled={submitting}
            aria-label={isVisible ? `${label}を非表示にする` : `${label}を表示する`}
            aria-pressed={isVisible}
          >
            {isVisible ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
      </div>
    )
  }

  return (
    <section className="change-password">
      <div className="change-password__heading">
        <div>
          <strong>パスワード</strong>
          <p>現在のパスワードを確認して変更します</p>
        </div>
        <button
          type="button"
          className="btn btn--soft"
          onClick={() => {
            if (expanded) resetForm()
            setExpanded((current) => !current)
          }}
          aria-expanded={expanded}
        >
          {expanded ? '閉じる' : '変更する'}
        </button>
      </div>

      {expanded && (
        <form className="change-password__form" onSubmit={handleSubmit}>
          {passwordField(
            'current-password',
            '現在のパスワード',
            currentPassword,
            setCurrentPassword,
            'current-password',
          )}
          {passwordField(
            'new-password',
            '新しいパスワード',
            newPassword,
            setNewPassword,
            'new-password',
          )}
          {passwordField(
            'confirm-password',
            '新しいパスワード（確認）',
            confirmPassword,
            setConfirmPassword,
            'new-password',
          )}
          {message && (
            <p className={`change-password__message change-password__message--${message.type}`} role="status">
              {message.text}
            </p>
          )}
          <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
            {submitting ? '変更中…' : 'パスワードを変更'}
          </button>
        </form>
      )}
    </section>
  )
}
