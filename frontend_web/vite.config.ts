// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => {
  const isDev = command === 'serve'

  return {
    base: '/',
    plugins: [react()],

    server: {
      host: 'localhost',
      strictPort: true,   
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
