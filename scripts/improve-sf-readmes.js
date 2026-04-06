#!/usr/bin/env node
'use strict';

/**
 * Improve README.md files for ALL 24 SF-migrated GitHub repos.
 * Adds: screenshots, install/build instructions, system requirements.
 *
 * Usage: cd ~/sf-to-github
 *        GITHUB_TOKEN=ghp_YOUR_TOKEN node scripts/improve-sf-readmes.js
 *
 * Token needs "repo" scope.
 */

const https = require('https');
const OWNER = process.env.GITHUB_OWNER || 'socrtwo';
const TOKEN = process.env.GITHUB_TOKEN;

if (!TOKEN) {
  console.error('Set GITHUB_TOKEN environment variable.');
  process.exit(1);
}

// ─── Build/install instructions by language type ────────────────────────

const BUILD_INSTRUCTIONS = {
  'vbnet': {
    requirements: [
      'Windows 7 or later',
      'Visual Studio 2010+ (Community edition works)',
      '.NET Framework 4.0 or later',
    ],
    install: `### Building from Source

1. Open the \`.sln\` file in Visual Studio
2. Restore NuGet packages if prompted
3. Build the solution (**Build → Build Solution** or \`Ctrl+Shift+B\`)
4. Find the compiled \`.exe\` in \`bin/Release/\`

### Using a Pre-built Release

Download the latest release from the [Releases](../../releases) page and run the \`.exe\` directly — no install needed.`,
  },

  'delphi': {
    requirements: [
      'Windows XP or later',
      'Delphi 7 (for original build) or Free Pascal / Lazarus (free alternative)',
    ],
    install: `### Building from Source (Delphi 7)

1. Open the \`.dpr\` project file in Delphi 7
2. Press **F9** to compile and run

### Building with Free Pascal (free alternative)

\`\`\`bash
sudo apt-get install fpc    # Linux
# or download from https://www.freepascal.org/
fpc -Sd src/*.pas
\`\`\`

### Using a Pre-built Release

Download the latest release from the [Releases](../../releases) page.`,
  },

  'perl': {
    requirements: [
      'Perl 5.10 or later',
      'Linux, macOS, or Windows (with Strawberry Perl or WSL)',
    ],
    install: `### Running

\`\`\`bash
# Install Perl (if not already installed)
# Linux/macOS: usually pre-installed
# Windows: download Strawberry Perl from https://strawberryperl.com/

# Run the script
perl <script_name>.pl [arguments]
\`\`\`

### Dependencies

If the script uses CPAN modules, install them with:
\`\`\`bash
cpan install Module::Name
\`\`\``,
  },

  'php': {
    requirements: [
      'PHP 7.0 or later',
      'A web server (Apache, Nginx, or PHP built-in server)',
      'MySQL/MariaDB (if the project uses a database)',
    ],
    install: `### Running Locally

\`\`\`bash
# Quick start with PHP built-in server
php -S localhost:8000

# Then open http://localhost:8000 in your browser
\`\`\`

### Full Setup (Apache/Nginx)

1. Copy files to your web root (e.g. \`/var/www/html/\`)
2. If a database is needed, import the \`.sql\` file into MySQL
3. Copy \`config.example.php\` to \`config.php\` and fill in your settings
4. Open the site in your browser`,
  },

  'ahk': {
    requirements: [
      'Windows XP or later',
      'AutoHotkey v1.1+ (free from [autohotkey.com](https://www.autohotkey.com/))',
    ],
    install: `### Running

1. Install [AutoHotkey](https://www.autohotkey.com/) (free)
2. Double-click the \`.ahk\` file to run it
3. Look for the green **H** icon in your system tray

### Compiling to .exe

1. Right-click the \`.ahk\` file
2. Select **Compile Script**
3. The \`.exe\` can run on any Windows PC without AutoHotkey installed`,
  },

  'autoit': {
    requirements: [
      'Windows XP or later',
      'AutoIt v3 (free from [autoitscript.com](https://www.autoitscript.com/))',
    ],
    install: `### Running

1. Install [AutoIt](https://www.autoitscript.com/) (free)
2. Double-click the \`.au3\` file to run it

### Compiling to .exe

1. Right-click the \`.au3\` file
2. Select **Compile Script**
3. The \`.exe\` can run on any Windows PC without AutoIt installed`,
  },

  'html': {
    requirements: [
      'Any modern web browser (Chrome, Firefox, Edge, Safari)',
    ],
    install: `### Running

Just open the \`.html\` file in your web browser — no server needed.

For PHP-enhanced pages:
\`\`\`bash
php -S localhost:8000
# Open http://localhost:8000 in your browser
\`\`\``,
  },

  'gedcom': {
    requirements: [
      'Any GEDCOM-compatible genealogy software',
    ],
    install: `### Using the Data

1. Download the \`.ged\` file(s) from this repository
2. Open in any genealogy program:
   - [Gramps](https://gramps-project.org/) (free, cross-platform)
   - [RootsMagic](https://www.rootsmagic.com/) (Windows/Mac)
   - [Ancestry.com](https://www.ancestry.com/) (upload online)
   - [FamilySearch](https://www.familysearch.org/) (free, online)
3. Browse the family trees, search for individuals, or merge with your own data`,
  },

  'vba': {
    requirements: [
      'Microsoft Office 2007 or later (Excel with macros enabled)',
      'Windows 7 or later',
    ],
    install: `### Running

1. Open the \`.xlsm\` or \`.xls\` file in Microsoft Excel
2. Click **Enable Macros** when prompted
3. Use the buttons or menus provided in the spreadsheet

### Viewing/Editing VBA Code

Press \`Alt+F11\` in Excel to open the VBA Editor.`,
  },

  'access': {
    requirements: [
      'Microsoft Access 2007 or later',
      'Windows 7 or later',
    ],
    install: `### Running

1. Open the \`.mdb\` or \`.accdb\` file in Microsoft Access
2. Enable macros/content when prompted
3. Use the forms and reports provided

### Without Microsoft Access

You can view the database tables using the free [MDB Viewer Plus](https://www.alexnolan.net/software/mdbplus.htm).`,
  },
};

