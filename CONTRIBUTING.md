# Contributing to GEO Ride

Thank you for your interest in contributing to **GEO Ride**! This document provides guidelines and best practices to ensure smooth collaboration, high code quality, and optimal performance across our 3D web driving simulator.

---

## Code of Conduct

We are committed to providing a friendly, safe, and welcoming environment for everyone. Please treat all contributors and community members with courtesy and respect.

---

## Architecture Overview

GEO Ride is built with vanilla JavaScript, modern WebGL APIs (Three.js and Mapbox GL JS), and CSS custom properties for glassmorphic cyberpunk aesthetics.

```
geo-ride/
├── app.js                     # Core application orchestrator and main simulation loop
├── style.css                  # HUD, glassmorphism, and responsive simulation styles
├── landing.css                # Landing page styling, responsive layouts, and animations
├── index.html                 # Marketing landing page with interactive showcases & FAQ
├── play.html                  # Main WebGL driving simulation application page
├── js/
│   ├── analytics.js           # Lightweight telemetry and event dispatching
│   ├── audio.js               # Web Audio API engine sound synthesis and effects
│   ├── config.js              # Simulation constants, camera settings, and vehicle specs
│   ├── controls.js            # Input bus (Keyboard, touch joypads, device tilt/gyro)
│   ├── discovery.js           # Reverse-geocoding and location discovery overlays
│   ├── haptics.js             # Mobile vibration API driver feedback
│   ├── landing.js             # Landing page interactions, FAQ accordions, and 3D preview
│   ├── multiplayer.js         # MQTT over WebSockets peer synchronization
│   ├── physics.js             # Vehicle dynamics, raycast collisions, and drifting
│   ├── physics.worker.js      # Off-thread physics execution worker
│   ├── state.js               # Reactive EventTarget state store
│   ├── supabase-georide.js    # Cloud persistence and Pro account validation
│   ├── three-manager.js       # Three.js scene, camera, custom vehicle meshes, and disposal
│   ├── ui.js                  # HUD overlays, vehicle switchers, telemetry, and modals
│   └── utils.js               # Math helpers, interpolation, and unit conversions
├── public/
│   ├── fonts/                 # Self-hosted WOFF2 fonts (Outfit & Rajdhani)
│   ├── images/                # Highly optimized WebP and high-DPI JPEG assets
│   ├── js/
│   │   ├── cookie-consent.js  # GDPR cookie consent banner with dynamic update
│   │   └── gtag-init.js       # Google Consent Mode v2 default configuration
│   ├── manifest.json          # PWA configuration with multi-resolution icons
│   ├── robots.txt             # Web crawler directives
│   ├── sitemap.xml            # Sitemap with Google Image Sitemap specifications
│   └── sw.js                  # Service worker for offline asset caching
└── tests/                     # Unit and integration test suites
```

---

## Getting Started

### Prerequisites

- **Node.js**: `v20.0.0` or higher (tested on Node v22)
- **npm**: `v10.0.0` or higher

### Local Setup

1. **Clone the repository**:

    ```bash
    git clone https://github.com/milan-petkovski/GEO-Ride.git
    cd GEO-Ride
    ```

2. **Install dependencies**:

    ```bash
    npm install
    ```

3. **Configure Environment Variables**:
   Copy the `.env.example` template:

    ```bash
    cp .env.example .env
    ```

    Provide your valid Mapbox Access Token in `.env`.

    > **Security Reminder**: Mapbox public tokens (`pk.*`) are bundled into client code. Ensure you configure **URL Restrictions** in your Mapbox Dashboard (e.g. `https://georide.milanwebportal.com/*`, `http://localhost:*`) to prevent unauthorized usage.

4. **Start Development Server**:
    ```bash
    npm run dev
    ```
    Open `http://localhost:5173` to explore the simulator.

---

## Development & Quality Commands

Always run these verification commands before submitting changes:

| Command            | Purpose                                                   |
| :----------------- | :-------------------------------------------------------- |
| `npm run dev`      | Starts Vite local development server with HMR             |
| `npm run build`    | Builds client production bundle into `dist/`              |
| `npm run preview`  | Previews the production build locally                     |
| `npm test`         | Runs the automated Node.js unit test suite                |
| `npm run test:e2e` | Runs Playwright end-to-end browser driving tests          |
| `npm run lint`     | Runs ESLint across all JavaScript source files            |
| `npm run format`   | Formats all files using Prettier                          |
| `npm run size`     | Validates bundle sizes against strict performance budgets |

---

## Engineering Standards

To preserve the quality, security, and accessibility of GEO Ride, all contributions must adhere to the following rules:

### 1. Character Encoding & Regional Characters

- Enforce clean **UTF-8 encoding without Byte Order Mark (BOM)**.
- Never introduce corrupted mojibake patterns. Carefully preserve regional characters (e.g., Serbian Latin: `č`, `ć`, `š`, `đ`, `ž`).

### 2. No Emojis

- **Do not use emojis** in code, comments, commit messages, or documentation.
- Use custom SVG icons or clean semantic typography.

### 3. Mobile Usability & iOS Auto-Zoom Prevention

- All input fields (`<input type="text">`, `<input type="email">`, `<input type="search">`) on mobile devices (**viewport width <= 1024px**) must maintain `font-size: 16px` (or `1rem`) to prevent iOS Safari from forcefully zooming in on user touch.

### 4. Subresource Integrity (SRI)

- Any script or stylesheet loaded from an external CDN must include an `integrity` attribute (SHA-384 or SHA-256 hash) and `crossorigin="anonymous"`.

### 5. Structured Data (Schema.org / AEO)

- Structured data in JSON-LD must reflect **100% visible text** on the page.
- Never include hidden `FAQPage` schemas or unverified `aggregateRating` blocks on pages where reviews or FAQs are not visually rendered to the user.

### 6. Strict State Management

- Do not mutate global objects directly. Use the reactive `state.js` pattern to update properties and subscribe to state changes via `state.on(event, handler)`.

### 7. Memory & WebGL Resource Management

- Whenever 3D meshes, textures, or materials are dynamically replaced, call the cleanup pipeline in `three-manager.js` to prevent WebGL context memory leaks.

---

## Git Workflow & Conventional Commits

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` A new feature or gameplay enhancement
- `fix:` A bug fix or correction
- `perf:` A code change that improves performance
- `docs:` Documentation-only changes
- `style:` Changes that do not affect the meaning of the code (formatting, white-space)
- `refactor:` A code change that neither fixes a bug nor adds a feature
- `test:` Adding missing tests or correcting existing tests
- `chore:` Maintenance tasks, dependency updates, or build configs

**Example**:

```bash
git checkout -b fix/mobile-input-zoom
git commit -m "fix(ui): enforce 16px font-size on mobile inputs to prevent iOS auto-zoom"
```

---

## Pull Request Checklist

Before opening a pull request, ensure that:

- [ ] `npm test` passes 100% with no failures.
- [ ] `npm run lint` passes with 0 errors and 0 warnings.
- [ ] `npm run size` confirms JS and CSS stay within the performance budget.
- [ ] `npm run build` generates the production bundle without issues.
- [ ] Files are encoded in clean UTF-8 without BOM.
- [ ] No inline emojis have been introduced.
- [ ] Appropriate tests have been added or updated for any new functionality.
- [ ] Relevant documentation or `CHANGELOG.md` notes have been included.
