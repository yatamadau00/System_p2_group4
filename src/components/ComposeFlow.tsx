import { useRef, useState } from 'react'
import type { LatLng, MediaKind, NewKotozute } from '../types'
import { useObjectUrl } from '../hooks/useObjectUrl'
import { Sheet } from './Sheet'
import {
  AudioIcon,
  CloseIcon,
  ImageIcon,
  LocateIcon,
  PinIcon,
  TextIcon,
  VideoIcon,
} from './icons'
import './ComposeFlow.css'

interface ComposeFlowProps {
  position: LatLng | null
  /** 地図で場所を選ぶ。確定座標 or キャンセル(null) を返す */
  requestMapPick: (initial: LatLng | null) => Promise<LatLng | null>
  onSubmit: (input: NewKotozute) => Promise<void>
  onClose: () => void
}

const KINDS: {
  kind: MediaKind
  label: string
  hint: string
  Icon: typeof TextIcon
}[] = [
  { kind: 'text', label: 'ことば', hint: '手紙のように', Icon: TextIcon },
  { kind: 'image', label: '写真', hint: 'あの日の景色', Icon: ImageIcon },
  { kind: 'video', label: '映像', hint: '動く思い出', Icon: VideoIcon },
  { kind: 'audio', label: '声', hint: '聞かせたい音', Icon: AudioIcon },
]

const ACCEPT: Record<MediaKind, string> = {
  text: '',
  image: 'image/*',
  video: 'video/*',
  audio: 'audio/*',
}

export function ComposeFlow({
  position,
  requestMapPick,
  onSubmit,
  onClose,
}: ComposeFlowProps) {
  const [step, setStep] = useState(0)
  const [location, setLocation] = useState<LatLng | null>(null)
  const [placeLabel, setPlaceLabel] = useState('')
  const [mediaKind, setMediaKind] = useState<MediaKind | null>(null)
  const [message, setMessage] = useState('')
  const [link, setLink] = useState('')
  const [authorName, setAuthorName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const useHere = () => {
    if (position) {
      setLocation(position)
    }
  }

  const pickOnMap = async () => {
    const picked = await requestMapPick(location ?? position)
    if (picked) setLocation(picked)
  }

  const canSubmit = () => {
    if (!location || !mediaKind) return false
    if (mediaKind === 'text') return message.trim().length > 0
    return file != null
  }

  const submit = async () => {
    if (!location || !mediaKind || submitting) return
    setSubmitting(true)
    try {
      const media =
        mediaKind === 'text' || !file
          ? undefined
          : {
              kind: mediaKind,
              blob: file,
              mimeType: file.type,
              fileName: file.name,
            }
      await onSubmit({
        location,
        mediaKind,
        message: message.trim(),
        link: link.trim() || undefined,
        authorName: authorName.trim() || undefined,
        placeLabel: placeLabel.trim() || undefined,
        media,
        mine: true,
      })
      // onSubmit 側で閉じる
    } catch (e) {
      console.error(e)
      setSubmitting(false)
      alert('ことづてを残せませんでした。もう一度お試しください。')
    }
  }

  const titles = ['どこに残しますか', 'なにを添えますか', 'ことづてを綴る']
  const back = step === 0 ? undefined : () => setStep((s) => s - 1)

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
    <Sheet title={titles[step]} onClose={onClose} onBack={back}>
      <div className="compose">
        <div className="steps" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={`steps__dot ${
                i === step
                  ? 'steps__dot--active'
                  : i < step
                    ? 'steps__dot--done'
                    : ''
              }`}
            />
          ))}
        </div>

        {/* ===== Step 0: 場所 ===== */}
        {step === 0 && (
          <>
            <p className="compose__lead">
              想いを置きたい場所を
              <br />
              えらんでください
            </p>
            <div className="place-options">
              <button
                className="option-card"
                onClick={useHere}
                disabled={!position}
              >
                <span className="option-card__icon">
                  <LocateIcon />
                </span>
                <span className="option-card__text">
                  <b>いまいる場所に残す</b>
                  <span>
                    {position
                      ? '現在地が、ことづての場所になります'
                      : '現在地がまだ取得できていません'}
                  </span>
                </span>
              </button>
              <button className="option-card" onClick={pickOnMap}>
                <span className="option-card__icon">
                  <PinIcon />
                </span>
                <span className="option-card__text">
                  <b>地図で選ぶ</b>
                  <span>思い出の場所を、地図から指し示す</span>
                </span>
              </button>
            </div>

            {location && (
              <div className="place-chosen" role="status">
                <PinIcon width={26} height={26} />
                <div>
                  <b>この場所に決めました</b>
                  <small>
                    {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                  </small>
                </div>
              </div>
            )}

            <div className="compose__footer">
              <button
                className="btn btn--primary btn--block"
                disabled={!location}
                onClick={() => setStep(1)}
              >
                次へ
              </button>
            </div>
          </>
        )}

        {/* ===== Step 1: 種類 ===== */}
        {step === 1 && (
          <>
            <p className="compose__lead">どんなことづてにしますか</p>
            <div className="kind-grid">
              {KINDS.map(({ kind, label, hint, Icon }) => (
                <button
                  key={kind}
                  className={`kind-card ${
                    mediaKind === kind ? 'kind-card--active' : ''
                  }`}
                  onClick={() => {
                    setMediaKind(kind)
                    if (kind !== mediaKind) setFile(null)
                  }}
                  aria-pressed={mediaKind === kind}
                >
                  <span className="kind-card__icon">
                    <Icon />
                  </span>
                  <b>{label}</b>
                  <span>{hint}</span>
                </button>
              ))}
            </div>
            <div className="compose__footer">
              <button
                className="btn btn--primary btn--block"
                disabled={!mediaKind}
                onClick={() => setStep(2)}
              >
                次へ
              </button>
            </div>
          </>
        )}

        {/* ===== Step 2: 中身 ===== */}
        {step === 2 && mediaKind && (
          <>
            {mediaKind !== 'text' && (
              <MediaUploader
                kind={mediaKind}
                accept={ACCEPT[mediaKind]}
                file={file}
                onPick={setFile}
              />
            )}

            <div className="field">
              <label className="field__label" htmlFor="cz-message">
                {mediaKind === 'text' ? 'ことば' : '添える言葉'}{' '}
                {mediaKind !== 'text' && <small>（任意）</small>}
              </label>
              <textarea
                id="cz-message"
                className="textarea"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  mediaKind === 'text'
                    ? 'ここに、ことづてを綴ってください。\nこの場所を訪れた誰かに、そっと届きます。'
                    : 'ひとこと添えるなら…'
                }
              />
            </div>

            {mediaKind === 'text' && (
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
            )}

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
                disabled={!canSubmit()}
                onClick={submit}
              >
                ここに、ことづてを残す
              </button>
            </div>
          </>
        )}
      </div>
    </Sheet>
  )
}

