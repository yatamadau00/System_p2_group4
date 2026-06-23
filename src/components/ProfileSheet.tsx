import { useMemo, useState } from 'react'
import type { UserProfile, Friend, Kotozute } from '../types'
import { Sheet } from './Sheet'
import { TrashIcon, PigeonIcon, LockIcon } from './icons'
import './ProfileSheet.css'

interface ProfileSheetProps {
  items: Kotozute[]
  profile: UserProfile
  updateProfile: (updates: Partial<Omit<UserProfile, 'id' | 'friendCode'>>) => Promise<void>
  friends: Friend[]
  addFriendByCode: (code: string) => Promise<Friend>
  addFriendDirect: (suggested: Omit<Friend, 'addedAt'>) => Promise<void>
  removeFriend: (id: string) => Promise<void>
  suggestedFriends: Omit<Friend, 'addedAt'>[]
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
  friends,
  addFriendByCode,
  addFriendDirect,
  removeFriend,
  suggestedFriends,
  onSelectKotozute,
  onDeleteKotozute,
  onClose,
}: ProfileSheetProps) {
  const [tab, setTab] = useState<'profile' | 'friends'>('profile')
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(profile.name)
  const [editBio, setEditBio] = useState(profile.bio)
  const [editEmoji, setEditEmoji] = useState(profile.avatarEmoji)
  const [editColor, setEditColor] = useState(profile.avatarColor)

  const [friendCodeInput, setFriendCodeInput] = useState('')
  const [friendError, setFriendError] = useState<string | null>(null)
  const [friendSuccess, setFriendSuccess] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [friendBusy, setFriendBusy] = useState(false)

  // 自分のことづて一覧
  const myItems = useMemo(() => {
    return items.filter((item) => item.mine)
  }, [items])

  // プロフィール編集の保存
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

  // プロフィール編集キャンセル
  const handleCancelEdit = () => {
    setEditName(profile.name)
    setEditBio(profile.bio)
    setEditEmoji(profile.avatarEmoji)
    setEditColor(profile.avatarColor)
    setIsEditing(false)
  }

  // フレンドコードのコピー
  const handleCopyCode = () => {
    navigator.clipboard.writeText(profile.friendCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // フレンドコードでの追加
  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault()
    setFriendError(null)
    setFriendSuccess(null)
    
    if (!friendCodeInput.trim()) return

    setFriendBusy(true)
    try {
      const added = await addFriendByCode(friendCodeInput)
      setFriendSuccess(`${added.name}さんとフレンドになりました！`)
      setFriendCodeInput('')
    } catch (err: any) {
      setFriendError(err.message || 'フレンドの追加に失敗しました。')
    } finally {
      setFriendBusy(false)
    }
  }

  // おすすめフレンドリスト（すでにフレンドになっている人を除く）
  const remainingSuggestions = useMemo(() => {
    return suggestedFriends.filter(sf => !friends.some(f => f.id === sf.id))
  }, [friends, suggestedFriends])

  return (
    <Sheet title="プロフィール & フレンド" onClose={onClose}>
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
          aria-pressed={tab === 'friends'}
          onClick={() => setTab('friends')}
        >
          フレンド ({friends.length})
        </button>
      </div>

      <div className="social-body">
        {tab === 'profile' ? (
          <div className="profile-tab">
            {/* プロフィールカード */}
            <div className="profile-card">
              {isEditing ? (
                <div className="profile-card__edit">
                  {/* アバター選択 */}
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

                  {/* 名前・一言 */}
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
                      <div className="friend-code-badge" onClick={handleCopyCode} role="button" tabIndex={0} aria-label="フレンドコードをコピー">
                        <code>{profile.friendCode}</code>
                        <span className="copy-hint">{copied ? 'コピー完了' : 'コピー'}</span>
                      </div>
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
                        <span className={`cz-row__badge cz-row__badge--unlockable`}>
                          <PigeonIcon />
                        </span>
                        <span className="cz-row__main">
                          <span className="cz-row__place">
                            {k.placeLabel ?? 'この場所のことづて'}
                          </span>
                          <span className="cz-row__sub">
                            {new Date(k.createdAt).toLocaleDateString('ja-JP')}
                            {k.visibility === 'friends' && (
                              <span className="friend-only-badge">
                                <LockIcon width={10} height={10} style={{ marginRight: 2, display: 'inline-block', verticalAlign: 'middle' }} />
                                フレンド限定
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
            {/* フレンド追加フォーム */}
            <div className="friend-add-box">
              <form onSubmit={handleAddFriend} className="friend-form">
                <input
                  type="text"
                  className="input friend-form__input"
                  placeholder="KOTO-XXXX（フレンドコード）"
                  value={friendCodeInput}
                  onChange={(e) => {
                    setFriendCodeInput(e.target.value)
                    setFriendError(null)
                    setFriendSuccess(null)
                  }}
                />
                <button type="submit" className="btn btn--primary friend-form__btn" disabled={friendBusy}>
                  {friendBusy ? '追加中…' : '追加'}
                </button>
              </form>
              {friendError && <p className="friend-message error">{friendError}</p>}
              {friendSuccess && <p className="friend-message success">{friendSuccess}</p>}
            </div>

            {/* フレンド一覧 */}
            <div className="friends-list-section">
              <h4 className="section-title">フレンド一覧 ({friends.length})</h4>
              {friends.length === 0 ? (
                <div className="empty-sub">
                  <p>フレンドがまだいません。フレンドコードを入力するか、下のおすすめフレンドから登録してみてください。</p>
                </div>
              ) : (
                <ul className="friend-cards">
                  {friends.map((f) => (
                    <li key={f.id} className="friend-item-card">
                      <div className="friend-item-card__header">
                        <div
                          className="friend-item-card__avatar"
                          style={{ backgroundColor: f.avatarColor }}
                        >
                          {f.avatarEmoji}
                        </div>
                        <div className="friend-item-card__info">
                          <h5>{f.name}</h5>
                          <code>{f.friendCode}</code>
                        </div>
                        <button
                          className="friend-item-card__remove"
                          onClick={async () => {
                            if (confirm(`${f.name}さんのフレンド登録を解除しますか？`)) {
                              try {
                                await removeFriend(f.id)
                              } catch (err: any) {
                                alert(err.message || 'フレンド解除に失敗しました')
                              }
                            }
                          }}
                          aria-label="フレンド解除"
                        >
                          解除
                        </button>
                      </div>
                      {f.bio && <p className="friend-item-card__bio">{f.bio}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* おすすめフレンド（簡単追加用） */}
            {remainingSuggestions.length > 0 && (
              <div className="suggested-friends-section">
                <h4 className="section-title">おすすめのフレンド（シミュレーション用）</h4>
                <ul className="suggested-list">
                  {remainingSuggestions.map((sf) => (
                    <li key={sf.id} className="suggested-item">
                      <div
                        className="suggested-item__avatar"
                        style={{ backgroundColor: sf.avatarColor }}
                      >
                        {sf.avatarEmoji}
                      </div>
                      <div className="suggested-item__info">
                        <strong>{sf.name}</strong>
                        <span>{sf.bio}</span>
                      </div>
                      <button
                        className="btn btn--soft suggested-item__btn"
                        onClick={async () => {
                          try {
                            await addFriendDirect(sf)
                          } catch (err: any) {
                            alert(err.message || 'フレンド追加に失敗しました')
                          }
                        }}
                      >
                        追加
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </Sheet>
  )
}
