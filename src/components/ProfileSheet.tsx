import { useMemo, useState, type ChangeEvent } from 'react'
import type {
  UserProfile,
  Group,
  GroupMember,
  Kotozute,
  KotozuteOpenHistory,
} from '../types'
import { Sheet } from './Sheet'
import { GroupSheet } from './GroupSheet'
import { TrashIcon, PigeonIcon, LockIcon } from './icons'
import { imageFileToSquareDataUrl } from '../lib/image'
import './ProfileSheet.css'

interface ProfileSheetProps {
  items: Kotozute[]
  openHistory: KotozuteOpenHistory[]
  profile: UserProfile
  updateProfile: (
    updates: Partial<Omit<UserProfile, 'id' | 'friendCode'>>,
  ) => Promise<void>
  linkGoogleAccount: () => Promise<void>
  groups: Group[]
  createGroup: (name: string, avatarImageUrl?: string | null) => Promise<Group>
  joinGroup: (code: string) => Promise<Group>
  leaveGroup: (id: string) => Promise<void>
  updateGroup: (
    id: string,
    updates: Partial<
      Pick<Group, 'name' | 'avatarEmoji' | 'avatarColor' | 'avatarImageUrl'>
    >,
  ) => Promise<void>
  getGroupMembers: (id: string) => Promise<GroupMember[]>
  onSelectKotozute: (id: string) => void
  onDeleteKotozute: (id: string) => void
  onLogout: () => void
  onClose: () => void
}

// 選択可能なアバター絵文字
const AVATAR_EMOJIS = ['🦉', '🕊️', '🌸', '🌲', 'そ', 'み', 'は', '🦊', '🐱', '🍀', '🌟', '🎏']
// 選択可能なアバター背景色
const AVATAR_COLORS = ['#f1e8d6', '#e2ecc8', '#ffdce3', '#dceffd', '#fceecb', '#ffd8b3', '#e8dffd']
const AVATAR_EXPORT_SIZE = 320

function createEditedAvatarDataUrl(
  src: string,
  zoom: number,
  offsetX: number,
  offsetY: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = AVATAR_EXPORT_SIZE
      canvas.height = AVATAR_EXPORT_SIZE
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('画像を編集できませんでした'))
        return
      }

      const baseScale = Math.max(
        AVATAR_EXPORT_SIZE / image.width,
        AVATAR_EXPORT_SIZE / image.height,
      )
      const scale = baseScale * zoom
      const drawWidth = image.width * scale
      const drawHeight = image.height * scale
      const maxShiftX = Math.max(0, (drawWidth - AVATAR_EXPORT_SIZE) / 2)
      const maxShiftY = Math.max(0, (drawHeight - AVATAR_EXPORT_SIZE) / 2)
      const drawX =
        (AVATAR_EXPORT_SIZE - drawWidth) / 2 + (offsetX / 100) * maxShiftX
      const drawY =
        (AVATAR_EXPORT_SIZE - drawHeight) / 2 + (offsetY / 100) * maxShiftY

      ctx.clearRect(0, 0, AVATAR_EXPORT_SIZE, AVATAR_EXPORT_SIZE)
      ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight)
      resolve(canvas.toDataURL('image/jpeg', 0.9))
    }
    image.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
    image.src = src
  })
}

