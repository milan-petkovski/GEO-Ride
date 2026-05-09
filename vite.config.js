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
      minify: true,
      chunkSizeWarningLimit: 1600,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              return 'vendor';
            }
          }
        }
      }
    },
    define: {
       'import.meta.env.VITE_MAPBOX_TOKEN': JSON.stringify(process.env.MAPBOX_TOKEN || process.env.VITE_MAPBOX_TOKEN)
    }
  };
});
