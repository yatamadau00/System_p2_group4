import { useEffect, useState } from 'react'
import type { Group, GroupMember } from '../types'
import { Sheet } from './Sheet'
import './ProfileSheet.css'

interface GroupSheetProps {
  group: Group
  getMembers: (id: string) => Promise<GroupMember[]>
  updateGroup: (
    id: string,
    updates: Partial<Pick<Group, 'name' | 'avatarEmoji' | 'avatarColor'>>,
  ) => Promise<void>
  onLeave: (id: string) => Promise<void>
  onClose: () => void
}

const GROUP_EMOJIS = ['👥', '🕊️', '🌸', '🌲', '🏫', '🎓', '🎏', '🦊', '⛺️', '🍀', '🌟', '🎒']
const GROUP_COLORS = ['#dceffd', '#e2ecc8', '#ffdce3', '#fceecb', '#ffd8b3', '#e8dffd', '#f1e8d6']

export function GroupSheet({
  group,
  getMembers,
  updateGroup,
  onLeave,
  onClose,
}: GroupSheetProps) {
  const [members, setMembers] = useState<GroupMember[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(group.name)
  const [editEmoji, setEditEmoji] = useState(group.avatarEmoji)
  const [editColor, setEditColor] = useState(group.avatarColor)
  const [saving, setSaving] = useState(false)

  // 表示用（保存すると即時反映したいのでローカルにも持つ）
  const [view, setView] = useState(group)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getMembers(group.id)
      .then((list) => {
        if (!cancelled) setMembers(list)
      })
      .catch((e) => console.error(e))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [group.id, getMembers])

  const copyCode = () => {
    navigator.clipboard?.writeText(view.id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSave = async () => {
    if (!editName.trim()) {
      alert('グループ名を入力してください')
      return
    }
    setSaving(true)
    try {
      await updateGroup(group.id, {
        name: editName.trim(),
        avatarEmoji: editEmoji,
        avatarColor: editColor,
      })
      setView((v) => ({
        ...v,
        name: editName.trim(),
        avatarEmoji: editEmoji,
        avatarColor: editColor,
      }))
      setEditing(false)
    } catch (err: any) {
      alert(err.message || 'グループの更新に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet title="グループ" onClose={onClose}>
      <div className="social-body">
        <div className="profile-card">
          {editing ? (
            <div className="profile-card__edit">
              <div className="avatar-edit-section">
                <div
                  className="profile-card__avatar"
                  style={{ backgroundColor: editColor }}
                >
                  {editEmoji}
                </div>
                <div className="avatar-pickers">
                  <div className="avatar-picker-group">
                    <label>アイコン</label>
                    <div className="picker-options">
                      {GROUP_EMOJIS.map((e) => (
                        <button
                          key={e}
                          type="button"
                          className={`picker-btn ${editEmoji === e ? 'selected' : ''}`}
                          onClick={() => setEditEmoji(e)}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="avatar-picker-group">
                    <label>背景色</label>
                    <div className="picker-options">
                      {GROUP_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          className={`picker-btn color-picker-btn ${editColor === c ? 'selected' : ''}`}
                          style={{ backgroundColor: c }}
                          onClick={() => setEditColor(c)}
                          aria-label={c}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="field">
                <label htmlFor="group-name" className="field__label">グループ名</label>
                <input
                  id="group-name"
                  type="text"
                  className="input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={30}
                />
              </div>

              <div className="profile-card__actions">
                <button
                  className="btn btn--soft"
                  onClick={() => {
                    setEditName(view.name)
                    setEditEmoji(view.avatarEmoji)
                    setEditColor(view.avatarColor)
                    setEditing(false)
                  }}
                  disabled={saving}
                >
                  キャンセル
                </button>
                <button className="btn btn--primary" onClick={handleSave} disabled={saving}>
                  {saving ? '保存中…' : '保存する'}
                </button>
              </div>
            </div>
          ) : (
            <div className="profile-card__view">
              <div className="profile-card__header">
                <div
                  className="profile-card__avatar"
                  style={{ backgroundColor: view.avatarColor }}
                >
                  {view.avatarEmoji}
                </div>
                <div className="profile-card__title">
                  <h3>{view.name}</h3>
                  <div
                    className="friend-code-badge"
                    onClick={copyCode}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') copyCode()
                    }}
                    aria-label="グループIDをコピー"
                  >
                    <code>{view.id}</code>
                    <span className="copy-hint">{copied ? 'コピー完了' : 'コピー'}</span>
                  </div>
                </div>
              </div>

              {view.owner && (
                <div className="profile-card__actions">
                  <button
                    className="btn btn--soft btn--block"
                    onClick={() => setEditing(true)}
                  >
                    グループを編集（名前・アイコン）
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* メンバー一覧 */}
        <div className="friends-list-section">
          <h4 className="section-title">メンバー ({members.length})</h4>
          {loading ? (
            <div className="empty-sub">
              <p>メンバーを読み込んでいます…</p>
            </div>
          ) : members.length === 0 ? (
            <div className="empty-sub">
              <p>メンバー情報を表示できません。（共有DBに接続している必要があります）</p>
            </div>
          ) : (
            <ul className="friend-cards">
              {members.map((m) => (
                <li key={m.id} className="friend-item-card">
                  <div className="friend-item-card__header">
                    <div
                      className="friend-item-card__avatar"
                      style={{ backgroundColor: m.avatarColor }}
                    >
                      {m.avatarEmoji}
                    </div>
                    <div className="friend-item-card__info">
                      <h5>
                        {m.name}
                        {m.owner && (
                          <span
                            style={{
                              marginLeft: 6,
                              fontSize: '0.7rem',
                              color: 'var(--c-amber-deep)',
                              fontWeight: 700,
                            }}
                          >
                            作成者
                          </span>
                        )}
                      </h5>
                      <span style={{ fontSize: '0.76rem', color: 'var(--c-ink-3)' }}>
                        {new Date(m.joinedAt).toLocaleDateString('ja-JP')} 参加
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="profile-card__actions" style={{ marginTop: 'var(--sp-2)' }}>
          <button
            className="btn btn--soft btn--block"
            style={{ color: 'var(--c-danger)' }}
            onClick={async () => {
              if (!confirm(`「${view.name}」から抜けますか？`)) return
              try {
                await onLeave(group.id)
                onClose()
              } catch (err: any) {
                alert(err.message || 'グループから抜けられませんでした')
              }
            }}
          >
            このグループから抜ける
          </button>
        </div>
      </div>
    </Sheet>
  )
}