// ─── All 24 repos ──────────────────────────────────────────────────────

const REPOS = [
  {
    repo: 'autoscrshotanno-SF',
    name: 'Automatic Screenshot Annotator',
    sfProject: 'autoscrshotanno',
    lang: 'AutoIt',
    type: 'autoit',
    desc: 'Automatically annotates tutorial screenshots using internal window and button names. Generates annotated screenshots with natural language text overlays — great for creating documentation and tutorials without manual labeling.',
    features: [
      'Captures screenshots of any running Windows application',
      'Identifies UI elements (buttons, menus, text fields) by their internal names',
      'Generates natural language annotations describing each element',
      'Exports annotated screenshots as image files',
      'Useful for creating documentation and tutorials automatically',
    ],
    hasScreenshots: true,
  },
  {
    repo: 'catalog-of-life-SF',
    name: 'Catalogue of Life Converter',
    sfProject: 'catalog-of-life',
    lang: 'MS Access / VBA',
    type: 'access',
    desc: 'Converts the Catalogue of Life database (1.2 million species) into GEDCOM genealogy format, producing over 2 million records. Explores hybridization-driven speciation patterns using a tree-of-life structure.',
    features: [
      'Converts Catalogue of Life species database to GEDCOM format',
      'Handles 1.2 million+ species records',
      'Outputs 2 million+ genealogy-style records',
      'MS Access database with VBA automation',
      'Explores hybridization-driven speciation patterns',
    ],
    hasScreenshots: false,
  },
  {
    repo: 'coffice2txt-SF',
    name: 'Corrupt Office File Salvager',
    sfProject: 'coffice2txt',
    lang: 'Perl',
    type: 'perl',
    desc: 'Extracts readable text from corrupt Microsoft Office files (DOC, XLS, PPT) when the application itself cannot open them. Uses low-level binary parsing to salvage whatever text remains.',
    features: [
      'Extracts text from corrupt DOC, XLS, and PPT files',
      'Low-level binary parsing bypasses Office file format errors',
      'Works when Microsoft Office refuses to open the file',
      'Command-line interface for batch processing',
      'Outputs plain text for easy recovery',
    ],
    hasScreenshots: false,
  },
  {
    repo: 'corruptexcelrec-SF',
    name: 'S2 Recovery Tools for Microsoft Excel',
    sfProject: 'corruptexcelrec',
    lang: 'VB.NET / C#',
    type: 'vbnet',
    desc: 'Provides buttons for all Microsoft-recommended Excel file recovery methods plus 5 additional independent recovery techniques. Includes Vista/7/8 previous-version file recovery via Windows Shadow Copies.',
    features: [
      'All Microsoft-recommended Excel recovery methods in one interface',
      '5 additional independent recovery algorithms',
      'Previous version file recovery (Windows Shadow Copies)',
      'Works with both .xls and .xlsx formats',
      'Simple one-click interface for each recovery method',
    ],
    hasScreenshots: true,
  },
  {
    repo: 'crrptoffcxtrctr-SF',
    name: 'Corrupt Extractor for Microsoft Office',
    sfProject: 'crrptoffcxtrctr',
    lang: 'Delphi 7',
    type: 'delphi',
    desc: 'Extracts text and data from corrupt DOCX, XLSX, and PPTX files. Advanced mode can fix zip structure, recover embedded images, and edit corrupt XML directly.',
    features: [
      'Extracts text from corrupt Office 2007+ files (DOCX, XLSX, PPTX)',
      'Advanced mode fixes zip archive structure',
      'Recovers embedded images from damaged documents',
      'Direct XML editing for manual repair',
      'Handles files that Office cannot open at all',
    ],
    hasScreenshots: true,
  },
  {
    repo: 'damageddocx2txt-SF',
    name: 'Corrupt DOCX Salvager',
    sfProject: 'damageddocx2txt',
    lang: 'Perl',
    type: 'perl',
    desc: 'Salvages readable text from damaged DOCX (Word 2007+) files by directly parsing the XML inside the zip archive, bypassing Word\'s file validation.',
    features: [
      'Extracts text from corrupt DOCX files',
      'Parses document.xml directly inside the zip archive',
      'Bypasses Word\'s strict file validation',
      'Command-line interface for scripting and batch use',
      'Outputs clean plain text',
    ],
    hasScreenshots: false,
  },
  {
    repo: 'datarecoverfree-SF',
    name: 'Freeware Directory Script',
    sfProject: 'datarecoverfree',
    lang: 'PHP / MySQL',
    type: 'php',
    desc: 'Open-source freeware directory website script with configurable categories, user and webmaster ratings. Includes sample data with 400+ data-recovery freeware entries.',
    features: [
      'Configurable category system for organizing software listings',
      'Dual rating system (user ratings + webmaster ratings)',
      'Search and browse functionality',
      'Admin panel for managing entries',
      'Sample dataset: 400+ data recovery freeware listings',
    ],
    hasScreenshots: true,
  },
  {
    repo: 'excel2ged-SF',
    name: 'Excel to GEDCOM Converter',
    sfProject: 'excel2ged',
    lang: 'VBA / Excel',
    type: 'vba',
    desc: 'Converts genealogy data stored in Excel spreadsheets into standard GEDCOM format for import into genealogy software like Gramps, RootsMagic, or Ancestry.',
    features: [
      'Converts Excel spreadsheets to GEDCOM genealogy format',
      'Maps spreadsheet columns to GEDCOM fields',
      'Handles individuals, families, and relationships',
      'Works with .xls and .xlsx files',
      'VBA macros automate the conversion process',
    ],
    hasScreenshots: false,
  },
  {
    repo: 'excelrcvryaddin-SF',
    name: 'Excel Recovery Add-In',
    sfProject: 'excelrcvryaddin',
    lang: 'VB.NET',
    type: 'vbnet',
    desc: 'A Microsoft Excel add-in that adds recovery buttons directly into the Excel ribbon. Provides one-click access to recovery tools without leaving Excel.',
    features: [
      'Installs as an Excel ribbon add-in',
      'One-click access to recovery methods from within Excel',
      'Integrates with Windows Shadow Copy for file versioning',
      'Works with Excel 2007, 2010, 2013, and later',
    ],
    hasScreenshots: true,
  },
  {
    repo: 'fasterposter-SF',
    name: 'Faster Poster',
    sfProject: 'fasterposter',
    lang: 'HTML / JavaScript',
    type: 'html',
    desc: 'A web-based tool for creating quick, simple posters and flyers using just your browser. No sign-up or software install needed.',
    features: [
      'Create posters and flyers in your browser',
      'No sign-up or software installation required',
      'Customizable text, colors, and layout',
      'Print-ready output',
    ],
    hasScreenshots: true,
  },
  {
    repo: 'ged2wiki-SF',
    name: 'gedcom2wiki',
    sfProject: 'ged2wiki',
    lang: 'Perl',
    type: 'perl',
    desc: 'Converts standard GEDCOM genealogy files into wiki family-tree template markup compatible with Wikimedia-style wikis.',
    features: [
      'Reads standard GEDCOM genealogy files',
      'Outputs wiki-compatible family tree templates',
      'Works with Wikimedia-style wiki markup',
      'Handles multi-generation family structures',
      'Command-line interface for batch conversion',
    ],
    hasScreenshots: false,
  },
  {
    repo: 'genealogyoflife-SF',
    name: 'Genealogy of Life',
    sfProject: 'genealogyoflife',
    lang: 'GEDCOM Data',
    type: 'gedcom',
    desc: 'A genealogy dataset combining the Catalogue of Life taxonomy with traditional genealogy formats. Represents the tree of life as a navigable family tree.',
    features: [
      'Tree of life represented in GEDCOM format',
      'Based on the Catalogue of Life taxonomy',
      'Navigable in any GEDCOM-compatible genealogy software',
      'Covers millions of species relationships',
    ],
    hasScreenshots: false,
  },
  {
    repo: 'godskingsheroes-SF',
    name: 'Famous Family Trees',
    sfProject: 'godskingsheroes',
    lang: 'GEDCOM Data',
    type: 'gedcom',
    desc: 'A collection of genealogy data in GEDCOM format covering biological species, corporations, fictional characters, religious figures, royalty, and political figures.',
    features: [
      'Royal family trees (European, Chinese dynasties, and more)',
      'US Presidents and political figures',
      'Corporate genealogies (company histories as family trees)',
      'Fictional characters and religious figures',
      'Biological species taxonomy (Catalogue of Life integration)',
    ],
    hasScreenshots: false,
  },
  {
    repo: 'oorecovery-SF',
    name: 'OpenOffice Recovery',
    sfProject: 'oorecovery',
    lang: 'Perl',
    type: 'perl',
    desc: 'Recovers text from corrupt OpenOffice/LibreOffice files (ODT, ODS, ODP) by directly parsing the XML content inside the ODF zip archive.',
    features: [
      'Extracts text from corrupt ODT, ODS, and ODP files',
      'Parses content.xml directly from the ODF zip archive',
      'Works when LibreOffice/OpenOffice cannot open the file',
      'Command-line tool for batch processing',
    ],
    hasScreenshots: false,
  },
  {
    repo: 'pptxrecovery-SF',
    name: 'PPTX Recovery',
    sfProject: 'pptxrecovery',
    lang: 'VB.NET',
    type: 'vbnet',
    desc: 'Recovers content from corrupt PowerPoint PPTX files using multiple repair strategies including zip repair, XML validation, and text extraction.',
    features: [
      'Multiple recovery strategies for corrupt PPTX files',
      'Zip archive structure repair',
      'XML validation and truncation',
      'Text extraction as a fallback',
      'Works with PowerPoint 2007+ format',
    ],
    hasScreenshots: true,
  },
  {
    repo: 'qatindex-SF',
    name: 'Microsoft Office QAT Index',
    sfProject: 'qatindex',
    lang: 'VBA / Excel',
    type: 'vba',
    desc: 'A searchable index of Quick Access Toolbar (QAT) commands in Microsoft Office 2007/2010 — covering Excel and PowerPoint. Includes VBA code usable with Word too.',
    features: [
      'Searchable index of all QAT commands',
      'Covers Excel and PowerPoint (Office 2007/2010)',
      'VBA code included for Word integration',
      'Helps discover hidden and undocumented toolbar commands',
    ],
    hasScreenshots: true,
  },
  {
    repo: 'quickwordrecovr-SF',
    name: 'Savvy DOCX Recovery',
    sfProject: 'quickwordrecovr',
    lang: 'Delphi / Perl',
    type: 'delphi',
    desc: 'Performs precise XML surgery on corrupt Word DOCX files. Uses xmllint for repair and truncation, with a fallback to DocToText for plain text extraction.',
    features: [
      'Targeted XML repair inside DOCX archives',
      'Uses xmllint for validation and truncation',
      'Configurable truncation offset for fine-tuning',
      'Fallback text extraction via DocToText',
    ],
    hasScreenshots: true,
  },
  {
    repo: 'saveofficedata-SF',
    name: 'Corrupt Office Data/Text Extract Service',
    sfProject: 'saveofficedata',
    lang: 'PHP',
    type: 'php',
    desc: 'A web-based service that lets users upload corrupt Office files and extracts whatever text can be salvaged. Provides a simple upload-and-download interface.',
    features: [
      'Web-based upload interface for corrupt Office files',
      'Extracts text from damaged DOCX, XLSX, PPTX files',
      'No software installation needed — works in any browser',
      'Download recovered text as a plain text file',
    ],
    hasScreenshots: true,
  },
  {
    repo: 'savvyoffice-SF',
    name: 'Savvy Repair for Microsoft Office',
    sfProject: 'savvyoffice',
    lang: 'Delphi',
    type: 'delphi',
    desc: 'Repairs corrupt DOCX, XLSX, and PPTX files using 4 algorithmic methods: zip repair, strict XML validation truncation, lax validation, and text salvage.',
    features: [
      'Zip archive structure repair',
      'Strict XML validation with truncation',
      'Lax XML validation (recovers more data at the cost of some formatting)',
      'Plain text salvage as a last resort',
      'Works with all Office 2007+ formats',
    ],
    hasScreenshots: true,
  },
  {
    repo: 'shiftf3-SF',
    name: 'Shift+F3 Case Changer',
    sfProject: 'shiftf3',
    lang: 'AutoHotkey',
    type: 'ahk',
    desc: 'Adds Word-style Shift+F3 text case cycling (lowercase → Title Case → UPPERCASE) to every Windows application. Select text anywhere, press Shift+F3, and it toggles the case.',
    features: [
      'Adds Shift+F3 case cycling to all Windows apps',
      'Cycles: lowercase → Title Case → UPPERCASE → lowercase',
      'Works with any selected text in any application',
      'Runs silently in the system tray',
      'Lightweight — uses almost no memory or CPU',
    ],
    hasScreenshots: false,
  },
  {
    repo: 'vistaprevrsrcvr-SF',
    name: 'Previous Version File Recoverer',
    sfProject: 'vistaprevrsrcvr',
    lang: 'VB.NET',
    type: 'vbnet',
    desc: 'Recovers previous file versions from Windows Shadow Copies on Vista, 7, and 8 — including Home editions that lack the built-in Previous Versions feature.',
    features: [
      'Accesses Windows Shadow Copy Service (VSS)',
      'Works on Home editions (which lack the built-in Previous Versions UI)',
      'Browse and restore previous versions of any file or folder',
      'Supports Windows Vista, 7, and 8',
      'Simple file browser interface',
    ],
    hasScreenshots: true,
  },
  {
    repo: 'whereyoubin-SF',
    name: 'Where In the World Have You Been?',
    sfProject: 'whereyoubin',
    lang: 'PHP / JavaScript',
    type: 'php',
    desc: 'A PHP web app with clickable maps (World, US, China, Canada, India, Africa, Europe). Color-codes regions you\'ve visited, with download, poster, and permalink support.',
    features: [
      'Interactive clickable maps for multiple regions',
      'Color-coded visited/unvisited regions',
      'Poster-quality downloadable maps',
      'Shareable permalink for your travel map',
      'Covers World, US, China, Canada, India, Africa, Europe',
    ],
    hasScreenshots: true,
  },
  {
    repo: 'wordrecovery-SF',
    name: 'S2 Recovery Tools for Microsoft Word',
    sfProject: 'wordrecovery',
    lang: 'VB.NET / C#',
    type: 'vbnet',
    desc: 'Provides buttons for all Microsoft-recommended Word document recovery methods plus 5 independent techniques. Includes previous-version recovery and temporary/deleted file finder.',
    features: [
      'All Microsoft-recommended Word recovery methods in one interface',
      '5 additional independent recovery algorithms',
      'Previous version recovery (Windows Shadow Copies)',
      'Temporary and deleted file finder',
      'Works with both .doc and .docx formats',
    ],
    hasScreenshots: true,
  },
  {
    repo: 'xmltrncatorfixr-SF',
    name: 'XML Truncator-Fixer',
    sfProject: 'xmltrncatorfixr',
    lang: 'Perl',
    type: 'perl',
    desc: 'Finds the first XML error in a file, truncates just before it, then uses xmllint to add correct closing tags. Configurable truncation offset (default: 50 characters before the error).',
    features: [
      'Locates the first XML parsing error automatically',
      'Truncates the file just before the error point',
      'Uses xmllint to add proper closing tags',
      'Configurable truncation offset for fine-tuning',
      'Useful for repairing corrupt Office XML files',
    ],
    hasScreenshots: false,
  },
];

