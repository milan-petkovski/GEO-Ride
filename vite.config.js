import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: './',
    server: {
      port: 3000,
      open: true,
      host: '0.0.0.0',
      strictPort: false,
      hmr: {
        host: '192.168.0.50',
        port: 3000,
        protocol: 'ws'
      },
      cors: {
        origin: '*',
        credentials: true
      }
    },
    build: {
      outDir: 'dist',
      minify: 'oxc',
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
