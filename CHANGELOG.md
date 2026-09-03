# Changelog

All notable changes to **GEO Ride** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-09-03

### Added

- **GDPR & Google Consent Mode v2**: Default `analytics_storage: 'denied'` in `gtag-init.js`, coupled with a lightweight, non-intrusive glassmorphic cookie consent banner (`js/cookie-consent.js`) providing explicit Accept/Decline actions and dynamic consent propagation.
- **Subresource Integrity (SRI)**: SHA-384 cryptographic integrity hashes and `crossorigin="anonymous"` attributes for all external CDN dependencies (Mapbox GL JS, Mapbox CSS, Three.js, and Paho MQTT).
- **Google Image Sitemap**: Enhanced `public/sitemap.xml` with the `xmlns:image` schema extension, indexing all map styles and screenshot assets with descriptive titles and captions.
- **Complete PWA Icon Suite**: Generated high-resolution icons including `apple-touch-icon.png` (180x180), `favicon-192.png` (192x192), `favicon-512.png` (512x512), `favicon-32.png`, and a multi-resolution `favicon.ico`.
- **Orientation UX Notice**: Non-intrusive, dismissible portrait guidance banner on mobile in `play.html` with custom SVG iconography prompting landscape orientation without forced viewport locks.
- **Mapbox Token Security Guidance**: Detailed domain URL restriction instructions added to `.env.example` to protect public access tokens.

### Changed

- **Technical SEO Head Structure**: Placed `<meta charset="UTF-8" />` as the first tag in `<head>` (within the initial 1024 bytes) across all pages.
- **Search Metadata Optimization**: Calibrated title tag length (47 characters) and meta description lengths (138 characters) to strictly adhere to Google search snippet limits without truncation.
- **AEO & Schema.org Structured Data**: Unified duplicate JSON-LD blocks on `play.html` into a single authoritative `WebApplication` entity; aligned FAQPage schema text 1:1 verbatim with visible DOM accordion text; updated testimonial dates to 2026.
- **Mobile Input Usability**: Enforced `font-size: 16px` on all mobile input elements (`#location-search`, `#mobile-location-search`, `#join-peer-id`, `#mobile-join-peer-id`, `#pro-key-input`) to eliminate unwanted iOS Safari auto-zooming.
- **PWA Manifest Orientation**: Updated `orientation` from hardlocked `"landscape"` to `"any"` in `public/manifest.json`.
- **Cache-Control Headers**: Configured optimal long-term immutable caching (`public, max-age=31536000, immutable`) for images, fonts, and assets in `netlify.toml`, with `must-revalidate` on HTML and service worker.
- **Showcase Image Optimization**: Resized map preview images (`2d-streets`, `3d-buildings`, `hybrid`, `satellite`) from 1919x1079 down to high-DPI 800x450 in both optimized JPEG and WebP formats, reducing image payload by over 80%.

### Removed

- **Legacy Keywords Meta Tag**: Removed deprecated `<meta name="keywords">` from `index.html` and `play.html`.
- **Conflicting Geographic Coordinates**: Removed local Belgrade GPS coordinates (`geo.position`, `ICBM`) and improper `"Global"` region tags from global driving simulator metadata.
- **Unverified AggregateRating Schema**: Removed unearned `aggregateRating` (4.9 / 1250 reviews) and hidden `FAQPage` schema from `play.html` to eliminate risk of Google search manual actions.
- **Unsafe CSP Directive**: Removed `'unsafe-eval'` from the Content-Security-Policy `script-src` directive in `netlify.toml`.
- **Dead Asset Files**: Cleaned up unreferenced legacy images `2D Building.jpg` and `3D Building.jpg` from `public/images/`.
- **Unused Variables**: Cleaned up unused `heroSection` reference in `js/landing.js`, achieving 0 ESLint warnings.

---

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
