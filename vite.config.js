import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: './',
    server: {
      port: 3000,
      open: true
    },
    build: {
      outDir: 'dist',
      minify: 'terser',
      cssMinify: true,
      reportCompressedSize: false,
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('mapbox-gl')) return 'mapbox-vendor';
            if (id.includes('three')) return 'three-vendor';
          }
        }
      }
    },
    envPrefix: ['VITE_', 'MAPBOX_']
  };
});