// ─── README generator ───────────────────────────────────────────────────

function generateReadme(entry) {
  const build = BUILD_INSTRUCTIONS[entry.type] || BUILD_INSTRUCTIONS['html'];
  let md = '';

  // Title and badges
  md += `# ${entry.name}\n\n`;

  // Description
  md += `${entry.desc}\n\n`;

  // Screenshot section
  if (entry.hasScreenshots) {
    md += `## Screenshots\n\n`;
    md += `Visit the [SourceForge project page](https://sourceforge.net/projects/${entry.sfProject}/) to view screenshots.\n\n`;
    md += `> **Tip:** If you have screenshots to contribute, open a PR adding them to a \`screenshots/\` folder!\n\n`;
  }

  // Language
  md += `**Language:** ${entry.lang}  \n`;
  md += `**License:** MIT\n\n`;

  // Features
  md += `## Features\n\n`;
  for (const f of entry.features) {
    md += `- ${f}\n`;
  }
  md += '\n';

  // System Requirements
  md += `## System Requirements\n\n`;
  for (const req of build.requirements) {
    md += `- ${req}\n`;
  }
  md += '\n';

  // Install / Build Instructions
  md += `## Installation & Usage\n\n`;
  md += build.install + '\n\n';

  // Origin
  md += `## Origin\n\n`;
  md += `This project was originally hosted on SourceForge and has been migrated to GitHub for easier access and collaboration.\n\n`;
  md += `- **SourceForge:** [${entry.sfProject}](https://sourceforge.net/projects/${entry.sfProject}/)\n`;
  md += `- **Migrated with:** [SF2GH Migrator](https://github.com/socrtwo/sf-to-github)\n\n`;

  // Contributing
  md += `## Contributing\n\n`;
  md += `Contributions are welcome! Feel free to:\n\n`;
  md += `1. Fork this repository\n`;
  md += `2. Create a feature branch (\`git checkout -b my-feature\`)\n`;
  md += `3. Commit your changes (\`git commit -m "Add my feature"\`)\n`;
  md += `4. Push to the branch (\`git push origin my-feature\`)\n`;
  md += `5. Open a Pull Request\n\n`;

  // License
  md += `## License\n\n`;
  md += `MIT License — see [LICENSE](LICENSE) for details.\n`;

  return md;
}

