import type { CSSProperties } from 'react'

/** groupId → 0〜99 のインデックス */
export function groupColorIndex(groupId: string): number {
  let hash = 0
  for (let i = 0; i < groupId.length; i++) {
    hash = (hash * 31 + groupId.charCodeAt(i)) >>> 0
  }
  return hash % 100
}

/** ピンの bulb に適用するインラインスタイル */
export function groupBulbStyle(
  index: number,
  proximity: 'far' | 'near' | 'unlockable',
): CSSProperties {
  const h = Math.round(index * 3.6)
  if (proximity === 'unlockable') {
    return {
      background: `linear-gradient(160deg, hsl(${h},80%,65%), hsl(${h},75%,50%))`,
      color: `hsl(${h},75%,50%)`,
      boxShadow: [
        '0 5px 8px rgba(0,0,0,0.4)',
        `0 0 0 4px hsla(${h},75%,50%,0.3)`,
        `0 0 22px 4px hsla(${h},75%,50%,0.5)`,
      ].join(', '),
    }
  }
  // far / near: 暗い背景はCSSに任せ、グループ色のリングだけ追加
  return {
    boxShadow: `0 5px 8px rgba(0,0,0,0.4), 0 0 0 3px hsl(${h},70%,55%)`,
  }
}

/** 開封ボタン（seal）に適用するインラインスタイル */
export function groupSealStyle(index: number): CSSProperties {
  const h = Math.round(index * 3.6)
  return {
    background: `radial-gradient(circle at 38% 32%, hsl(${h},80%,65%), hsl(${h},75%,50%) 70%)`,
    boxShadow: [
      `inset 0 3px 10px hsla(${h},80%,90%,0.4)`,
      `inset 0 -6px 14px hsla(${h},80%,20%,0.5)`,
      `0 10px 30px hsla(${h},75%,50%,0.5)`,
    ].join(', '),
  }
}