export function ProfileSheet({
  items,
  openHistory,
  profile,
  updateProfile,
  linkGoogleAccount,
  groups,
  createGroup,
  joinGroup,
  leaveGroup,
  updateGroup,
  getGroupMembers,
  onSelectKotozute,
  onDeleteKotozute,
  onLogout,
  onClose,
}: ProfileSheetProps) {
  const [tab, setTab] = useState<'profile' | 'groups'>('profile')
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(profile.name)
  const [editBio, setEditBio] = useState(profile.bio)
  const [editEmoji, setEditEmoji] = useState(profile.avatarEmoji)
  const [editColor, setEditColor] = useState(profile.avatarColor)
  const [editImageUrl, setEditImageUrl] = useState(profile.avatarImageUrl ?? null)
  const [avatarEditorSrc, setAvatarEditorSrc] = useState<string | null>(null)
  const [avatarZoom, setAvatarZoom] = useState(1)
  const [avatarOffsetX, setAvatarOffsetX] = useState(0)
  const [avatarOffsetY, setAvatarOffsetY] = useState(0)
  const [savingProfile, setSavingProfile] = useState(false)
  const [linkingGoogle, setLinkingGoogle] = useState(false)
  const [googleLinkError, setGoogleLinkError] = useState<string | null>(null)

  // グループ関連
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupImage, setNewGroupImage] = useState<string | null>(null)
  const [createdCode, setCreatedCode] = useState<string | null>(null)
  const [joinInput, setJoinInput] = useState('')
  const [groupError, setGroupError] = useState<string | null>(null)
  const [groupSuccess, setGroupSuccess] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)

  // 自分のことづて一覧
  const myItems = useMemo(() => items.filter((item) => item.mine), [items])
  const openedItems = useMemo(() => {
    const itemById = new Map(items.map((item) => [item.id, item]))
    return openHistory
      .map((record) => {
        const item = itemById.get(record.kotozuteId)
        return item ? { item, openedAt: record.openedAt } : null
      })
      .filter((record): record is { item: Kotozute; openedAt: number } => !!record)
  }, [items, openHistory])

  const saveProfile = async (
    nextImageUrl = editImageUrl,
    options: { closeAfterSave?: boolean } = {},
  ): Promise<boolean> => {
    if (!editName.trim()) {
      alert('名前を入力してください')
      return false
    }
    setSavingProfile(true)
    try {
      await updateProfile({
        name: editName.trim(),
        bio: editBio.trim(),
        avatarEmoji: editEmoji,
        avatarColor: editColor,
        avatarImageUrl: nextImageUrl,
      })
      if (options.closeAfterSave ?? true) setIsEditing(false)
      return true
    } catch (err: any) {
      alert(err.message || 'プロフィールの保存に失敗しました')
      return false
    } finally {
      setSavingProfile(false)
    }
  }

  const handleSaveProfile = () => {
    void saveProfile()
  }

  const handleCancelEdit = () => {
    setEditName(profile.name)
    setEditBio(profile.bio)
    setEditEmoji(profile.avatarEmoji)
    setEditColor(profile.avatarColor)
    setEditImageUrl(profile.avatarImageUrl ?? null)
    setAvatarEditorSrc(null)
    setAvatarZoom(1)
    setAvatarOffsetX(0)
    setAvatarOffsetY(0)
    setIsEditing(false)
  }

  const handleAvatarImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      alert('画像ファイルを選択してください')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('画像は2MB以下にしてください')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAvatarEditorSrc(reader.result)
        setAvatarZoom(1)
        setAvatarOffsetX(0)
        setAvatarOffsetY(0)
      }
    }
    reader.onerror = () => {
      alert('画像の読み込みに失敗しました')
    }
    reader.readAsDataURL(file)
  }

  const handleApplyAvatarEdit = async () => {
    if (!avatarEditorSrc) return
    try {
      const nextImageUrl = await createEditedAvatarDataUrl(
        avatarEditorSrc,
        avatarZoom,
        avatarOffsetX,
        avatarOffsetY,
      )
      const saved = await saveProfile(nextImageUrl, { closeAfterSave: false })
      if (!saved) return
      setEditImageUrl(nextImageUrl)
      setAvatarEditorSrc(null)
    } catch (err: any) {
      alert(err.message || '画像の編集に失敗しました')
    }
  }

  const handleRemoveAvatarImage = () => {
    setEditImageUrl(null)
    setAvatarEditorSrc(null)
    setAvatarZoom(1)
    setAvatarOffsetX(0)
    setAvatarOffsetY(0)
  }

  const copyCode = (code: string) => {
    navigator.clipboard?.writeText(code)
    setCopiedId(code)
    setTimeout(() => setCopiedId((c) => (c === code ? null : c)), 2000)
  }

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    setGroupError(null)
    setGroupSuccess(null)
    try {
      const g = await createGroup(newGroupName, newGroupImage)
      setCreatedCode(g.id)
      setNewGroupName('')
      setNewGroupImage(null)
    } catch (err: any) {
      setGroupError(err.message || 'グループを作成できませんでした。')
    }
  }

  const handleNewGroupImage = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      setNewGroupImage(await imageFileToSquareDataUrl(file))
    } catch (err: any) {
      alert(err.message || '画像の読み込みに失敗しました')
    }
  }

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    setGroupError(null)
    setGroupSuccess(null)
    if (!joinInput.trim()) return
    try {
      const g = await joinGroup(joinInput)
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
    <>
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
                      {editImageUrl ? (
                        <img src={editImageUrl} alt="" className="profile-card__avatar-image" />
                      ) : (
                        editEmoji
                      )}
                    </div>
                    <div className="avatar-pickers">
                      <div className="avatar-picker-group">
                        <label htmlFor="avatar-image">画像</label>
                        <div className="avatar-image-actions">
                          <label className="btn btn--soft avatar-image-button" htmlFor="avatar-image">
                            画像を選択
                          </label>
                          <input
                            id="avatar-image"
                            className="avatar-image-input"
                            type="file"
                            accept="image/*"
                            onChange={handleAvatarImageChange}
                          />
                          {editImageUrl && (
                            <button
                              type="button"
                              className="btn btn--soft avatar-image-button"
                              onClick={() => setAvatarEditorSrc(editImageUrl)}
                            >
                              画像を編集
                            </button>
                          )}
                          {editImageUrl && (
                            <button
                              type="button"
                              className="btn btn--soft avatar-image-button"
                              onClick={handleRemoveAvatarImage}
                            >
                              画像を解除
                            </button>
                          )}
                        </div>
                      </div>
                      {avatarEditorSrc && (
                        <div className="avatar-editor" aria-label="プロフィール画像を編集">
                          <div className="avatar-editor__preview">
                            <img
                              src={avatarEditorSrc}
                              alt=""
                              style={{
                                transform: `translate(${avatarOffsetX}%, ${avatarOffsetY}%) scale(${avatarZoom})`,
                              }}
                            />
                          </div>
                          <div className="avatar-editor__controls">
                            <label>
                              拡大
                              <input
                                type="range"
                                min="1"
                                max="2.5"
                                step="0.05"
                                value={avatarZoom}
                                onChange={(e) => setAvatarZoom(Number(e.target.value))}
                              />
                            </label>
                            <label>
                              左右
                              <input
                                type="range"
                                min="-100"
                                max="100"
                                step="1"
                                value={avatarOffsetX}
                                onChange={(e) => setAvatarOffsetX(Number(e.target.value))}
                              />
                            </label>
                            <label>
                              上下
                              <input
                                type="range"
                                min="-100"
                                max="100"
                                step="1"
                                value={avatarOffsetY}
                                onChange={(e) => setAvatarOffsetY(Number(e.target.value))}
                              />
                            </label>
                          </div>
                          <div className="avatar-editor__actions">
                            <button
                              type="button"
                              className="btn btn--soft avatar-image-button"
                              onClick={() => setAvatarEditorSrc(null)}
                            >
                              閉じる
                            </button>
                            <button
                              type="button"
                              className="btn btn--primary avatar-image-button"
                              onClick={handleApplyAvatarEdit}
                              disabled={savingProfile}
                            >
                              {savingProfile ? '保存中…' : '加工して保存'}
                            </button>
                          </div>
                        </div>
                      )}
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
                      {profile.avatarImageUrl ? (
                        <img src={profile.avatarImageUrl} alt="" className="profile-card__avatar-image" />
                      ) : (
                        profile.avatarEmoji
                      )}
                    </div>
                    <div className="profile-card__title">
                      <h3>{profile.name}</h3>
                      {profile.email && <p className="profile-card__email">{profile.email}</p>}
                    </div>
                  </div>

                  {profile.bio && <p className="profile-card__bio">{profile.bio}</p>}

                  <div className="google-link-card">
                    <div>
                      <strong>Googleアカウント</strong>
                      <p>{profile.googleLinked ? '連携済みです' : '連携すると次回からGoogleでログインできます'}</p>
                    </div>
                    {profile.googleLinked ? (
                      <span className="google-link-card__status">連携済み</span>
                    ) : (
                      <button
                        type="button"
                        className="btn btn--soft"
                        disabled={linkingGoogle}
                        onClick={async () => {
                          setGoogleLinkError(null)
                          setLinkingGoogle(true)
                          try {
                            await linkGoogleAccount()
                          } catch (err: unknown) {
                            setGoogleLinkError(
                              err instanceof Error ? err.message : 'Googleアカウント連携に失敗しました',
                            )
                            setLinkingGoogle(false)
                          }
                        }}
                      >
                        {linkingGoogle ? '接続中…' : 'Googleと連携'}
                      </button>
                    )}
                  </div>
                  {googleLinkError && <p className="profile-card__link-error">{googleLinkError}</p>}

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

            {/* 取得履歴 */}
            <div className="open-history-section">
              <h4 className="section-title">取得したことづて ({openedItems.length})</h4>
              {openedItems.length === 0 ? (
                <div className="empty-sub">
                  <p>まだ取得したことづてはありません。近くのことづてを開くと、ここに日時つきで残ります。</p>
                </div>
              ) : (
                <ul className="cz-list">
                  {openedItems.map(({ item: k, openedAt }) => (
                    <li key={`${k.id}:${openedAt}`}>
                      <button className="cz-row" onClick={() => onSelectKotozute(k.id)}>
                        <span className="cz-row__badge cz-row__badge--near">
                          <PigeonIcon />
                        </span>
                        <span className="cz-row__main">
                          <span className="cz-row__place">
                            {k.placeLabel ?? 'この場所のことづて'}
                          </span>
                          <span className="cz-row__sub">
                            {new Date(openedAt).toLocaleString('ja-JP', {
                              year: 'numeric',
                              month: 'numeric',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                            に取得
                            {k.visibility === 'group' && (
                              <span className="friend-only-badge">
                                <LockIcon width={10} height={10} style={{ marginRight: 2, display: 'inline-block', verticalAlign: 'middle' }} />
                                グループ限定
                              </span>
                            )}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
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

            {/* アカウント操作（ログアウト） */}
            <div className="account-section">
              <button
                className="btn btn--soft btn--block account-logout"
                onClick={() => {
                  if (confirm('ログアウトしますか？')) onLogout()
                }}
              >
                ログアウト
              </button>
            </div>
          </div>
        ) : (
          <div className="friends-tab">
            {/* グループを作成 */}
            <div className="friend-add-box">
              <h4 className="section-title">グループを作成</h4>
              <div className="group-create-photo">
                <div
                  className="friend-item-card__avatar group-create-photo__preview"
                  style={{ backgroundColor: '#dceffd' }}
                >
                  {newGroupImage ? (
                    <img src={newGroupImage} alt="" className="group-avatar-image" />
                  ) : (
                    '👥'
                  )}
                </div>
                <div className="group-create-photo__actions">
                  <label className="btn btn--soft avatar-image-button" htmlFor="new-group-image">
                    写真を選ぶ
                  </label>
                  <input
                    id="new-group-image"
                    className="avatar-image-input"
                    type="file"
                    accept="image/*"
                    onChange={handleNewGroupImage}
                  />
                  {newGroupImage && (
                    <button
                      type="button"
                      className="btn btn--soft avatar-image-button"
                      onClick={() => setNewGroupImage(null)}
                    >
                      写真を外す
                    </button>
                  )}
                </div>
              </div>
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
                          style={{ backgroundColor: g.avatarColor }}
                        >
                          {g.avatarImageUrl ? (
                            <img
                              src={g.avatarImageUrl}
                              alt=""
                              className="group-avatar-image"
                            />
                          ) : (
                            g.avatarEmoji
                          )}
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
                          className="btn btn--soft"
                          style={{ minHeight: 0, padding: '8px 12px', fontSize: '0.85rem' }}
                          onClick={() => setSelectedGroup(g)}
                          aria-label="グループの詳細・メンバーを見る"
                        >
                          詳細
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

    {selectedGroup && (
      <GroupSheet
        group={selectedGroup}
        getMembers={getGroupMembers}
        updateGroup={updateGroup}
        onLeave={leaveGroup}
        onClose={() => setSelectedGroup(null)}
      />
    )}
    </>
  )
}
