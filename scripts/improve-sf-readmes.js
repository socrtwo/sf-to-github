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

const { createGitHubApi, sleep } = require('./lib/github-api');
const repoConfig = require('./config/repositories.json');

const OWNER = process.env.GITHUB_OWNER || repoConfig.owner;
const TOKEN = process.env.GITHUB_TOKEN;

if (!TOKEN) {
  console.error('Set GITHUB_TOKEN environment variable.');
  process.exit(1);
}

const { githubApi } = createGitHubApi(TOKEN);

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

// ─── All 24 repos (from shared config) ──────────────────────────────────

const REPOS = repoConfig.repos;


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
