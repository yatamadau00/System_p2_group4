import { useRef, useState } from 'react'
import type { AttachmentKind, LatLng, MediaItem, NewKotozute } from '../types'
import { uid } from '../lib/media'
import { useObjectUrl } from '../hooks/useObjectUrl'
import { AudioRecorder } from './AudioRecorder'
import { Sheet } from './Sheet'
import {
  AudioIcon,
  CloseIcon,
  ImageIcon,
  LocateIcon,
  VideoIcon,
} from './icons'
import './ComposeFlow.css'

interface ComposeFlowProps {
  position: LatLng | null
  /** 位置情報の再取得を促す */
  onRetryLocation: () => void
  onSubmit: (input: NewKotozute) => Promise<void>
  onClose: () => void
  defaultAuthorName?: string
}

/**
 * ことづてを残す画面（1ページ完結）。
 * - 場所は「いまいる場所」のみ（不特定の場所に置けてしまう無法を防ぐ）。
 * - 種別を1つに絞らせず、本文＋写真／映像／声を自由に添えられる。
 * - 声はその場で録音できる（ファイル選択にも対応）。
 */
export function ComposeFlow({
  position,
  onRetryLocation,
  onSubmit,
  onClose,
  defaultAuthorName = '',
}: ComposeFlowProps) {
  const [message, setMessage] = useState('')
  const [link, setLink] = useState('')
  const [authorName, setAuthorName] = useState(defaultAuthorName)
  const [placeLabel, setPlaceLabel] = useState('')
  const [media, setMedia] = useState<MediaItem[]>([])
  const [recording, setRecording] = useState(false)
  const [submitting, setSubmitting] = useState(false)


  const imageInput = useRef<HTMLInputElement>(null)
  const videoInput = useRef<HTMLInputElement>(null)
  const audioInput = useRef<HTMLInputElement>(null)

  const addFile = (kind: AttachmentKind, file: File | null) => {
    if (!file) return
    setMedia((m) => [
      ...m,
      { id: uid(), kind, blob: file, mimeType: file.type, fileName: file.name },
    ])
  }

  const addRecording = (blob: Blob, mimeType: string) => {
    setMedia((m) => [
      ...m,
      { id: uid(), kind: 'audio', blob, mimeType, fileName: '録音した声' },
    ])
    setRecording(false)
  }

  const removeMedia = (id: string) =>
    setMedia((m) => m.filter((x) => x.id !== id))

  const canSubmit =
    !!position && (message.trim().length > 0 || media.length > 0)

  const submit = async () => {
    if (!canSubmit || !position || submitting) return
    setSubmitting(true)
    try {
      await onSubmit({
        location: position,
        message: message.trim(),
        link: link.trim() || undefined,
        authorName: authorName.trim() || undefined,
        placeLabel: placeLabel.trim() || undefined,
        media,
        mine: true,
      })
    } catch (e) {
      console.error(e)
      setSubmitting(false)
      alert('ことづてを残せませんでした。もう一度お試しください。')
    }
  }

  if (submitting) {
    return (
      <Sheet title="ことづて" onClose={() => {}} dismissOnScrim={false}>
        <div className="sending" role="status" aria-live="polite">
          <div className="spinner spinner--ink" />
          <p>そっと、この場所に結んでいます…</p>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet title="ここに、ことづてを残す" onClose={onClose}>
      <div className="compose">
        {/* 場所（今いる場所のみ） */}
        {position ? (
          <div className="place-chosen" role="status">
            <LocateIcon width={24} height={24} />
            <div>
              <b>いまいる場所に残します</b>
              <small>
                {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
              </small>
            </div>
          </div>
        ) : (
          <div className="place-missing" role="status">
            <div>
              <b>現在地がまだ取得できていません</b>
              <small>ことづては「いまいる場所」にだけ残せます。</small>
            </div>
            <button className="btn btn--soft" onClick={onRetryLocation}>
              現在地を取得
            </button>
          </div>
        )}

        {/* 本文 */}
        <div className="field">
          <label className="field__label" htmlFor="cz-message">
            ことば
          </label>
          <textarea
            id="cz-message"
            className="textarea"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={
              'ここに、ことづてを綴ってください。\nこの場所を訪れた誰かに、そっと届きます。'
            }
          />
        </div>

        {/* 添付（写真・映像・声を自由に重ねられる） */}
        <div className="field">
          <span className="field__label">
            想いを添える <small>（いくつでも・任意）</small>
          </span>
          <div className="attach-buttons">
            <button
              className="attach-btn"
              onClick={() => imageInput.current?.click()}
            >
              <ImageIcon width={20} height={20} />
              写真
            </button>
            <button
              className="attach-btn"
              onClick={() => videoInput.current?.click()}
            >
              <VideoIcon width={20} height={20} />
              映像
            </button>
            <button
              className="attach-btn"
              onClick={() => setRecording((v) => !v)}
              aria-pressed={recording}
            >
              <AudioIcon width={20} height={20} />
              声
            </button>
          </div>

          {/* 写真・映像はその場で撮影 or ライブラリから選択（モバイル） */}
          <input
            ref={imageInput}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              addFile('image', e.target.files?.[0] ?? null)
              e.target.value = ''
            }}
          />
          <input
            ref={videoInput}
            type="file"
            accept="video/*"
            hidden
            onChange={(e) => {
              addFile('video', e.target.files?.[0] ?? null)
              e.target.value = ''
            }}
          />
          <input
            ref={audioInput}
            type="file"
            accept="audio/*"
            hidden
            onChange={(e) => {
              addFile('audio', e.target.files?.[0] ?? null)
              e.target.value = ''
            }}
          />

          {recording && (
            <div className="recorder-wrap">
              <AudioRecorder
                onConfirm={addRecording}
                onCancel={() => setRecording(false)}
              />
              <button
                className="recorder__file"
                onClick={() => {
                  setRecording(false)
                  audioInput.current?.click()
                }}
              >
                ファイルから選ぶ
              </button>
            </div>
          )}

          {media.length > 0 && (
            <ul className="attach-list">
              {media.map((m) => (
                <AttachmentPreview
                  key={m.id}
                  item={m}
                  onRemove={() => removeMedia(m.id)}
                />
              ))}
            </ul>
          )}
        </div>

        {/* リンク */}
        <div className="field">
          <label className="field__label" htmlFor="cz-link">
            リンク <small>（任意）</small>
          </label>
          <input
            id="cz-link"
            className="input"
            type="url"
            inputMode="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://"
          />
        </div>

        {/* 場所の呼び名 */}
        <div className="field">
          <label className="field__label" htmlFor="cz-place">
            場所の呼び名 <small>（任意）</small>
          </label>
          <input
            id="cz-place"
            className="input"
            value={placeLabel}
            onChange={(e) => setPlaceLabel(e.target.value)}
            placeholder="卒業した教室、いつもの帰り道…"
          />
        </div>

        {/* 残した人の呼び名 */}
        <div className="field">
          <label className="field__label" htmlFor="cz-author">
            あなたの呼び名 <small>（任意・匿名のままでも）</small>
          </label>
          <input
            id="cz-author"
            className="input"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            placeholder="なまえのない人"
          />
        </div>

        <div className="compose__footer">
          <button
            className="btn btn--primary btn--block"
            disabled={!canSubmit}
            onClick={submit}
          >
            ここに、ことづてを残す
          </button>
          {!position && (
            <p className="compose__foot-note">
              ※ 現在地が取得できると残せるようになります
            </p>
          )}
        </div>
      </div>
    </Sheet>
  )
}

function AttachmentPreview({
  item,
  onRemove,
}: {
  item: MediaItem
  onRemove: () => void
}) {
  const url = useObjectUrl(item.blob, item.url)

  return (
    <li className="attach-item">
      <button
        className="attach-item__remove"
        onClick={onRemove}
        aria-label="この添付を外す"
      >
        <CloseIcon width={16} height={16} />
      </button>
      {item.kind === 'image' && url && (
        <img src={url} alt="添付した写真" />
      )}
      {item.kind === 'video' && url && <video src={url} controls playsInline />}
      {item.kind === 'audio' && url && (
        <div className="attach-item__audio">
          <AudioIcon width={24} height={24} style={{ color: 'var(--c-amber-deep)' }} />
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio src={url} controls />
        </div>
      )}
    </li>
  )
}
