# SF2GH Migrator

<!--PAGES_LINK_BANNER-->
> 🌐 **Live page:** [https://socrtwo.github.io/sf-to-github/](https://socrtwo.github.io/sf-to-github/)  
> 📦 **Releases:** [github.com/socrtwo/sf-to-github/releases](https://github.com/socrtwo/sf-to-github/releases)
<!--/PAGES_LINK_BANNER-->

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Web%20%7C%20Desktop%20%7C%20Mobile-blue)]()
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)]()

A cross-platform application that migrates SourceForge Git and SVN projects to
GitHub. It provides a modern web UI, installable PWA, Electron desktop builds,
and Capacitor mobile builds so you can run migrations from any device.

---

## Features

- **Auto-detects Git vs SVN** repositories from SourceForge URLs
- **Creates GitHub repos** via the GitHub REST API
- **Git migration** via `git clone --mirror` + `git push --mirror`
- **SVN migration** via `git svn clone` with branch/tag conversion
- **Batch migration** of multiple repositories in one request
- **Dry-run preview mode** — plan a migration without executing it
- **Modern dark-theme web UI** served from Express
- **PWA support** — installable on mobile and desktop browsers
- **Desktop builds** via Electron (Windows, macOS, Linux)
- **Mobile builds** via Capacitor (iOS, Android)
- **Rate limiting and security headers** (Helmet + express-rate-limit)
- **Comprehensive test suite** powered by Jest and Supertest

---

## Prerequisites

| Requirement | Purpose |
|---|---|
| **Node.js 18+** | Runtime for the server and build tooling |
| **Git** | Required for all migrations |
| **git-svn** | Required only for SVN repository migrations |
| **GitHub Personal Access Token** | Authenticates with the GitHub API to create repos and push code |

> **Tip:** Generate a GitHub PAT at <https://github.com/settings/tokens> with
> the **repo** scope.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start

# 3. Open the UI
open http://localhost:3000
```

The Express server starts on port **3000** by default. Set the `PORT`
environment variable to change it:

```bash
PORT=8080 npm start
```

---

## API Reference

All endpoints are prefixed with `/api`. Request and response bodies use JSON.

### `GET /api/health`

Returns server health information.

**Response**

```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptime": 42.5
}
```

### `POST /api/detect`

Detects whether a SourceForge project uses Git or SVN.

**Request body**

```json
{
  "url": "https://sourceforge.net/projects/example/"
}
```

**Response**

```json
{
  "scmType": "git"
}
```

### `POST /api/sanitize`

Sanitizes a repository name to be GitHub-compliant.

**Request body**

```json
{
  "name": "My Project!!"
}
```

**Response**

```json
{
  "sanitized": "my-project"
}
```

### `POST /api/plan`

Performs a dry-run migration and returns the planned steps without executing
them.

**Request body**

```json
{
  "sourceUrl": "https://sourceforge.net/projects/example/",
  "githubOwner": "your-username",
  "githubRepo": "example",
  "githubToken": "ghp_xxxxxxxxxxxx"
}
```

**Response**

```json
{
  "steps": [
    "Detect SCM type for https://sourceforge.net/projects/example/",
    "Create GitHub repository your-username/example",
    "Clone mirror from SourceForge",
    "Push mirror to GitHub"
  ]
}
```

### `POST /api/migrate`

Executes a single project migration from SourceForge to GitHub.

**Request body**

```json
{
  "sourceUrl": "https://sourceforge.net/projects/example/",
  "githubOwner": "your-username",
  "githubRepo": "example",
  "githubToken": "ghp_xxxxxxxxxxxx"
}
```

**Response**

```json
{
  "success": true,
  "message": "Migration complete"
}
```

### `POST /api/migrate/batch`

Migrates multiple SourceForge projects in a single request.

**Request body**

```json
{
  "projects": [
    {
      "sourceUrl": "https://sourceforge.net/projects/project-a/",
      "githubRepo": "project-a"
    },
    {
      "sourceUrl": "https://sourceforge.net/projects/project-b/",
      "githubRepo": "project-b"
    }
  ],
  "githubOwner": "your-username",
  "githubToken": "ghp_xxxxxxxxxxxx"
}
```

**Response**

```json
{
  "results": [
    { "repo": "project-a", "success": true },
    { "repo": "project-b", "success": true }
  ]
}
```

---

## Building for Desktop

Desktop builds use [Electron](https://www.electronjs.org/) and
[electron-builder](https://www.electron.build/).

### Run in development

```bash
npm run electron
```

### Build installers

```bash
# macOS — produces DMG and ZIP
npm run electron:build -- --mac

