import { FALLBACK_CENTER } from '../config'
import type { SeedKotozute } from './repository'

const DAY = 24 * 60 * 60 * 1000
const now = Date.now()

/**
 * 初回体験を空っぽにしないためのサンプルことづて。
 * FALLBACK_CENTER（東京駅周辺）の近くに散らして配置する。
 * テキストのみで構成し、メディアの永続化に依存しないようにしている。
 */
export const SAMPLE_KOTOZUTE: SeedKotozute[] = [
  {
    location: { lat: FALLBACK_CENTER.lat + 0.0004, lng: FALLBACK_CENTER.lng + 0.0006 },
    media: [],
    placeLabel: '丸の内の歩道橋',
    authorName: 'なまえのない人',
    message:
      'ここで、はじめて待ち合わせをした。十分も早く着いて、そわそわしていたのを今でも覚えています。あなたが手を振ってくれた瞬間の光を、ここに残します。',
    createdAt: now - 2 * DAY,
    mine: false,
    isSample: true,
    visibility: 'public',
  },
  {
    location: { lat: FALLBACK_CENTER.lat - 0.0007, lng: FALLBACK_CENTER.lng + 0.0009 },
    media: [],
    placeLabel: '駅の南口',
    authorName: 'とおりすがり',
    message:
      'さよならを言えなかった場所。もし通りかかったら、私のかわりに少しだけ空を見上げてください。それで十分です。',
    link: 'https://www.openstreetmap.org/',
    createdAt: now - 9 * DAY,
    mine: false,
    isSample: true,
    visibility: 'public',
  },
  {
    location: { lat: FALLBACK_CENTER.lat + 0.0011, lng: FALLBACK_CENTER.lng - 0.0005 },
    media: [],
    placeLabel: '小さな珈琲店の前',
    authorName: 'みどり',
    message:
      '毎週水曜、ここで本を読んでいました。閉店してしまったけれど、淹れたての香りと、窓ぎわのあたたかい席は、ずっと忘れません。',
    createdAt: now - 21 * DAY,
    mine: false,
    isSample: true,
    authorId: 'friend-midori',
    visibility: 'public',
  },
  {
    location: { lat: FALLBACK_CENTER.lat - 0.0013, lng: FALLBACK_CENTER.lng - 0.0011 },
    media: [],
    placeLabel: '川沿いのベンチ',
    authorName: 'なまえのない人',
    message:
      '受験の前の夜、ここで深呼吸をして、自分に「だいじょうぶ」と言いました。同じ気持ちの誰かに届きますように。',
    createdAt: now - 40 * DAY,
    mine: false,
    isSample: true,
    visibility: 'public',
  },
  {
    location: { lat: FALLBACK_CENTER.lat + 0.0018, lng: FALLBACK_CENTER.lng + 0.0017 },
    media: [],
    placeLabel: 'いつもの曲がり角',
    authorName: 'はる',
    message:
      'ここを曲がると、もう家。ただいま、と言うとおかえりが返ってきた毎日が、いちばんの宝物でした。',
    createdAt: now - 75 * DAY,
    mine: false,
    isSample: true,
    authorId: 'friend-haru',
    visibility: 'public',
  },
  /* --- 以下、フレンド限定公開のサンプルことづて --- */
  {
    location: { lat: FALLBACK_CENTER.lat + 0.0008, lng: FALLBACK_CENTER.lng - 0.0007 },
    media: [],
    placeLabel: 'みどりの秘密の裏道',
    authorName: 'みどり',
    message:
      '【フレンド限定】ここ、夕方になると木漏れ日がすごく綺麗に差し込むんだよ。人通りも少なくて静かで、私の一番お気に入りの散歩道です。今度一緒に歩こうね。',
    createdAt: now - 1 * DAY,
    mine: false,
    isSample: true,
    authorId: 'friend-midori',
    visibility: 'public',
  },
  {
    location: { lat: FALLBACK_CENTER.lat - 0.0010, lng: FALLBACK_CENTER.lng + 0.0012 },
    media: [],
    placeLabel: '桜の大樹の下',
    authorName: 'はる',
    message:
      '【フレンド限定】春になると、ここは桜でいっぱいになるの。来年またみんなでここに集まって、美味しいお茶でも飲みながらお話ししようね。約束だよ！',
    createdAt: now - 3 * DAY,
    mine: false,
    isSample: true,
    authorId: 'friend-haru',
    visibility: 'public',
  },
  {
    location: { lat: FALLBACK_CENTER.lat + 0.0015, lng: FALLBACK_CENTER.lng - 0.0014 },
    media: [],
    placeLabel: '見晴らしの良い丘',
    authorName: 'そら',
    message:
      '【フレンド限定】ここは風が通り抜けて、街が一番きれいに見えるとっておきの場所なんだ。心がモヤモヤした日は、ここにきて大きく深呼吸してみて。きっと軽くなるよ。',
    createdAt: now - 5 * DAY,
    mine: false,
    isSample: true,
    authorId: 'friend-sora',
    visibility: 'public',
  },
]
