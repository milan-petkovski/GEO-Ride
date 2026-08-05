# Contributing to GEO Ride

First off, thank you for considering contributing to **GEO Ride**! Contributions from the community help make this browser 3D simulator even better for everyone.

---

## Code of Conduct

Please help us keep this project open, welcoming, and inclusive. Treat all contributors with respect regardless of background, identity, or experience level.

---

## How Can I Contribute?

### 1. Reporting Bugs

- Search existing issues to ensure the bug hasn't been reported.
- Open a new GitHub issue specifying:
    - Browser name & version
    - Operating system
    - Steps to reproduce
    - Expected vs. actual behavior
    - Console errors (if any)

### 2. Suggesting Features

- Open an issue titled `[Feature Request] ...`
- Describe the feature in detail, explaining why it would be beneficial to GEO Ride players.

### 3. Pull Requests

1. Fork the repository and create your feature branch from `main`:
    ```bash
    git checkout -b feature/my-awesome-feature
    ```
2. Install dependencies:
    ```bash
    npm install
    ```
3. Ensure code formatting and tests pass:
    ```bash
    npm run lint
    npm test
    ```
4. Commit your changes using clean semantic commit messages (`feat: ...`, `fix: ...`, `docs: ...`, `refactor: ...`).
5. Open a Pull Request on GitHub. Netlify will automatically generate a Preview Deployment for testing!

---

## Coding Guidelines

- **File Header Comments**: Include a 1-2 sentence top-of-file comment describing the file's primary responsibility.
- **JSDoc Documentation**: Annotate all exported functions, classes, and complex types with JSDoc `@param`, `@returns`, and `@typedef`.
- **UTF-8 Encoding**: Enforce clean UTF-8 encoding without BOM. Preserve regional characters properly.
- **No Direct State Mutation**: Use the central event store (`state.js`) subscriber methods or explicit setters (`state.set(...)`).
- **No Emoji in Code or Docs**: Use SVG badges or clean standard text instead of inline emoji.

---

## Architecture Principles

- `state.js`: Central reactive state store with event emitter notifications.
- `app.js`: Application orchestrator initializing map, Three.js, controls, audio, and render loop.
- `js/physics.js`: Vehicle handling, acceleration, drifting, and collision response calculations.
- `js/three-manager.js`: 3D rendering, mesh lifecycle, texture management, and resource disposal.
- `js/multiplayer.js`: Sanitized MQTT network syncing with rate-limiting protection.
