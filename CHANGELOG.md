# Changelog

All notable changes to **GEO Ride** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
