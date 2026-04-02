# CLAUDE.md — SF2GH Migrator

This file provides guidance for AI assistants (Claude Code, etc.) working in this repository.

## Project Overview

**SF2GH Migrator** is a cross-platform application that automates migrating SourceForge Git and SVN projects to GitHub. It detects the SCM type, creates a GitHub repository, and mirrors all history.

**Deployment targets:** Web app, PWA, Electron desktop (Win/Mac/Linux), Capacitor mobile (iOS/Android).

---

## Repository Layout

```
sf-to-github/
├── src/                    # Backend (Express API server)
│   ├── index.js            # Server entry point, routes, middleware
│   ├── migrate.js          # Migration orchestration
│   ├── detect.js           # Git/SVN detection logic
│   ├── github.js           # GitHub REST API helpers
│   ├── commands.js         # Shell command builders
│   ├── sanitize.js         # Repo name sanitization
│   ├── sfprofile.js        # SourceForge profile/project lookup
│   └── logger.js           # Winston logger setup
├── public/                 # Frontend (Vanilla JS SPA)
│   ├── index.html
│   ├── manifest.json       # PWA manifest
│   ├── sw.js               # Service worker
│   ├── css/style.css
│   └── js/
│       ├── app.js          # Main frontend logic
│       └── mobile-migrate.js  # Mobile (isomorphic-git) logic
├── electron/               # Desktop wrapper
│   ├── main.js             # Electron main process
│   └── preload.js          # Preload (context isolation)
├── tests/                  # Jest test suite
│   ├── server.test.js
│   ├── migrate.test.js
│   ├── detect.test.js
│   ├── github.test.js
│   ├── commands.test.js
│   └── sanitize.test.js
├── .github/workflows/
│   └── release.yml         # Multi-platform CI/CD pipeline
├── capacitor.config.ts     # Mobile configuration
├── electron-builder.yml    # Desktop packaging config
├── jest.config.js
└── .eslintrc.json
```

---

## Development Commands

```bash
# Run the app locally
npm start               # Express server on port 3000
npm run dev             # Same as start

# Testing
npm test                # Run all Jest tests (--detectOpenHandles)
npm run test:coverage   # Generate coverage report in coverage/

# Linting
npm run lint            # ESLint on src/ and tests/

# Desktop (Electron)
npm run electron            # Run Electron in dev mode
npm run electron:build -- --mac    # Build macOS DMG + zip
npm run electron:build -- --win    # Build Windows NSIS + portable
npm run electron:build -- --linux  # Build Linux AppImage + deb + rpm

# Mobile (Capacitor) — requires native toolchains installed
npm run cap:sync        # Sync web assets to native projects

# Release
npm run release         # Tag and push vX.Y.Z release
```

**Prerequisites:** Node.js 18+, Git, `git-svn` (for SVN migrations), a GitHub Personal Access Token.

---

## API Reference

All routes are under `/api`. The server runs on port `3000`.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Health check (status, version, uptime) |
| POST | `/api/detect` | Detect Git vs SVN for a SourceForge URL |
| POST | `/api/sanitize` | Sanitize a repo name to GitHub-compliant format |
| POST | `/api/plan` | Dry-run — returns planned migration steps without executing |
| POST | `/api/migrate` | Execute a single project migration |
| POST | `/api/migrate/batch` | Migrate multiple projects sequentially |

**Typical request body for migrate/plan:**
```json
{
  "url": "https://sourceforge.net/projects/example/",
  "token": "ghp_xxxxxxxxxxxx",
  "owner": "github-username",
  "repoName": "example",
  "isPrivate": false
}
```

---

## Architecture Notes

### Backend (`src/`)

- **`index.js`** wires up Express with Helmet (CSP), CORS, and `express-rate-limit` (100 req / 15 min). It imports and delegates to the other modules.
- **`detect.js`** parses SourceForge URLs and probes both Git and SVN endpoints to determine the SCM type. Returns a `ScmType` enum value (`'git'` or `'svn'`).
- **`migrate.js`** is the main orchestration layer: calls detect → github (create repo) → commands (build steps) → executes shell steps sequentially → cleans up temp files.
- **`commands.js`** returns structured step objects `{ cmd, args, cwd, step, description }`. It does **not** execute anything — it only builds command sequences.
- **`github.js`** wraps the GitHub REST API (fetch-based, no SDK). Handles repo creation, existence checks, authenticated user lookup, and URL construction.
- **`sanitize.js`** enforces GitHub repo name rules: strips invalid characters, replaces spaces, trims dots/hyphens, enforces length limits.
- **`sfprofile.js`** queries the SourceForge Allura API to list a user's projects.
- **`logger.js`** exports a Winston logger with timestamps and stack traces on errors.

