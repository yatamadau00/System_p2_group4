import { useEffect } from 'react'
import { useObjectUrl } from '../hooks/useObjectUrl'
import { useAudioRecorder } from '../hooks/useAudioRecorder'
import { AudioIcon } from './icons'

interface AudioRecorderProps {
  /** 録音を確定して添付する */
  onConfirm: (blob: Blob, mimeType: string) => void
  onCancel: () => void
}

const fmt = (s: number) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

/** その場で声を録るインラインUI（マイク事前確保→録音→プレビュー→添付）。 */
export function AudioRecorder({ onConfirm, onCancel }: AudioRecorderProps) {
  const rec = useAudioRecorder()
  const url = useObjectUrl(rec.blob ?? undefined)

  // パネルを開いた時点でマイクを温めておく（押した瞬間に録音が始まるように）
  useEffect(() => {
    rec.prime()
    // prime はマウント時に一度だけ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!rec.supported || rec.status === 'unsupported') {
    return (
      <div className="recorder">
        <p className="recorder__note">
          この端末では録音に対応していません。下の「ファイルから選ぶ」をお使いください。
        </p>
        <button className="btn btn--ghost" onClick={onCancel}>
          とじる
        </button>
      </div>
    )
  }

  if (rec.status === 'denied') {
    return (
      <div className="recorder">
        <p className="recorder__note">
          マイクの利用が許可されませんでした。ブラウザの設定をご確認ください。
        </p>
        <div className="recorder__actions">
          <button className="btn btn--soft" onClick={onCancel}>
            とじる
          </button>
          <button className="btn btn--primary" onClick={rec.prime}>
            もう一度
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="recorder">
      {rec.status === 'preparing' && (
        <>
          <div className="recorder__mic recorder__mic--prep" aria-hidden>
            <span className="spinner" />
          </div>
          <p className="recorder__note">マイクを準備しています…</p>
          <button className="btn btn--ghost" onClick={onCancel}>
            やめる
          </button>
        </>
      )}

      {(rec.status === 'idle' || rec.status === 'ready') && (
        <>
          <button
            className="recorder__mic"
            onClick={rec.start}
            aria-label="録音をはじめる"
          >
            <AudioIcon width={30} height={30} />
          </button>
          <p className="recorder__note">
            {rec.status === 'ready' ? (
              <>
                <span className="recorder__readydot" /> 準備OK・タップですぐ録音
              </>
            ) : (
              'タップして、声を録りはじめます'
            )}
          </p>
          <button className="btn btn--ghost" onClick={onCancel}>
            やめる
          </button>
        </>
      )}

      {rec.status === 'recording' && (
        <>
          <button
            className="recorder__mic recorder__mic--rec"
            onClick={rec.stop}
            aria-label="録音をとめる"
          >
            <span className="recorder__stopsquare" />
          </button>
          <p className="recorder__timer" aria-live="polite">
            <span className="recorder__reddot" /> 録音中 {fmt(rec.seconds)}
          </p>
          <p className="recorder__note">タップで停止します</p>
        </>
      )}

      {rec.status === 'recorded' && url && (
        <>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio src={url} controls className="recorder__audio" />
          <div className="recorder__actions">
            <button className="btn btn--soft" onClick={rec.reset}>
              録り直す
            </button>
            <button
              className="btn btn--primary"
              onClick={() =>
                rec.blob && onConfirm(rec.blob, rec.mimeType ?? 'audio/webm')
              }
            >
              この声を添える
            </button>
          </div>
        </>
      )}
    </div>
  )
}
