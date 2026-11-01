import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Écrit dist/version.json à chaque compilation (pour l'alerte « nouvelle version »)
const version = {
  name: 'version',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'version.json',
      source: JSON.stringify({
        v: process.env.GITHUB_SHA || 'dev',
        app: Number(process.env.GITHUB_RUN_NUMBER || 0),
      }),
    })
  },
}

export default defineConfig({
  plugins: [react(), version],
  base: './',
})