function MediaUploader({
  kind,
  accept,
  file,
  onPick,
}: {
  kind: MediaKind
  accept: string
  file: File | null
  onPick: (f: File | null) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const url = useObjectUrl(file ?? undefined)

  const labels: Record<string, string> = {
    image: '写真をえらぶ',
    video: '映像をえらぶ',
    audio: '音声をえらぶ',
  }

  if (file && url) {
    return (
      <div className="uploader">
        {kind === 'image' && (
          <div className="preview">
            <button
              className="preview__remove"
              onClick={() => onPick(null)}
              aria-label="選び直す"
            >
              <CloseIcon width={18} height={18} />
            </button>
            <img src={url} alt="選んだ写真のプレビュー" />
          </div>
        )}
        {kind === 'video' && (
          <div className="preview">
            <button
              className="preview__remove"
              onClick={() => onPick(null)}
              aria-label="選び直す"
            >
              <CloseIcon width={18} height={18} />
            </button>
            <video src={url} controls playsInline />
          </div>
        )}
        {kind === 'audio' && (
          <div className="preview preview--audio">
            <AudioIcon
              width={32}
              height={32}
              style={{ color: 'var(--c-amber-deep)' }}
            />
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio src={url} controls />
            <button className="btn btn--ghost" onClick={() => onPick(null)}>
              選び直す
            </button>
          </div>
        )}
      </div>
    )
  }

  const Icon = kind === 'image' ? ImageIcon : kind === 'video' ? VideoIcon : AudioIcon

  return (
    <div className="uploader">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />
      <button className="dropzone" onClick={() => inputRef.current?.click()}>
        <span className="dropzone__icon">
          <Icon />
        </span>
        <b style={{ fontFamily: 'var(--font-serif)', color: 'var(--c-ink)' }}>
          {labels[kind]}
        </b>
        <span style={{ fontSize: '0.82rem' }}>
          端末から選ぶか、その場で撮影できます
        </span>
      </button>
    </div>
  )
}
