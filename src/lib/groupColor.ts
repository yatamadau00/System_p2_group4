/** グループIDを 0〜5 のパレットインデックスに変換する */
export function groupColorIndex(groupId: string): number {
  let hash = 0
  for (let i = 0; i < groupId.length; i++) {
    hash = (hash * 31 + groupId.charCodeAt(i)) >>> 0
  }
  return hash % 6
}
