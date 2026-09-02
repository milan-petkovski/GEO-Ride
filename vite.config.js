import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';

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
                host: env.VITE_HMR_HOST || undefined,
                port: 3000,
                protocol: 'ws'
            },
            cors: {
                origin: '*'
            }
        },
        build: {
            outDir: 'dist',
            minify: 'oxc',
            cssMinify: true,
            reportCompressedSize: false,
            chunkSizeWarningLimit: 2000,
            rollupOptions: {
                input: {
                    main: resolve(import.meta.dirname || process.cwd(), 'index.html'),
                    play: resolve(import.meta.dirname || process.cwd(), 'play.html')
                },
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
