import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';

function landingOptimizationPlugin() {
    return {
        name: 'landing-optimization-plugin',
        enforce: 'post',
        transformIndexHtml(html, ctx) {
            const filename = ctx.filename || '';
            const isLanding = filename.endsWith('index.html');
            const isLegal =
                filename.endsWith('privacy.html') ||
                filename.endsWith('terms.html') ||
                filename.endsWith('refund.html') ||
                filename.endsWith('404.html');

            if (!isLanding && !isLegal) return html;

            let out = html;
            if (isLanding) {
                out = out.replace(
                    /<link rel="stylesheet" crossorigin href="(\.\/assets\/main-[^"]+\.css)">/,
                    '<link id="deferred-css" rel="stylesheet" crossorigin href="$1" media="print"><noscript><link rel="stylesheet" crossorigin href="$1"></noscript>'
                );
            }

            return out
                .replace(/<!--[\s\S]*?-->/g, '')
                .replace(/\n\s+/g, '\n')
                .replace(/\n{2,}/g, '\n');
        }
    };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const rootDir = import.meta.dirname || process.cwd();
    return {
        base: './',
        plugins: [landingOptimizationPlugin()],
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
                    main: resolve(rootDir, 'index.html'),
                    play: resolve(rootDir, 'play.html'),
                    privacy: resolve(rootDir, 'privacy.html'),
                    terms: resolve(rootDir, 'terms.html'),
                    refund: resolve(rootDir, 'refund.html'),
                    notFound: resolve(rootDir, '404.html')
                },
                output: {
                    manualChunks(id) {
                        if (id.includes('mapbox-gl')) return 'mapbox-vendor';
                        if (id.includes('three')) return 'three-vendor';
                        if (
                            id.includes('multiplayer.js') ||
                            id.includes('mp-client.js') ||
                            id.includes('mp-interp.js') ||
                            id.includes('mp-protocol.js')
                        ) {
                            return 'mp-engine';
                        }
                        if (id.includes('audio.js') || id.includes('discovery.js')) {
                            return 'services-engine';
                        }
                    }
                }
            }
        },
        envPrefix: ['VITE_', 'MAPBOX_']
    };
});
