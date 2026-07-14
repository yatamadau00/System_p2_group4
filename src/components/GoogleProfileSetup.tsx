import { useState } from 'react'
import type { UserProfile } from '../types'
import { Sheet } from './Sheet'
import './AuthSheet.css'

interface GoogleProfileSetupProps {
  updateProfile: (
    updates: Partial<Omit<UserProfile, 'id' | 'friendCode'>>,
  ) => Promise<void>
}

/** Googleで初めて登録したユーザーに、アプリ内の表示名を決めてもらう。 */
export function GoogleProfileSetup({ updateProfile }: GoogleProfileSetupProps) {
  const [displayName, setDisplayName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const cleanName = displayName.trim()
    if (!cleanName) {
      setError('表示名を入力してください')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await updateProfile({ name: cleanName })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'プロフィールを保存できませんでした')
      setSubmitting(false)
    }
  }

  return (
    <Sheet
      title="プロフィールを作成"
      onClose={() => undefined}
      dismissOnScrim={false}
      headerRight={<span style={{ width: 40, flex: 'none' }} />}
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <p className="auth-form__intro">
          ことづての中で使う名前を決めてください。Googleのプロフィール情報は使用しません。
        </p>

        {error && <div className="auth-form__error">{error}</div>}

        <div className="auth-form__group">
          <label className="auth-form__label" htmlFor="google-display-name">
            表示名
          </label>
          <input
            className="auth-form__input"
            id="google-display-name"
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="例: コトズテ太郎"
            maxLength={20}
            disabled={submitting}
            autoFocus
            required
          />
        </div>

        <button
          className="btn btn--primary btn--block"
          type="submit"
          disabled={submitting}
        >
          {submitting ? '保存中…' : 'この名前で始める'}
        </button>
      </form>
    </Sheet>
  )
}
