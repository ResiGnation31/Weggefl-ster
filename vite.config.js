import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      workbox: { maximumFileSizeToCacheInBytes: 5 * 1024 * 1024 },
      registerType: 'autoUpdate',
      manifest: {
        name: 'Weggeflüsterer',
        short_name: 'Weggeflüsterer',
        description: 'Dein persönlicher Reisebegleiter',
        theme_color: '#B25E00',
        background_color: '#F5EFE6',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
})
