import { useMemo, useState } from 'react'
import type { UserProfile, Group, Kotozute } from '../types'
import { Sheet } from './Sheet'
import { TrashIcon, PigeonIcon, LockIcon } from './icons'
import './ProfileSheet.css'

interface ProfileSheetProps {
  items: Kotozute[]
  profile: UserProfile
  updateProfile: (
    updates: Partial<Omit<UserProfile, 'id' | 'friendCode'>>,
  ) => Promise<void>
  groups: Group[]
  createGroup: (name: string) => Group
  joinGroup: (code: string) => Group
  leaveGroup: (id: string) => void
  onSelectKotozute: (id: string) => void
  onDeleteKotozute: (id: string) => void
  onClose: () => void
}

// 選択可能なアバター絵文字
const AVATAR_EMOJIS = ['🦉', '🕊️', '🌸', '🌲', 'そ', 'み', 'は', '🦊', '🐱', '🍀', '🌟', '🎏']
// 選択可能なアバター背景色
const AVATAR_COLORS = ['#f1e8d6', '#e2ecc8', '#ffdce3', '#dceffd', '#fceecb', '#ffd8b3', '#e8dffd']

export function ProfileSheet({
  items,
  profile,
  updateProfile,
  groups,
  createGroup,
  joinGroup,
  leaveGroup,
  onSelectKotozute,
  onDeleteKotozute,
  onClose,
}: ProfileSheetProps) {
  const [tab, setTab] = useState<'profile' | 'groups'>('profile')
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(profile.name)
  const [editBio, setEditBio] = useState(profile.bio)
  const [editEmoji, setEditEmoji] = useState(profile.avatarEmoji)
  const [editColor, setEditColor] = useState(profile.avatarColor)
  const [savingProfile, setSavingProfile] = useState(false)

  // グループ関連
  const [newGroupName, setNewGroupName] = useState('')
  const [createdCode, setCreatedCode] = useState<string | null>(null)
  const [joinInput, setJoinInput] = useState('')
  const [groupError, setGroupError] = useState<string | null>(null)
  const [groupSuccess, setGroupSuccess] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // 自分のことづて一覧
  const myItems = useMemo(() => items.filter((item) => item.mine), [items])

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      alert('名前を入力してください')
      return
    }
    setSavingProfile(true)
    try {
      await updateProfile({
        name: editName.trim(),
        bio: editBio.trim(),
        avatarEmoji: editEmoji,
        avatarColor: editColor,
      })
      setIsEditing(false)
    } catch (err: any) {
      alert(err.message || 'プロフィールの保存に失敗しました')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleCancelEdit = () => {
    setEditName(profile.name)
    setEditBio(profile.bio)
    setEditEmoji(profile.avatarEmoji)
    setEditColor(profile.avatarColor)
    setIsEditing(false)
  }

  const copyCode = (code: string) => {
    navigator.clipboard?.writeText(code)
    setCopiedId(code)
    setTimeout(() => setCopiedId((c) => (c === code ? null : c)), 2000)
  }

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault()
    setGroupError(null)
    setGroupSuccess(null)
    const g = createGroup(newGroupName)
    setCreatedCode(g.id)
    setNewGroupName('')
  }

  const handleJoinGroup = (e: React.FormEvent) => {
    e.preventDefault()
    setGroupError(null)
    setGroupSuccess(null)
    if (!joinInput.trim()) return
    try {
      const g = joinGroup(joinInput)
      setGroupSuccess(`「${g.name}」に参加しました！`)
      setJoinInput('')
    } catch (err: any) {
      setGroupError(err.message || 'グループに参加できませんでした。')
    }
  }

  const CodeBadge = ({ code }: { code: string }) => (
    <div
      className="friend-code-badge"
      onClick={() => copyCode(code)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') copyCode(code)
      }}
      aria-label="グループIDをコピー"
    >
      <code>{code}</code>
      <span className="copy-hint">{copiedId === code ? 'コピー完了' : 'コピー'}</span>
    </div>
  )

  return (
    <Sheet title="プロフィール & グループ" onClose={onClose}>
      <div className="segmented" role="tablist">
        <button
          role="tab"
          aria-pressed={tab === 'profile'}
          onClick={() => setTab('profile')}
        >
          プロフィール
        </button>
        <button
          role="tab"
          aria-pressed={tab === 'groups'}
          onClick={() => setTab('groups')}
        >
          グループ ({groups.length})
        </button>
      </div>

      <div className="social-body">
        {tab === 'profile' ? (
          <div className="profile-tab">
            {/* プロフィールカード */}
            <div className="profile-card">
              {isEditing ? (
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
                        <label>絵文字</label>
                        <div className="picker-options">
                          {AVATAR_EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              className={`picker-btn ${editEmoji === emoji ? 'selected' : ''}`}
                              onClick={() => setEditEmoji(emoji)}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="avatar-picker-group">
                        <label>背景色</label>
                        <div className="picker-options">
                          {AVATAR_COLORS.map((color) => (
                            <button
                              key={color}
                              type="button"
                              className={`picker-btn color-picker-btn ${editColor === color ? 'selected' : ''}`}
                              style={{ backgroundColor: color }}
                              onClick={() => setEditColor(color)}
                              aria-label={color}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="field">
                    <label htmlFor="edit-name" className="field__label">名前</label>
                    <input
                      id="edit-name"
                      type="text"
                      className="input"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      maxLength={20}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="edit-bio" className="field__label">自己紹介</label>
                    <textarea
                      id="edit-bio"
                      className="textarea"
                      value={editBio}
                      onChange={(e) => setEditBio(e.target.value)}
                      maxLength={100}
                    />
                  </div>

                  <div className="profile-card__actions">
                    <button className="btn btn--soft" onClick={handleCancelEdit} disabled={savingProfile}>
                      キャンセル
                    </button>
                    <button className="btn btn--primary" onClick={handleSaveProfile} disabled={savingProfile}>
                      {savingProfile ? '保存中…' : '保存する'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="profile-card__view">
                  <div className="profile-card__header">
                    <div
                      className="profile-card__avatar"
                      style={{ backgroundColor: profile.avatarColor }}
                    >
                      {profile.avatarEmoji}
                    </div>
                    <div className="profile-card__title">
                      <h3>{profile.name}</h3>
                    </div>
                  </div>

                  {profile.bio && <p className="profile-card__bio">{profile.bio}</p>}

                  <div className="profile-card__actions">
                    <button
                      className="btn btn--soft btn--block"
                      onClick={() => setIsEditing(true)}
                    >
                      プロフィールを編集
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 自分のことづて一覧 */}
            <div className="my-kotozutes-section">
              <h4 className="section-title">あなたのことづて ({myItems.length})</h4>
              {myItems.length === 0 ? (
                <div className="empty-sub">
                  <p>まだことづてを残していません。思い出の場所に結んでみましょう。</p>
                </div>
              ) : (
                <ul className="cz-list">
                  {myItems.map((k) => (
                    <li key={k.id}>
                      <button className="cz-row" onClick={() => onSelectKotozute(k.id)}>
                        <span className="cz-row__badge cz-row__badge--unlockable">
                          <PigeonIcon />
                        </span>
                        <span className="cz-row__main">
                          <span className="cz-row__place">
                            {k.placeLabel ?? 'この場所のことづて'}
                          </span>
                          <span className="cz-row__sub">
                            {new Date(k.createdAt).toLocaleDateString('ja-JP')}
                            {k.visibility === 'group' && (
                              <span className="friend-only-badge">
                                <LockIcon width={10} height={10} style={{ marginRight: 2, display: 'inline-block', verticalAlign: 'middle' }} />
                                グループ限定
                              </span>
                            )}
                          </span>
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          className="cz-row__delete"
                          aria-label="このことづてを削除"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (confirm('このことづてを取り消しますか？')) onDeleteKotozute(k.id)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.stopPropagation()
                              if (confirm('このことづてを取り消しますか？')) onDeleteKotozute(k.id)
                            }
                          }}
                        >
                          <TrashIcon width={18} height={18} />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <div className="friends-tab">
            {/* グループを作成 */}
            <div className="friend-add-box">
              <h4 className="section-title">グループを作成</h4>
              <form onSubmit={handleCreateGroup} className="friend-form">
                <input
                  type="text"
                  className="input friend-form__input"
                  placeholder="グループ名（任意）"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  maxLength={30}
                />
                <button type="submit" className="btn btn--primary friend-form__btn">
                  作成
                </button>
              </form>
              {createdCode && (
                <div className="friend-message success" style={{ display: 'grid', gap: 6 }}>
                  <span>グループを作りました。このIDを仲間に共有してください：</span>
                  <CodeBadge code={createdCode} />
                </div>
              )}
            </div>

            {/* グループに参加 */}
            <div className="friend-add-box">
              <h4 className="section-title">グループに参加</h4>
              <form onSubmit={handleJoinGroup} className="friend-form">
                <input
                  type="text"
                  className="input friend-form__input"
                  placeholder="KOTO-XXXXXX（グループID）"
                  value={joinInput}
                  onChange={(e) => {
                    setJoinInput(e.target.value)
                    setGroupError(null)
                    setGroupSuccess(null)
                  }}
                />
                <button type="submit" className="btn btn--primary friend-form__btn">
                  参加
                </button>
              </form>
              {groupError && <p className="friend-message error">{groupError}</p>}
              {groupSuccess && <p className="friend-message success">{groupSuccess}</p>}
            </div>

            {/* 参加中のグループ一覧 */}
            <div className="friends-list-section">
              <h4 className="section-title">参加中のグループ ({groups.length})</h4>
              {groups.length === 0 ? (
                <div className="empty-sub">
                  <p>まだグループに参加していません。グループを作成してIDを共有するか、もらったIDで参加してください。</p>
                </div>
              ) : (
                <ul className="friend-cards">
                  {groups.map((g) => (
                    <li key={g.id} className="friend-item-card">
                      <div className="friend-item-card__header">
                        <div
                          className="friend-item-card__avatar"
                          style={{ backgroundColor: '#dceffd' }}
                        >
                          👥
                        </div>
                        <div className="friend-item-card__info">
                          <h5>
                            {g.name}
                            {g.owner && (
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
                          <CodeBadge code={g.id} />
                        </div>
                        <button
                          className="friend-item-card__remove"
                          onClick={() => {
                            if (confirm(`「${g.name}」から抜けますか？`)) leaveGroup(g.id)
                          }}
                          aria-label="グループから抜ける"
                        >
                          抜ける
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </Sheet>
  )
}
