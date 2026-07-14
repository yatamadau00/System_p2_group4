import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { EnrichedKotozute } from '../lib/enrich'
import type { AttachmentKind, MediaItem } from '../types'
import { formatDistance } from '../lib/geo'
import { groupColorIndex, groupSealStyle } from '../lib/groupColor'
import { kindLabel, uid } from '../lib/media'
import { NEAR_RADIUS_M, UNLOCK_RADIUS_M } from '../config'
import { MediaView } from './MediaView'
import { AudioRecorder } from './AudioRecorder'
import { Sheet } from './Sheet'
import {
  AudioIcon,
  CloseIcon,
  EnvelopeIcon,
  FlagIcon,
  HeartIcon,
  ImageIcon,
  LinkIcon,
  LockIcon,
  StarIcon,
  TrashIcon,
  VideoIcon,
} from './icons'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../services/supabaseClient'
import pigeonPng from '../assets/pigeon.png'
import './OpenView.css'

type Phase = 'locked' | 'ready' | 'opening' | 'opened'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const RING = 92 // 半径
const CIRC = 2 * Math.PI * RING

/** タイムスタンプを <input type="datetime-local"> 用のローカル時刻文字列に変換 */
function toDatetimeLocal(ms?: number): string {
  if (!ms) return ''
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

interface OpenViewProps {
  kotozute: EnrichedKotozute
  replies: EnrichedKotozute[]
  onClose: () => void
  onReply: () => void
  onDeleteReply: (id: string) => void
  currentUserId: string | null
  onOpened?: (id: string) => void
  onToggleLike: (id: string) => Promise<void>
  onToggleFavorite: (id: string) => Promise<void>
  /** 自分のことづての本文・場所名・リンク・開封期間を編集する */
  onEdit?: (
    id: string,
    patch: Partial<
      Pick<
        EnrichedKotozute,
        'message' | 'placeLabel' | 'link' | 'media' | 'validFrom' | 'validTo'
      >
    >,
  ) => Promise<unknown>
  /** 自分のことづてをこの画面から削除する */
  onDelete?: (id: string) => void
}

/**
 * 受け取り（開封）画面。体験のクライマックス。
 * - 遠い間はロックし、距離リングと「あと◯m」を出す。
 * - 十分近づくと封蝋が灯り、タップで封が割れ→光と共にベールが晴れ→中身が現れる。
 */
export function OpenView({
  kotozute,
  replies,
  onClose,
  onReply,
  onDeleteReply,
  currentUserId,
  onOpened,
  onToggleLike,
  onToggleFavorite,
  onEdit,
  onDelete,
}: OpenViewProps) {
  const { currentUser } = useAuth()
  // 自分のことづては、どこにいても閲覧・編集できる（距離ロックを無視）
  const isOwn =
    kotozute.mine ||
    (!!currentUser && kotozute.authorId === currentUser.id)
  const initiallyUnlockable = kotozute.proximity === 'unlockable'
  const [phase, setPhase] = useState<Phase>(
    isOwn || initiallyUnlockable ? 'ready' : 'locked',
  )
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)
  const [reportTargetId, setReportTargetId] = useState<string | null>(null)
  const [reportReason, setReportReason] = useState('spam')
  const [reportDetails, setReportDetails] = useState('')
  const [reportError, setReportError] = useState<string | null>(null)
  const [isSubmittingReport, setIsSubmittingReport] = useState(false)
  const openedOnce = useRef(false)
  const titleId = 'open-title'

  // 歩いて近づいたらロック→開封可能へ自動遷移（既に開封済みなら維持）
  useEffect(() => {
    if (openedOnce.current || isOwn) return
    if (kotozute.proximity === 'unlockable') {
      setPhase((p) => (p === 'locked' ? 'ready' : p))
    } else {
      setPhase((p) => (p === 'ready' ? 'locked' : p))
    }
  }, [kotozute.proximity, isOwn])

  const openSeal = () => {
    openedOnce.current = true
    onOpened?.(kotozute.id)
    if (prefersReducedMotion()) {
      setPhase('opened')
      return
    }
    setPhase('opening')
    window.setTimeout(() => setPhase('opened'), 1100)
  }

  const handleReportSubmit = async (reason: string, details: string) => {
    if (!supabase) {
      setReportError('Supabase が設定されていません。')
      return
    }
    if (!reportTargetId) return

    setReportError(null)
    setIsSubmittingReport(true)

    const reporterId = currentUser?.id ?? null

    const { error } = await supabase
      .from('reports')
      .insert([
        {
          kotozute_id: reportTargetId,
          reporter_id: reporterId,
          reason,
          details,
        },
      ])

    setIsSubmittingReport(false)

    if (error) {
      if (error.code === '23505') {
        const itemType = reportTargetId === kotozute.id ? 'ことづて' : '返信'
        setReportError(`この${itemType}は既に通報されています。`)
        return
      }
      setReportError(error.message)
      return
    }

    setIsReportModalOpen(false)
    setReportReason('spam')
    setReportDetails('')
    setReportTargetId(null)
    alert('通報しました。ご協力ありがとうございます。')
  }

  const handleOpenReport = (id: string) => {
    setReportTargetId(id)
    setIsReportModalOpen(true)
  }

  // 距離リングの進捗（NEAR で 0、UNLOCK で 1）
  const progress = useMemo(() => {
    const d = kotozute.distance
    if (d == null) return 0
    if (d <= UNLOCK_RADIUS_M) return 1
    if (d >= NEAR_RADIUS_M) return 0.04
    return (NEAR_RADIUS_M - d) / (NEAR_RADIUS_M - UNLOCK_RADIUS_M)
  }, [kotozute.distance])

  const opened = phase === 'opened'

  return (
    <div
      className={`open${phase === 'opening' ? ' open--opening' : ''}${
        opened ? ' open--opened' : ''
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="open__bg" aria-hidden />
      <div className="open__paper" aria-hidden />
      {phase === 'opening' && (
        <>
          <div className="flash" aria-hidden />
          <div className="veil veil--top" aria-hidden />
          <div className="veil veil--bottom" aria-hidden />
        </>
      )}

      <div className="open__top">
        <button className="open__close" onClick={onClose} aria-label="閉じる">
          <CloseIcon />
        </button>
      </div>

      <div
        className="open__stage"
        onClick={(e) => {
          // 開封前は、中身の外側（背景）をタップで閉じられる
          if (
            (phase === 'locked' || phase === 'ready') &&
            e.target === e.currentTarget
          ) {
            onClose()
          }
        }}
      >
        {phase === 'locked' && (
          <LockedView
            kotozute={kotozute}
            progress={progress}
            titleId={titleId}
            onToggleFavorite={onToggleFavorite}
          />
        )}

        {(phase === 'ready' || phase === 'opening') && (
          <div className="ready">
            <div className="locked__place" id={titleId}>
              {kotozute.placeLabel ?? 'この場所のことづて'}
            </div>
            <button
              className="seal"
              style={kotozute.visibility === 'group' && kotozute.groupId
                ? groupSealStyle(groupColorIndex(kotozute.groupId))
                : undefined}
              onClick={openSeal}
              disabled={phase === 'opening'}
              aria-label="封を開ける"
            >
              <span className="seal__halo" aria-hidden />
              <img src={pigeonPng} alt="" aria-hidden className="seal__glyph" />
            </button>
            <p className="locked__hint">
              ここまで来てくれて、ありがとう。
              <br />
              そっと、封を開けてみてください。
            </p>
            <FavoriteButton
              kotozute={kotozute}
              onToggleFavorite={onToggleFavorite}
              tone="night"
            />
          </div>
        )}

        {opened && (
          <Letter
            kotozute={kotozute}
            onReply={onReply}
            onDeleteReply={onDeleteReply}
            currentUserId={currentUserId}
            replies={replies}
            onReportClick={handleOpenReport}
            onToggleLike={onToggleLike}
            onToggleFavorite={onToggleFavorite}
            canEdit={isOwn && !!onEdit}
            onEdit={onEdit}
            canDelete={isOwn && !!onDelete}
            onDelete={onDelete}
            onClose={onClose}
          />
        )}
      </div>
      {isReportModalOpen && (
        <div className="report-modal" role="dialog" aria-modal="true" aria-labelledby="report-modal-title">
          <div
            className="report-modal__backdrop"
            onClick={() => setIsReportModalOpen(false)}
          />
          <div className="report-modal__content">
            <h2 id="report-modal-title">
              {reportTargetId === kotozute.id ? 'このことづてを通報する' : 'この返信を通報する'}
            </h2>
            <p>不適切だと思われる理由を選択してください。</p>
            <label className="report-modal__label">
              <span>理由</span>
              <select
                value={reportReason}
                onChange={(event) => setReportReason(event.target.value)}
              >
                <option value="spam">スパム</option>
                <option value="inappropriate">不適切な内容</option>
                <option value="privacy">プライバシー侵害</option>
                <option value="harassment">嫌がらせ</option>
                <option value="other">その他</option>
              </select>
            </label>
            <label className="report-modal__label">
              <span>詳細（任意）</span>
              <textarea
                value={reportDetails}
                onChange={(event) => setReportDetails(event.target.value)}
                rows={4}
                placeholder="どの点が問題か詳しく書いてください。"
              />
            </label>
            {reportError && <p className="report-modal__error">{reportError}</p>}
            <div className="report-modal__actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsReportModalOpen(false)}
                disabled={isSubmittingReport}
              >
                キャンセル
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleReportSubmit(reportReason, reportDetails)}
                disabled={isSubmittingReport}
              >
                {isSubmittingReport ? '送信中...' : '通報する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function LockedView({
  kotozute,
  progress,
  titleId,
  onToggleFavorite,
}: {
  kotozute: EnrichedKotozute
  progress: number
  titleId: string
  onToggleFavorite: (id: string) => Promise<void>
}) {
  const d = kotozute.distance
  const remaining = d != null ? Math.max(0, d - UNLOCK_RADIUS_M) : null

  return (
    <div className="locked">
      <div className="locked__place" id={titleId}>
        {kotozute.placeLabel ?? 'どこかの誰かのことづて'}
      </div>

      {kotozute.visibility === 'group' && (
        <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0 -8px 0' }}>
          <span className="friend-only-badge">
            <LockIcon width={10} height={10} style={{ marginRight: 2, display: 'inline-block', verticalAlign: 'middle' }} />
            グループ限定公開
          </span>
        </div>
      )}

      <div className="ring" role="img" aria-label="目的地までの距離">
        <svg viewBox="0 0 200 200" width="200" height="200">
          <circle className="ring__track" cx="100" cy="100" r={RING} />
          <circle
            className="ring__progress"
            cx="100"
            cy="100"
            r={RING}
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - progress)}
          />
        </svg>
        <div className="ring__seal">
          <LockIcon />
        </div>
      </div>

      {remaining != null ? (
        <div className="locked__distance">
          <span>開封まで、あと</span>
          <b>{formatDistance(remaining)}</b>
        </div>
      ) : (
        <div className="locked__distance">
          <span>現在地がわかると、距離が見えます</span>
        </div>
      )}

      <p className="locked__hint">
        このことづては、この場所でしか開けません。
        <br />
        もう少しだけ、近づいてみてください。
      </p>
      <div className="locked__peek">
        {kindLabel(kotozute)}が、ここで待っています
      </div>
      <FavoriteButton
        kotozute={kotozute}
        onToggleFavorite={onToggleFavorite}
        tone="night"
      />
    </div>
  )
}

function FavoriteButton({
  kotozute,
  onToggleFavorite,
  tone = 'paper',
}: {
  kotozute: EnrichedKotozute
  onToggleFavorite: (id: string) => Promise<void>
  tone?: 'night' | 'paper'
}) {
  const [favoriteBusy, setFavoriteBusy] = useState(false)

  return (
    <button
      className={`favorite-action favorite-action--${tone}${
        kotozute.favoritedByCurrentUser ? ' favorite-action--active' : ''
      }`}
      onClick={async () => {
        setFavoriteBusy(true)
        try {
          await onToggleFavorite(kotozute.id)
        } finally {
          setFavoriteBusy(false)
        }
      }}
      disabled={favoriteBusy}
      aria-pressed={!!kotozute.favoritedByCurrentUser}
    >
      <StarIcon width={16} height={16} filled={!!kotozute.favoritedByCurrentUser} />
      {kotozute.favoritedByCurrentUser ? 'お気に入り済み' : 'お気に入り'}
    </button>
  )
}

function Letter({
  kotozute,
  onReply,
  onDeleteReply,
  currentUserId,
  replies,
  onReportClick,
  onToggleLike,
  onToggleFavorite,
  canEdit,
  onEdit,
  canDelete,
  onDelete,
  onClose,
}: {
  kotozute: EnrichedKotozute
  onReply: () => void
  onDeleteReply: (id: string) => void
  currentUserId: string | null
  replies: EnrichedKotozute[]
  onReportClick: (id: string) => void
  onToggleLike: (id: string) => Promise<void>
  onToggleFavorite: (id: string) => Promise<void>
  canEdit?: boolean
  onEdit?: (
    id: string,
    patch: Partial<
      Pick<
        EnrichedKotozute,
        'message' | 'placeLabel' | 'link' | 'media' | 'validFrom' | 'validTo'
      >
    >,
  ) => Promise<unknown>
  canDelete?: boolean
  onDelete?: (id: string) => void
  onClose: () => void
}) {
  const [likeBusy, setLikeBusy] = useState(false)
  const date = new Date(kotozute.createdAt)
  const dateStr = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
  const hasBody = kotozute.message.trim().length > 0 || !!kotozute.link

  const [editing, setEditing] = useState(false)
  const [editMessage, setEditMessage] = useState(kotozute.message)
  const [editPlace, setEditPlace] = useState(kotozute.placeLabel ?? '')
  const [editLink, setEditLink] = useState(kotozute.link ?? '')
  const [editMedia, setEditMedia] = useState<MediaItem[]>(kotozute.media ?? [])
  const [editValidFromStr, setEditValidFromStr] = useState(toDatetimeLocal(kotozute.validFrom))
  const [editValidToStr, setEditValidToStr] = useState(toDatetimeLocal(kotozute.validTo))
  const [recording, setRecording] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)

  const editImageInput = useRef<HTMLInputElement>(null)
  const editVideoInput = useRef<HTMLInputElement>(null)
  const editAudioInput = useRef<HTMLInputElement>(null)

  const addEditFile = (kind: AttachmentKind, file: File | null) => {
    if (!file) return
    setEditMedia((m) => [
      ...m,
      { id: uid(), kind, blob: file, mimeType: file.type, fileName: file.name },
    ])
  }

  const resetEdit = () => {
    setEditMessage(kotozute.message)
    setEditPlace(kotozute.placeLabel ?? '')
    setEditLink(kotozute.link ?? '')
    setEditMedia(kotozute.media ?? [])
    setEditValidFromStr(toDatetimeLocal(kotozute.validFrom))
    setEditValidToStr(toDatetimeLocal(kotozute.validTo))
    setRecording(false)
  }

  const saveEdit = async () => {
    if (!onEdit) return
    setSavingEdit(true)
    try {
      await onEdit(kotozute.id, {
        message: editMessage.trim(),
        placeLabel: editPlace.trim() || undefined,
        link: editLink.trim() || undefined,
        media: editMedia,
        validFrom: editValidFromStr ? new Date(editValidFromStr).getTime() : undefined,
        validTo: editValidToStr ? new Date(editValidToStr).getTime() : undefined,
      })
      setEditing(false)
    } catch (err: any) {
      alert(err.message || '編集を保存できませんでした')
    } finally {
      setSavingEdit(false)
    }
  }

  const editSheet = editing && createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 'calc(var(--z-modal) + 10)' }}>
      <Sheet
        title="ことづてを編集"
        onClose={() => {
          resetEdit()
          setEditing(false)
        }}
      >
        <div className="compose">
          {/* 本文 */}
          <div className="field">
            <label className="field__label" htmlFor="edit-message">
              ことば
            </label>
            <textarea
              id="edit-message"
              className="textarea"
              value={editMessage}
              onChange={(e) => setEditMessage(e.target.value)}
              rows={5}
            />
          </div>

          {/* 添付（写真・映像・声を自由に重ねられる） */}
          <div className="field">
            <span className="field__label">
              想いを添える <small>（追加・削除できます）</small>
            </span>
            <div className="attach-buttons">
              <button
                type="button"
                className="attach-btn"
                onClick={() => editImageInput.current?.click()}
              >
                <ImageIcon width={20} height={20} />
                写真
              </button>
              <button
                type="button"
                className="attach-btn"
                onClick={() => editVideoInput.current?.click()}
              >
                <VideoIcon width={20} height={20} />
                映像
              </button>
              <button
                type="button"
                className="attach-btn"
                onClick={() => setRecording((v) => !v)}
                aria-pressed={recording}
              >
                <AudioIcon width={20} height={20} />
                声
              </button>
            </div>

            <input
              ref={editImageInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                addEditFile('image', e.target.files?.[0] ?? null)
                e.target.value = ''
              }}
            />
            <input
              ref={editVideoInput}
              type="file"
              accept="video/*"
              hidden
              onChange={(e) => {
                addEditFile('video', e.target.files?.[0] ?? null)
                e.target.value = ''
              }}
            />
            <input
              ref={editAudioInput}
              type="file"
              accept="audio/*"
              hidden
              onChange={(e) => {
                addEditFile('audio', e.target.files?.[0] ?? null)
                e.target.value = ''
              }}
            />

            {recording && (
              <div className="recorder-wrap">
                <AudioRecorder
                  onConfirm={(blob, mimeType) => {
                    setEditMedia((m) => [
                      ...m,
                      { id: uid(), kind: 'audio', blob, mimeType, fileName: '録音した声' },
                    ])
                    setRecording(false)
                  }}
                  onCancel={() => setRecording(false)}
                />
                <button
                  type="button"
                  className="recorder__file"
                  onClick={() => {
                    setRecording(false)
                    editAudioInput.current?.click()
                  }}
                >
                  ファイルから選ぶ
                </button>
              </div>
            )}

            {editMedia.length > 0 && (
              <ul className="attach-list">
                {editMedia.map((m) => (
                  <li key={m.id} className="attach-item">
                    <button
                      type="button"
                      className="attach-item__remove"
                      onClick={() =>
                        setEditMedia((list) => list.filter((x) => x.id !== m.id))
                      }
                      aria-label="このメディアを外す"
                    >
                      <CloseIcon width={16} height={16} />
                    </button>
                    <MediaView media={m} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* リンク */}
          <div className="field">
            <label className="field__label" htmlFor="edit-link">
              リンク <small>（任意）</small>
            </label>
            <input
              id="edit-link"
              className="input"
              type="url"
              inputMode="url"
              value={editLink}
              onChange={(e) => setEditLink(e.target.value)}
              placeholder="https://"
            />
          </div>

          {/* 場所の呼び名 */}
          <div className="field">
            <label className="field__label" htmlFor="edit-place">
              場所の呼び名 <small>（任意）</small>
            </label>
            <input
              id="edit-place"
              className="input"
              value={editPlace}
              onChange={(e) => setEditPlace(e.target.value)}
              placeholder="卒業した教室、いつもの帰り道…"
            />
          </div>

          {/* 開封期間設定 */}
          <div className="field">
            <span className="field__label">
              開封できる期間 <small>（任意）</small>
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '6px' }}>
              <div>
                <label
                  className="field__label"
                  htmlFor="edit-valid-from"
                  style={{ fontSize: '0.8rem', color: 'var(--c-ink-2)' }}
                >
                  開始日時
                </label>
                <input
                  id="edit-valid-from"
                  className="input"
                  type="datetime-local"
                  value={editValidFromStr}
                  onChange={(e) => setEditValidFromStr(e.target.value)}
                />
              </div>
              <div>
                <label
                  className="field__label"
                  htmlFor="edit-valid-to"
                  style={{ fontSize: '0.8rem', color: 'var(--c-ink-2)' }}
                >
                  終了日時
                </label>
                <input
                  id="edit-valid-to"
                  className="input"
                  type="datetime-local"
                  value={editValidToStr}
                  onChange={(e) => setEditValidToStr(e.target.value)}
                />
              </div>
            </div>
            <p className="visibility-note">
              期間を設定すると、その期間外はこの場所の地図上に表示されなくなります。
            </p>
          </div>

          <div
            className="letter__actions"
            style={{
              display: 'flex',
              justifyContent: canDelete ? 'space-between' : 'flex-end',
              gap: 'var(--sp-3)',
            }}
          >
            {canDelete && (
              <button
                type="button"
                className="btn btn--soft"
                style={{ color: 'var(--c-danger)' }}
                disabled={savingEdit}
                onClick={() => {
                  if (confirm('このことづてを取り消しますか？')) {
                    onDelete?.(kotozute.id)
                    onClose()
                  }
                }}
              >
                <TrashIcon width={14} height={14} style={{ marginRight: 4, verticalAlign: -2 }} />
                削除
              </button>
            )}
            <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
              <button
                className="btn btn--soft"
                onClick={() => {
                  resetEdit()
                  setEditing(false)
                }}
                disabled={savingEdit}
              >
                キャンセル
              </button>
              <button className="btn btn--primary" onClick={saveEdit} disabled={savingEdit}>
                {savingEdit ? '保存中…' : '保存する'}
              </button>
            </div>
          </div>
        </div>
      </Sheet>
    </div>,
    document.body,
  )

  return (
    <>
      {editSheet}
      <div className="letter">
      <div className="letter__place">
        {kotozute.placeLabel ?? 'この場所のことづて'}
      </div>
      <div className="letter__meta" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
        <span>{kindLabel(kotozute)}</span>
        <span aria-hidden>・</span>
        <span>{dateStr}</span>
        {kotozute.openedByCurrentUser && (
          <>
            <span aria-hidden>・</span>
            <span>開封済み</span>
          </>
        )}
        {kotozute.visibility === 'group' && (
          <span className="friend-only-badge" style={{ margin: 0 }}>
            <LockIcon width={10} height={10} style={{ marginRight: 2, display: 'inline-block', verticalAlign: 'middle' }} />
            グループ限定
          </span>
        )}
        {kotozute.replyToId && (
          <>
            <span aria-hidden>・</span>
            <span>返信</span>
          </>
        )}
      </div>

      {canEdit && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            className="btn btn--soft"
            style={{ minHeight: 0, padding: '8px 16px', fontSize: '0.88rem' }}
            onClick={() => setEditing(true)}
          >
            このことづてを編集
          </button>
        </div>
      )}

      <div className="letter__card">
        {/* 添えられたメディアを順に表示（複数可） */}
        {(kotozute.media ?? []).map((m) => (
          <MediaView key={m.id} media={m} />
        ))}
        {hasBody && (
          <div className="letter__message">
            {kotozute.message}
            {kotozute.link && (
              <div>
                <a
                  className="letter__link"
                  href={kotozute.link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <LinkIcon width={18} height={18} />
                  {kotozute.link}
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      {kotozute.authorName && (
        <div className="letter__sign">— {kotozute.authorName} より</div>
      )}

      <div className="letter__actions">
        <FavoriteButton
          kotozute={kotozute}
          onToggleFavorite={onToggleFavorite}
        />
        <button
          className={`letter__like${kotozute.likedByCurrentUser ? ' letter__like--liked' : ''}`}
          onClick={async () => {
            setLikeBusy(true)
            try {
              await onToggleLike(kotozute.id)
            } finally {
              setLikeBusy(false)
            }
          }}
          disabled={likeBusy}
          aria-pressed={!!kotozute.likedByCurrentUser}
        >
          <HeartIcon width={16} height={16} filled={!!kotozute.likedByCurrentUser} />
          いいね {kotozute.likesCount ?? 0}
        </button>
        <button className="letter__reply" onClick={onReply}>
          <EnvelopeIcon width={16} height={16} />
          返信する
        </button>
        <button
          className="letter__report"
          onClick={() => onReportClick(kotozute.id)}
        >
          <FlagIcon
            width={12}
            height={12}
            style={{ display: 'inline', verticalAlign: '-1px', marginRight: 4 }}
          />
          このことづてを報告する
        </button>
      </div>

      {replies.length > 0 && (
        <div className="thread-replies">
          <div className="thread-replies__title">返信 {replies.length}</div>
          <div className="thread-replies__list">
            {replies.map((reply) => (
              <article key={reply.id} className="thread-reply">
                <div className="thread-reply__meta">
                  <span className="thread-reply__author">
                    {reply.authorName ?? 'なまえのない誰か'}
                  </span>
                  <span aria-hidden>・</span>
                  <span>
                    {new Date(reply.createdAt).getMonth() + 1}月
                    {new Date(reply.createdAt).getDate()}日
                  </span>
                </div>
                {reply.message && <p className="thread-reply__body">{reply.message}</p>}
                {(reply.media ?? []).length > 0 && (
                  <div className="thread-reply__media">
                    {(reply.media ?? []).map((media) => (
                      <MediaView key={media.id} media={media} />
                    ))}
                  </div>
                )}
                {((reply.authorId && reply.authorId === currentUserId) || (!reply.authorId && reply.mine)) ? (
                  <button
                    className="thread-reply__delete"
                    onClick={() => {
                      if (confirm('この返信を取り消しますか？')) onDeleteReply(reply.id)
                    }}
                    aria-label="この返信を削除"
                  >
                    <TrashIcon width={14} height={14} />
                    削除
                  </button>
                ) : (
                  <button
                    className="thread-reply__report"
                    onClick={() => onReportClick(reply.id)}
                    aria-label="この返信を通報"
                  >
                    <FlagIcon
                      width={12}
                      height={12}
                      style={{ display: 'inline', verticalAlign: '-1px', marginRight: 4 }}
                    />
                    この返信を報告する
                  </button>
                )}
              </article>
            ))}
          </div>
        </div>
      )}
      </div>
    </>
  )
}
