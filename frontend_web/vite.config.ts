// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => {
  const isDev = command === 'serve'

  return {
    base: isDev ? '/' : '/static/',

    plugins: [react()],

    server: {
      host: 'localhost',
      strictPort: true,   // if you ask for 5174 and it’s busy, it will error
      // ← remove `port: 5173` entirely
    },

    build: {
      outDir: 'dist',
      sourcemap: isDev,
      rollupOptions: {
        output: {
          assetFileNames: 'assets/[name].[hash][extname]',
          chunkFileNames:  'js/[name].[hash].js',
          entryFileNames:  'js/[name].[hash].js',
        },
      },
    },
  }
})