// ─── GitHub API ─────────────────────────────────────────────────────────

function githubApi(method, apiPath, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: apiPath,
      method: method,
      headers: {
        'User-Agent': 'SF2GH-Migrator/1.5',
        'Accept': 'application/vnd.github+json',
        'Authorization': 'Bearer ' + TOKEN,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    };
    if (body) options.headers['Content-Type'] = 'application/json';

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (d) => { data += d; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch (_) { resolve({ status: res.statusCode, data: {} }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function updateReadme(entry) {
  const { repo } = entry;
  console.log(`\n--- ${repo} ---`);

  // Get current README SHA (needed for update)
  const getRes = await githubApi('GET', `/repos/${OWNER}/${repo}/contents/README.md`);
  const sha = getRes.data.sha || null;

  if (getRes.status === 404) {
    console.log('  No README.md found. Creating new one.');
  }

  const content = generateReadme(entry);
  const base64 = Buffer.from(content).toString('base64');

  const body = {
    message: 'Improve README: add install instructions, system requirements, and contributing guide',
    content: base64,
    branch: 'main',
  };
  if (sha) body.sha = sha;

  const putRes = await githubApi('PUT', `/repos/${OWNER}/${repo}/contents/README.md`, body);

  if (putRes.status === 200 || putRes.status === 201) {
    console.log('  Updated successfully.');
  } else {
    console.log('  Failed: HTTP ' + putRes.status + ' — ' + (putRes.data.message || ''));
  }

  await sleep(600); // Rate-limit friendly
}

async function main() {
  console.log('Improving READMEs for ALL ' + REPOS.length + ' SF repos');
  console.log('Owner: ' + OWNER);
  console.log('');
  console.log('Adding: screenshots, install/build instructions,');
  console.log('        system requirements, contributing guide');
  console.log('');

  for (const entry of REPOS) {
    await updateReadme(entry);
  }

  console.log('\n=== ALL ' + REPOS.length + ' REPOS DONE ===');
}

main().catch(console.error);
