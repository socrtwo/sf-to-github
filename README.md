# SourceForge → GitHub Migrator

A user-friendly cross-platform app that transfers all your SourceForge projects to new GitHub repositories — automatically detecting SVN or Git repos, formatting the correct GitHub importer URL, and opening imports one by one.

![App screenshot](https://github.com/user-attachments/assets/62ff8509-d197-44de-937c-5d8515aa76d6)

## Features

- 🔍 **Fetch projects** from any SourceForge profile URL or bare username
- ⎇ **Auto-detect** Git vs SVN repositories using the SourceForge REST API
- 🔗 **Format** the correct GitHub importer URL for each project
- 🚀 **One-click** or **Import All** — opens GitHub's importer pre-filled
- 📊 **Progress tracking** — see which projects have been imported
- 🌙 **Dark UI** matching GitHub's design language

## Platforms

| Platform | Method | Command |
|----------|--------|---------|
| **Web** | Vite PWA build | `npm run build` |
| **Windows** | Electron + NSIS installer | `npm run electron:build:win` |
| **macOS** | Electron + DMG | `npm run electron:build:mac` |
| **Linux** | Electron + AppImage/deb/rpm | `npm run electron:build:linux` |
| **Android** | Capacitor | `npm run cap:android` |
| **iOS** | Capacitor | `npm run cap:ios` |

## Getting Started

### Prerequisites

- **Node.js** 18+ and npm
- For Android: Android Studio + JDK 17
- For iOS: macOS with Xcode 14+
- For desktop: no extra tools needed

### Development

```bash
cd app
npm install

# Web dev server
npm run dev

# Desktop (Electron) dev
npm run electron:dev
```

### Building for Production

```bash
cd app

# Web (outputs to app/dist/)
npm run build

# Desktop installers (outputs to app/release/)
npm run electron:build          # current OS
npm run electron:build:win      # Windows
npm run electron:build:mac      # macOS
npm run electron:build:linux    # Linux

# Mobile (requires Android Studio / Xcode)
npm run cap:android             # Open in Android Studio
npm run cap:ios                 # Open in Xcode
```

### Running Tests

```bash
cd app
npm test
```

## How It Works

1. Enter your SourceForge profile URL (e.g. `https://sourceforge.net/u/username/profile/`) or just your username.
2. The app calls the SourceForge REST API (`https://sourceforge.net/rest/u/<username>/`) to list your projects.
3. For each project it queries `https://sourceforge.net/rest/p/<shortname>/` to detect whether the VCS is Git or SVN.
4. The correct clone URL is formatted:
   - **Git:** `https://git.code.sf.net/p/<shortname>/code`
   - **SVN:** `https://svn.code.sf.net/p/<shortname>/code`
5. Clicking **Import to GitHub** opens `https://github.com/new/import?vcs_url=<encoded-url>` in your browser.
6. Sign in to GitHub and follow the importer prompts to complete the migration.

## Project Structure

```
app/
├── electron/          # Electron main process (desktop)
│   └── main.cjs
├── src/
│   ├── components/    # React UI components
│   │   ├── ProfileForm.tsx
│   │   ├── ProjectCard.tsx
│   │   └── ProjectList.tsx
│   ├── hooks/         # Custom React hooks
│   │   └── useProjectImport.ts
│   ├── services/      # SourceForge API + URL logic
│   │   └── sourceforge.ts
│   ├── test/          # Vitest unit tests
│   │   └── sourceforge.test.ts
│   ├── types/         # TypeScript type definitions
│   │   └── index.ts
│   ├── App.tsx
│   ├── App.css
│   └── main.tsx
├── public/
│   └── manifest.json  # PWA manifest
├── build-resources/   # Desktop build icons (add icon.ico, .icns, .png)
├── capacitor.config.ts
├── vite.config.ts
└── package.json
```

## License

[MIT](LICENSE)
