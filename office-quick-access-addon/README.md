# Office Quick Access Toolbar Add-in

An Office Web Add-in for **Word**, **Excel**, and **PowerPoint** that puts common Quick Access Toolbar (QAT) commands into organized ribbon dropdown menus — plus a side panel with every command as a button.

## What it does

Instead of customizing the QAT manually in each app, this add-in adds a **"Quick Access"** ribbon tab with dropdown menus for:

| Menu | Commands |
|------|----------|
| **File** | Save, Print |
| **Edit** | Undo*, Redo*, Select All |
| **Text Format** | Bold, Italic, Underline, Strikethrough, Superscript, Subscript |
| **Font Size** | 8, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48, 72 pt |
| **Font Color** | Black, Red, Blue, Green, Orange, Purple |
| **Alignment** | Left, Center, Right, Justify |
| **Highlight** | Yellow highlight, Remove highlight |
| **Insert** | Table (3×3), Page Break, Horizontal Line |
| **Panel** | Opens the full task-pane UI with all commands |

*\* Undo/Redo have no Office.js API — the add-in shows a keyboard shortcut reminder instead.*

## Platform support

| Platform | Ribbon dropdowns | Task pane | Notes |
|----------|:---:|:---:|-------|
| **Windows desktop** | Yes | Yes | Full support |
| **Mac desktop** | Yes | Yes | Full support |
| **Office on the Web** | Yes | Yes | Full support |
| **iOS / Android** | No | Limited | Mobile Office doesn't show custom ribbon UI; add-ins are accessed through a menu. Formatting commands may not work on PowerPoint mobile. |

## Why no iOS/Android add-in?

Office mobile apps don't support custom ribbon commands. The mobile add-in experience is limited to a taskpane opened from a menu, and the formatting APIs for PowerPoint are very limited on mobile. It wouldn't replicate the "Quick Access Toolbar" experience, so we focused on desktop and web where the full ribbon works.

## Quick start

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or later
- A Microsoft 365 subscription (for desktop) or a free account (for Office on the Web)

### 1. Install dependencies

```bash
cd office-quick-access-addon
npm install
```

### 2. Start the dev server

```bash
npm start
```

This starts a local HTTPS server at `https://localhost:3000`.

### 3. Sideload the add-in

#### Option A: Desktop (Windows/Mac)

```bash
# For Word:
npm run sideload:word

# For Excel:
npm run sideload:excel

# For PowerPoint:
npm run sideload:powerpoint
```

#### Option B: Office on the Web

1. Open Word, Excel, or PowerPoint at [office.com](https://www.office.com)
2. Go to **Insert** → **Office Add-ins** → **Upload My Add-in**
3. Upload the corresponding manifest file from the `manifests/` folder:
   - `word-manifest.xml` for Word
   - `excel-manifest.xml` for Excel
   - `powerpoint-manifest.xml` for PowerPoint

#### Option C: Manual sideload on Windows

1. Open a file share at `\\localhost\c$\Users\<you>\AppData\Local\Microsoft\Office\16.0\Wef\`
2. Copy the desired manifest XML into that folder
3. Open the Office app, go to **Insert** → **My Add-ins** → **Shared Folder**

### 4. Use the add-in

After sideloading, you'll see a new **"Quick Access"** tab in the ribbon. Click any dropdown to access commands. Click **"Open Panel"** for the full side-panel view.

## Project structure

```
office-quick-access-addon/
├── manifests/
│   ├── word-manifest.xml       # Word ribbon + commands
│   ├── excel-manifest.xml      # Excel ribbon + commands
│   └── powerpoint-manifest.xml # PowerPoint ribbon + commands
├── src/
│   ├── assets/                 # Icons (16, 32, 64, 80, 128 px)
│   ├── commands/
│   │   ├── commands.js         # Ribbon command functions (ExecuteFunction)
│   │   └── commands.html       # Host page for command functions
│   └── taskpane/
│       ├── taskpane.html       # Side-panel UI
│       ├── taskpane.css        # Styles
│       └── taskpane.js         # Panel button handlers
├── webpack.config.js           # Build configuration
├── package.json
└── README.md
```

## Limitations

Some native Office commands cannot be triggered from add-ins because the Office.js API doesn't expose them:

| Command | Status | Workaround |
|---------|--------|------------|
| Undo | Not available | Shows Ctrl+Z / Cmd+Z reminder |
| Redo | Not available | Shows Ctrl+Y / Cmd+Shift+Z reminder |
| Print | Not available | Shows Ctrl+P / Cmd+P reminder |
| Open / New | Not available | Use File menu |
| Copy / Paste | Not available in document | Use Ctrl+C / Ctrl+V |
| Spell Check | Not available | Use Review tab or F7 |
| Track Changes | Not available | Use Review tab |

## Deploying to production

1. Build the project: `npm run build`
2. Host the `dist/` folder on an HTTPS web server
3. Update all three manifest files: replace `https://localhost:3000` with your production URL
4. Distribute manifests via:
   - **Microsoft 365 Admin Center** (organization-wide deployment)
   - **AppSource** (public marketplace)
   - **SharePoint App Catalog** (SharePoint-based orgs)

## License

MIT
