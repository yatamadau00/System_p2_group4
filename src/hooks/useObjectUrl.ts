import { useEffect, useState } from 'react'

/**
 * Blob から表示用の object URL を生成し、アンマウント時に解放する。
 * リモート運用に切り替えた場合は `fallbackUrl`（リモートURL）を返す。
 */
export function useObjectUrl(blob?: Blob, fallbackUrl?: string): string | null {
  const [url, setUrl] = useState<string | null>(fallbackUrl ?? null)

  useEffect(() => {
    if (!blob) {
      setUrl(fallbackUrl ?? null)
      return
    }
    const objectUrl = URL.createObjectURL(blob)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [blob, fallbackUrl])

  return url
}
