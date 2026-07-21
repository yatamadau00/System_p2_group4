import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 新しいSWを検知したら自動で更新し、次回読み込み時に反映する。
      // 併せて古いキャッシュを自動削除するので「古いまま」を防ぐ。
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png', 'icons/favicon-32.png'],
      manifest: {
        id: '/',
        name: 'ことづて',
        short_name: 'ことづて',
        description:
          'ことづて — 場所に想いを残し、訪れた人が受け取る、非同期の位置連動メッセージ。',
        lang: 'ja',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#1E2530',
        background_color: '#1E2530',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // 生成される sw.js に Web Push ハンドラ（public/push-sw.js）を読み込ませる。
        importScripts: ['/push-sw.js'],
        // ビルド生成物（アプリシェル）をプリキャッシュする。
        globPatterns: ['**/*.{js,css,html,png,svg,woff,woff2}'],
        // デプロイ更新時に古いプリキャッシュを掃除する。
        cleanupOutdatedCaches: true,
        // 新SWを即時有効化し、開いているページにも適用する。
        clientsClaim: true,
        skipWaiting: true,
        // SPAのため、ナビゲーションは index.html にフォールバック。
        navigateFallback: 'index.html',
        // Supabase / Google Maps などのAPI・地図タイルはキャッシュしない
        // （古いデータを掴まないよう、常にネットワークへ）。
        navigateFallbackDenylist: [/^\/rest\//, /^\/auth\//, /^\/storage\//],
      },
      // 開発時はSWを無効化しておく（デバッグ時の混乱を避ける）。
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    host: true,
    // トンネル（localtunnel / cloudflare 等）経由のアクセスを許可
    allowedHosts: true,
  },
})
