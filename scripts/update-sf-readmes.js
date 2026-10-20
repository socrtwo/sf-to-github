#!/usr/bin/env node
'use strict';

/**
 * Update README.md files for all SF-migrated GitHub repos.
 *
 * Usage: cd ~/sf-to-github
 *        GITHUB_TOKEN=ghp_YOUR_TOKEN node scripts/update-sf-readmes.js
 */

const https = require('https');
const OWNER = process.env.GITHUB_OWNER || 'socrtwo';
const TOKEN = process.env.GITHUB_TOKEN;

if (!TOKEN) {
  console.error('Set GITHUB_TOKEN environment variable.');
  process.exit(1);
}

const REPOS = [
  {
    repo: 'autoscrshotanno-SF',
    name: 'Automatic Screenshot Annotator',
    sfProject: 'autoscrshotanno',
    lang: 'AutoIt',
    desc: 'Automatically annotates tutorial screenshots using internal window and button names. Generates annotated screenshots with natural language text overlays.',
    features: [
      'Captures screenshots of any running application',
      'Identifies UI elements (buttons, menus, text fields) by their internal names',
      'Generates natural language annotations describing each element',
      'Useful for creating documentation and tutorials automatically',
    ],
  },
  {
    repo: 'catalog-of-life-SF',
    name: 'Catalogue of Life Converter',
    sfProject: 'catalog-of-life',
    lang: 'MS Access / VBA',
    desc: 'Converts the Catalogue of Life database (1.2 million species) into GEDCOM genealogy format, producing over 2 million records. Explores hybridization-driven speciation patterns.',
    features: [
      'Converts Catalogue of Life species database to GEDCOM format',
      'Handles 1.2 million+ species records',
      'Outputs 2 million+ genealogy-style records',
      'MS Access database with VBA automation',
    ],
  },
  {
    repo: 'corruptexcelrec-SF',
    name: 'S2 Recovery Tools for Microsoft Excel',
    sfProject: 'corruptexcelrec',
    lang: 'VB.NET / C#',
    desc: 'Provides buttons for all Microsoft-recommended Excel file recovery methods plus 5 additional independent recovery techniques. Includes Vista/7/8 previous-version file recovery.',
    features: [
      'All MS-recommended Excel recovery methods in one interface',
      '5 additional independent recovery algorithms',
      'Previous version file recovery (Windows Shadow Copies)',
      'Works with .xls and .xlsx formats',
    ],
  },
  {
    repo: 'crrptoffcxtrctr-SF',
    name: 'Corrupt Extractor for Microsoft Office',
    sfProject: 'crrptoffcxtrctr',
    lang: 'Delphi 7',
    desc: 'Extracts text and data from corrupt DOCX, XLSX, and PPTX files. Advanced mode can fix zip structure, recover embedded images, and edit corrupt XML directly.',
    features: [
      'Extracts text from corrupt Office 2007+ files (DOCX, XLSX, PPTX)',
      'Advanced mode fixes zip archive structure',
      'Recovers embedded images from damaged documents',
      'Direct XML editing for manual repair',
    ],
  },
  {
    repo: 'datarecoverfree-SF',
    name: 'Freeware Directory Script',
    sfProject: 'datarecoverfree',
    lang: 'PHP / MySQL',
    desc: 'Open-source freeware directory website script with configurable categories, user and webmaster ratings. Includes sample data with 400+ data-recovery freeware entries.',
    features: [
      'Configurable category system',
      'Dual rating system (user ratings + webmaster ratings)',
      'Search and browse functionality',
      'Sample dataset: 400+ data recovery freeware listings',
    ],
  },
  {
    repo: 'ged2wiki-SF',
    name: 'gedcom2wiki',
    sfProject: 'ged2wiki',
    lang: 'Perl',
    desc: 'Converts standard GEDCOM genealogy files into wiki family-tree template markup compatible with Wikimedia-style wikis.',
    features: [
      'Reads standard GEDCOM genealogy files',
      'Outputs wiki-compatible family tree templates',
      'Works with Wikimedia-style wiki markup',
      'Handles multi-generation family structures',
    ],
  },
  {
    repo: 'godskingsheroes-SF',
    name: 'Famous Family Trees',
    sfProject: 'godskingsheroes',
    lang: 'GEDCOM Data',
    desc: 'A collection of genealogy data in GEDCOM format covering biological species, corporations, fictional characters, religious figures, royalty, and political figures.',
    features: [
      'Royal family trees (European, Chinese dynasties, etc.)',
      'US Presidents and political figures',
      'Corporate genealogies',
      'Fictional characters and religious figures',
      'Biological species taxonomy (Catalogue of Life integration)',
    ],
  },
  {
    repo: 'qatindex-SF',
    name: 'Microsoft Office QAT Index',
    sfProject: 'qatindex',
    lang: 'VBA / Excel',
    desc: 'An index for the Quick Access Toolbar (QAT) in Microsoft Office 2007/2010, covering Excel and PowerPoint commands. Includes VBA code usable with Word.',
    features: [
      'Searchable index of all QAT commands',
      'Covers Excel and PowerPoint (Office 2007/2010)',
      'VBA code included for Word integration',
      'Helps discover hidden toolbar commands',
    ],
  },
  {
    repo: 'quickwordrecovr-SF',
    name: 'Savvy DOCX Recovery',
    sfProject: 'quickwordrecovr',
    lang: 'Delphi / Perl',
    desc: 'Performs precise XML surgery on corrupt Word DOCX files. Uses xmllint for repair and truncation, with a fallback to DocToText for plain text extraction.',
    features: [
      'Targeted XML repair inside DOCX archives',
      'Uses xmllint for validation and truncation',
      'Configurable truncation offset',
      'Fallback text extraction via DocToText',
    ],
  },
  {
    repo: 'savvyoffice-SF',
    name: 'Savvy Repair for Microsoft Office',
    sfProject: 'savvyoffice',
    lang: 'Delphi',
    desc: 'Repairs corrupt DOCX, XLSX, and PPTX files using 4 algorithmic methods: zip repair, strict XML validation truncation, lax validation, and text salvage.',
    features: [
      'Zip archive structure repair',
      'Strict XML validation with truncation',
      'Lax XML validation (recovers more data)',
      'Plain text salvage as last resort',
    ],
  },
  {
    repo: 'vistaprevrsrcvr-SF',
    name: 'Previous Version File Recoverer',
    sfProject: 'vistaprevrsrcvr',
    lang: 'VB.NET',
    desc: 'Recovers previous file versions from Windows Shadow Copies on Vista, 7, and 8 — including Home editions that lack the built-in Previous Versions feature.',
    features: [
      'Accesses Windows Shadow Copy Service (VSS)',
      'Works on Home editions (which lack the built-in UI)',
      'Browse and restore previous versions of any file',
      'Supports Windows Vista, 7, and 8',
    ],
  },
  {
    repo: 'whereyoubin-SF',
    name: 'Where In the World Have You Been?',
    sfProject: 'whereyoubin',
    lang: 'PHP / JavaScript',
    desc: 'A PHP web application with clickable maps (World, US, China, Canada, India, Africa, Europe). Color-codes regions you\'ve visited, with download, poster, and permalink support.',
    features: [
      'Interactive clickable maps for multiple regions',
      'Color-coded visited/unvisited regions',
      'Poster-quality downloadable maps',
      'Shareable permalink for your travel map',
      'Covers World, US, China, Canada, India, Africa, Europe',
    ],
  },
  {
    repo: 'wordrecovery-SF',
    name: 'S2 Recovery Tools for Microsoft Word',
    sfProject: 'wordrecovery',
    lang: 'VB.NET / C#',
    desc: 'Provides buttons for all Microsoft-recommended Word document recovery methods plus 5 independent techniques. Includes previous-version recovery and temporary/deleted file finder.',
    features: [
      'All MS-recommended Word recovery methods',
      '5 additional independent recovery algorithms',
      'Previous version recovery (Windows Shadow Copies)',
      'Temporary and deleted file finder',
      'Works with .doc and .docx formats',
    ],
  },
  {
    repo: 'xmltrncatorfixr-SF',
    name: 'XML Truncator-Fixer',
    sfProject: 'xmltrncatorfixr',
    lang: 'Perl',
    desc: 'Finds the first XML error in a file, truncates just before it, then uses xmllint to add correct closing tags. Configurable truncation offset (default: 50 characters before the error).',
    features: [
      'Locates the first XML parsing error',
      'Truncates the file just before the error point',
      'Uses xmllint to add proper closing tags',
      'Configurable truncation offset',
    ],
  },
];

function generateReadme(entry) {
  let md = `# ${entry.name}\n\n`;
  md += `${entry.desc}\n\n`;
  md += `**Language:** ${entry.lang}\n\n`;
  md += `## Features\n\n`;
  for (const f of entry.features) {
    md += `- ${f}\n`;
  }
  md += `\n## Origin\n\n`;
  md += `Migrated from [SourceForge](https://sourceforge.net/projects/${entry.sfProject}/) via [SF2GH Migrator](https://github.com/socrtwo/sf-to-github).\n\n`;
  md += `## License\n\nMIT License — see [LICENSE](LICENSE) for details.\n`;
  return md;
}

function githubApi(method, apiPath, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: apiPath,
      method: method,
      headers: {
        'User-Agent': 'SF2GH-Migrator/1.0',
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

  const content = generateReadme(entry);
  const base64 = Buffer.from(content).toString('base64');

  const body = {
    message: 'Update README with project description and features',
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

  await sleep(500); // Rate limit friendly
}

async function main() {
  console.log('Updating READMEs for ' + REPOS.length + ' repos...');

  for (const entry of REPOS) {
    await updateReadme(entry);
  }

  console.log('\n=== ALL DONE ===');
}

main().catch(console.error);
