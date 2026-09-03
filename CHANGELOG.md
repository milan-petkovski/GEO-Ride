# Changelog

All notable changes to **GEO Ride** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.0.0 (2026-09-03)


### Bug Fixes

* Add esbuild dependency and simplify build config ([0077eea](https://github.com/milan-petkovski/GEO-Ride/commit/0077eeadf46fe9d83730bf5593638ba1c16e28ad))
* Change manualChunks to function to resolve Netlify build error ([757b4f0](https://github.com/milan-petkovski/GEO-Ride/commit/757b4f000afddeca9026f255dfe33fcf769e0478))
* Correct Vite environment variable usage and Netlify publish directory ([bd1d3f4](https://github.com/milan-petkovski/GEO-Ride/commit/bd1d3f409ec0ce737f9e60b28818560fb5b84fe0))
* Ignore R key when Ctrl or Meta is held to allow browser refresh ([3756b8d](https://github.com/milan-petkovski/GEO-Ride/commit/3756b8dbb32dae7f601a6ba399d6af56cca372b3))
* Map MAPBOX_TOKEN to VITE_MAPBOX_TOKEN at build time ([779edee](https://github.com/milan-petkovski/GEO-Ride/commit/779edee6b4223c4905bb17ae0928e99060117609))
* Switch from terser to esbuild for minification ([8ed822c](https://github.com/milan-petkovski/GEO-Ride/commit/8ed822c8f90a4fe41eb71b10bd2b49e55953d858))
* Update esbuild to compatible version (^0.28.0) for Vite 8 ([f0025a5](https://github.com/milan-petkovski/GEO-Ride/commit/f0025a5b73b44103ec26086d5c9553d077363b45))

## [1.0.0] - 2026-08-06

### Added

- Complete JSDoc annotations and file header documentation across all JS modules.
- Explicit EventTarget state subscription pattern in `state.js`.
- Expanded unit test coverage for `state.js`, `utils.js`, `discovery.js`, `config.js`, and `multiplayer.js`.
- E2E automation test suite powered by Playwright (`tests/e2e/driving.spec.js`).
- Client-side message rate limiter & throttling mechanism for multiplayer MQTT synchronization.
- Resource disposal pipeline in `three-manager.js` for Three.js geometry, material, and texture garbage collection.
- Web Worker dedicated physics offloading module (`js/physics.worker.js`).
- Structured JSON-LD metadata, Open Graph tags, Twitter Cards, and WCAG AA accessibility improvements in `index.html`.
- Prettier formatting configuration, strict ESLint rules, and pre-commit hook integration.
- Automated release workflow and bundle size check in GitHub Actions CI.