### Frontend (`public/js/`)

- **`app.js`** is a vanilla JS SPA — no framework. It handles the token input form, URL parsing, calls to the backend API, and all UI state transitions.
- **`mobile-migrate.js`** uses `isomorphic-git` for on-device migrations (no shell access), invoked only in Capacitor contexts.
- **`sw.js`** caches static assets for offline PWA support.

### Desktop (`electron/`)

- **`main.js`** spawns the Express server as a child process inside the Electron window. The app ID is `com.sf2gh.migrator`.
- **`preload.js`** uses context isolation — no direct Node API exposure to renderer.

---

## Coding Conventions

### Style
- `'use strict';` at the top of every source file.
- Semicolons required.
- 2-space indentation.
- Single quotes for strings.
- camelCase for functions and variables; UPPER_CASE for frozen constants.

### Patterns
- **Async:** Promise-based (`new Promise((resolve, reject) => {...})`), not `async/await` in most modules (maintain consistency with existing style).
- **Command builders** in `commands.js` return plain objects — they never execute shell commands.
- **Error propagation:** throw descriptive `Error` objects; let the API layer catch and return appropriate HTTP status codes (400 / 404 / 500).
- **No external SDKs for GitHub:** use native `fetch` in `github.js`.
- **Security:** never trust user-supplied strings without running through `sanitize.js`; never expose tokens in logs.

### Testing
- Every new function in `src/` (except `src/index.js`) should have corresponding tests in `tests/`.
- Mock external I/O (HTTP, shell execution) with `jest.fn()` / `jest.mock()`.
- Use `supertest` for API endpoint tests against the Express app.
- Coverage is collected for all `src/**/*.js` except `src/index.js`.

### ESLint
- Config: `.eslintrc.json` (ES2022, Node + Jest + Browser environments).
- Key rules: `eqeqeq` (strict equality), no `eval`, warn on unused vars (underscore-prefix exempts).
- Run `npm run lint` before committing.

---

## CI/CD Pipeline

`.github/workflows/release.yml` triggers on `v*.*.*` tags or manual dispatch.

Build jobs (all `continue-on-error: true`):

| Job | Runner | Output |
|-----|--------|--------|
| Windows | windows-latest | `.exe`, `.appx` |
| macOS | macos-latest | `.dmg`, `.zip` |
| Linux | ubuntu-latest | `.AppImage`, `.deb`, `.rpm` |
| Android | ubuntu-latest + Java 21 | `.apk` |
| iOS | macos-latest + Xcode | `.ipa` (unsigned) |
| Web | ubuntu-latest | zipped `public/` + `src/` |

A final **release** job collects all artifacts and creates a GitHub Release.

To trigger a release:
```bash
npm run release   # creates and pushes vX.Y.Z tag based on package.json version
```

---

## Key Constraints and Gotchas

1. **Node 18+ required** — the project uses ES2022 features (`Array.at()`, top-level `const`, etc.) without a transpiler.
2. **`git-svn` must be installed** on the host for SVN migrations to work. Check with `git svn --version`.
3. **GitHub PAT scope:** the token must have `repo` scope (or `public_repo` for public-only migrations).
4. **Rate limiting:** the API enforces 100 requests per 15 minutes per IP. Account for this in tests using supertest (reset between test suites if needed).
5. **Electron isolation:** the preload script uses `contextIsolation: true`. Do not expose Node APIs directly to the renderer.
6. **Capacitor HTTP:** the mobile build uses the native HTTP plugin to bypass WebView CORS. API calls in `mobile-migrate.js` go through `CapacitorHttp`, not the browser `fetch`.
7. **Temporary directories:** `migrate.js` creates temp dirs during migration and cleans them up on both success and failure. Do not leave cleanup only in the success path.
8. **`src/index.js` is excluded from coverage** — it is the server entry point and tested indirectly via `supertest` in `server.test.js`.

---

## Adding New Features

### New API endpoint
1. Add route in `src/index.js`.
2. Implement logic in an appropriately named module under `src/`.
3. Add tests in `tests/<module>.test.js` and `tests/server.test.js`.
4. Update the API table in `README.md` and this file.

### New migration step
1. Add a step builder in `src/commands.js` (return `{ cmd, args, cwd, step, description }`).
2. Wire the step into `src/migrate.js`.
3. Test the builder in `tests/commands.test.js` and the integration in `tests/migrate.test.js`.

### New platform target
1. Configure Capacitor or Electron builder accordingly.
2. Add a build job to `.github/workflows/release.yml`.
3. Document prerequisites in `README.md`.