# Windows — produces NSIS installer and portable executable
npm run electron:build -- --win

# Linux — produces AppImage, DEB, and RPM
npm run electron:build -- --linux
```

Build artifacts are written to the `dist/` directory.

---

## Building for Mobile

Mobile builds use [Capacitor](https://capacitorjs.com/).

### Initial setup

```bash
# Initialize Capacitor (already configured in this repo)
npm run cap:init

# Add platforms
npm run cap:add:android
npm run cap:add:ios
```

### Sync and build

```bash
# Sync web assets to native projects
npm run cap:sync

# Open in Android Studio
npx cap open android

# Open in Xcode
npx cap open ios
```

> **Note:** Building for iOS requires macOS with Xcode installed. Building for
> Android requires Android Studio.

---

## PWA Installation

The app ships with a web manifest and service worker, so it can be installed as
a Progressive Web App from any modern browser.

1. Open `http://localhost:3000` in Chrome, Edge, or Safari.
2. Click the **Install** icon in the address bar (or use the browser menu).
3. The app launches in its own window and works offline for cached resources.

The PWA configuration lives in:

- `public/manifest.json` — app name, icons, theme colour
- `public/sw.js` — service worker for offline caching

---

## Testing

The project uses [Jest](https://jestjs.io/) with
[Supertest](https://github.com/ladjs/supertest) for HTTP assertions.

```bash
# Run all tests
npm test

# Run tests with coverage report
npm run test:coverage
```

Coverage is collected from all source files in `src/` (excluding `src/index.js`)
and written to the `coverage/` directory.

### Test suite overview

| File | Covers |
|---|---|
| `tests/server.test.js` | API endpoint integration tests |
| `tests/migrate.test.js` | Migration planning and execution logic |
| `tests/detect.test.js` | SCM type detection from SourceForge URLs |
| `tests/github.test.js` | GitHub API helper functions |
| `tests/commands.test.js` | Git and SVN command generation |
| `tests/sanitize.test.js` | Repository name sanitization rules |

---

## Architecture

```
sf2gh-migrator/
├── src/
│   ├── index.js          # Express server and API routes
│   ├── migrate.js         # Migration orchestration
│   ├── detect.js          # Git/SVN detection logic
│   ├── sanitize.js        # GitHub-safe name sanitization
│   ├── github.js          # GitHub REST API helpers
│   ├── commands.js        # Shell command builders
│   └── logger.js          # Winston logging configuration
├── public/
│   ├── index.html         # Single-page application shell
│   ├── manifest.json      # PWA manifest
│   ├── sw.js              # Service worker
│   ├── css/style.css      # Dark-theme stylesheet
│   ├── js/app.js          # Frontend application logic
│   └── icons/             # App icons (SVG, 192px, 512px)
├── electron/
│   ├── main.js            # Electron main process
│   └── preload.js         # Preload script (context isolation)
├── tests/                 # Jest test suite
├── capacitor.config.ts    # Capacitor mobile configuration
├── electron-builder.yml   # Electron packaging configuration
├── jest.config.js         # Jest configuration
└── package.json
```

The backend is a standard Express application. The frontend is a lightweight
SPA served as static files from `public/`. Electron wraps the Express server in
a desktop window, and Capacitor packages the `public/` directory into native
mobile shells.

---

## License

This project is licensed under the [MIT License](LICENSE).

Copyright © 2026 Paul D Pruitt