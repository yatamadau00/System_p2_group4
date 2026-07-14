/**
 * 画像ファイルを、中央を正方形に切り抜いて縮小した data URL に変換する。
 * グループやアイコン用の写真をそのまま（Storage不要で）DBのtext列に保存するために使う。
 */
export function imageFileToSquareDataUrl(
  file: File,
  size = 256,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('画像ファイルを選択してください'))
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      reject(new Error('画像は5MB以下にしてください'))
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('画像の読み込みに失敗しました'))
        return
      }
      const image = new Image()
      image.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('画像を変換できませんでした'))
          return
        }
        // 中央を正方形にトリミング（object-fit: cover 相当）
        const side = Math.min(image.width, image.height)
        const sx = (image.width - side) / 2
        const sy = (image.height - side) / 2
        ctx.drawImage(image, sx, sy, side, side, 0, 0, size, size)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      image.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
      image.src = reader.result
    }
    reader.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
    reader.readAsDataURL(file)
  })
}
