export default defineConfig({
  build: {
    chunkSizeWarningLimit: 1000,
    minify: 'esbuild', // 🔥 أهم تعديل
    reportCompressedSize: true,
  },
  plugins: [
    react({
      jsxRuntime: 'automatic',
      jsxImportSource: 'react'
    })
  ]
})
