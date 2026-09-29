import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // percorsi relativi: la build funziona anche in una sottocartella (es. MAMP /mtghand/dist)
  base: './',
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
  },
})
