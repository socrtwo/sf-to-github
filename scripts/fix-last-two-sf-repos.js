#!/usr/bin/env node
'use strict';

/**
 * Fix the 2 remaining SF repos:
 * 1. genealogyoflife-SF: 108MB database — upload as GitHub release (too big for git)
 * 2. saveofficedata-SF: try alternative zip files from SF
 *
 * Usage: cd ~/sf-to-github
 *        GITHUB_TOKEN=ghp_YOUR_TOKEN node scripts/fix-last-two-sf-repos.js
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const { createRunner } = require('./lib/shell');
const { downloadFromSF } = require('./lib/sf-downloader');
const { createGitHubApi, sleep } = require('./lib/github-api');
const { configureGit, cloneUrl } = require('./lib/git-helpers');

const TOKEN = process.env.GITHUB_TOKEN;
const OWNER = process.env.GITHUB_OWNER || 'socrtwo';

if (!TOKEN) {
  console.error('Set GITHUB_TOKEN environment variable.');
  process.exit(1);
}

const { run } = createRunner(TOKEN, 600000);
const { githubApi } = createGitHubApi(TOKEN);

async function fixGenealogyoflife() {
  console.log('\n=== genealogyoflife-SF ===');
  console.log('  Database is 108MB — too large for git. Uploading as GitHub release.');

  const repo = 'genealogyoflife-SF';

  // Step 1: Clean up the repo — remove the large file that failed to push
  const tmpDir = path.join(os.tmpdir(), 'sf-fix-genealogyoflife');
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });

  console.log('  Cloning repo...');
  run(`git clone "${cloneUrl(repo, OWNER)}" "${tmpDir}"`);

  // Remove any large files from the repo
  const files = fs.readdirSync(tmpDir).filter(f => f !== '.git');
  for (const f of files) {
    const fPath = path.join(tmpDir, f);
    const stat = fs.statSync(fPath);
    if (stat.isFile() && stat.size > 90 * 1024 * 1024) {
      console.log('  Removing oversized file: ' + f + ' (' + (stat.size / 1024 / 1024).toFixed(0) + ' MB)');
      fs.unlinkSync(fPath);
    }
  }

  // Make sure README is good
  const readme = `# Genealogy of Life

Converts the Catalogue of Life species database into GEDCOM genealogy format.

Includes the 2008 Catalogue of Life dataset converted to GEDCOM format.

**Note:** The database file (108 MB) is too large for a git repository. Download it from the [Releases](https://github.com/${OWNER}/${repo}/releases) page.

## Origin

Migrated from [SourceForge](https://sourceforge.net/projects/genealogyoflife/) via [SF2GH Migrator](https://github.com/socrtwo/sf-to-github).

## Downloads

See the [Releases](https://github.com/${OWNER}/${repo}/releases) page for the database file.

## License

MIT License
`;
  fs.writeFileSync(path.join(tmpDir, 'README.md'), readme);

  if (!fs.existsSync(path.join(tmpDir, '.gitignore'))) {
    fs.writeFileSync(path.join(tmpDir, '.gitignore'), '*.zip\n*.mdb\n.DS_Store\n');
  }
  if (!fs.existsSync(path.join(tmpDir, 'LICENSE'))) {
    fs.writeFileSync(path.join(tmpDir, 'LICENSE'),
      `MIT License\n\nCopyright (c) ${new Date().getFullYear()} Paul D Pruitt\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.\n`);
  }

  // Also grab the smaller text/image files from SF
  try {
    const instrFile = downloadFromSF(run, 'genealogyoflife', 'Life2008-Conversion Instruction-May Work With Future Years.txt');
    fs.copyFileSync(instrFile, path.join(tmpDir, 'Conversion-Instructions.txt'));
    fs.unlinkSync(instrFile);
    console.log('  Added conversion instructions.');
  } catch (_) { console.log('  Could not download instructions file.'); }

  try {
    const imgFile = downloadFromSF(run, 'genealogyoflife', 'Life2008-Connection.PNG');
    fs.copyFileSync(imgFile, path.join(tmpDir, 'Life2008-Connection.PNG'));
    fs.unlinkSync(imgFile);
    console.log('  Added connection diagram.');
  } catch (_) { console.log('  Could not download connection image.'); }

  configureGit(run, tmpDir);
  run('git add -A', { cwd: tmpDir });
  const status = run('git status --porcelain', { cwd: tmpDir });
  if (status) {
    run('git commit -m "Add README, instructions, and connection diagram (database in Releases)"', { cwd: tmpDir });
    console.log('  Pushing...');
    run('git push origin main', { cwd: tmpDir });
    console.log('  Repo updated.');
  }

  // Step 2: Download the large database zip and upload as release
  console.log('  Downloading 108MB database from SF...');
  let dbPath;
  try {
    dbPath = downloadFromSF(run, 'genealogyoflife', 'Database-With-2008-Data.zip');
  } catch (err) {
    console.log('  Download failed: ' + err.message);
    fs.rmSync(tmpDir, { recursive: true });
    return;
  }

  const dbSize = fs.statSync(dbPath).size;
  console.log('  Downloaded: ' + (dbSize / 1024 / 1024).toFixed(0) + ' MB');

  // Create release
  console.log('  Creating GitHub release...');
  const releaseRes = await githubApi('POST', `/repos/${OWNER}/${repo}/releases`, {
    tag_name: 'v2008',
    name: 'Genealogy of Life — 2008 Catalogue of Life Database',
    body: 'The 2008 Catalogue of Life database converted to GEDCOM format.\n\n**File:** Database-With-2008-Data.zip (108 MB)\n\nMigrated from [SourceForge](https://sourceforge.net/projects/genealogyoflife/).',
    draft: false,
    prerelease: false,
  });

  if (releaseRes.status === 201) {
    const releaseId = releaseRes.data.id;
    console.log('  Uploading database to release (this may take a minute)...');
    const dbBuf = fs.readFileSync(dbPath);
    const assetRes = await githubApi(
      'POST',
      `/repos/${OWNER}/${repo}/releases/${releaseId}/assets?name=Database-With-2008-Data.zip`,
      null, dbBuf
    );
    if (assetRes.status === 201) {
      console.log('  Database uploaded to release!');
    } else {
      console.log('  Upload failed: ' + (assetRes.data.message || assetRes.status));
    }
  } else {
    console.log('  Release creation failed: ' + (releaseRes.data.message || releaseRes.status));
  }

  fs.unlinkSync(dbPath);
  fs.rmSync(tmpDir, { recursive: true });
  console.log('  DONE!');
}

async function fixSaveofficedata() {
  console.log('\n=== saveofficedata-SF ===');
  console.log('  Trying alternative zip files from SF.');

  const repo = 'saveofficedata-SF';
  const sfProject = 'saveofficedata';

  // SF has multiple versions — try a different one
  const alternatives = [
    'codts_v.0.62.zip',
    'upload-cgi-script-without-proprietary-code-parts.0.52.zip',
  ];

  const tmpDir = path.join(os.tmpdir(), 'sf-fix-saveofficedata');
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });

  console.log('  Cloning repo...');
  run(`git clone "${cloneUrl(repo, OWNER)}" "${tmpDir}"`);

  // Check if already has source (beyond README)
  const existing = fs.readdirSync(tmpDir).filter(f => f !== '.git');
  const hasSource = existing.some(f =>
    f !== 'README.md' && f !== 'readme.txt' && f !== '.gitignore' && f !== 'LICENSE'
  );

  if (hasSource) {
    console.log('  Already has content. Skipping.');
    fs.rmSync(tmpDir, { recursive: true });
    return;
  }

  let extracted = false;
  for (const altFile of alternatives) {
    console.log('  Trying: ' + altFile);
    let dlPath;
    try {
      dlPath = downloadFromSF(run, sfProject, altFile);
    } catch (err) {
      console.log('  Download failed: ' + err.message.split('\n')[0]);
      continue;
    }

    const buf = fs.readFileSync(dlPath);
    if (buf[0] !== 0x50 || buf[1] !== 0x4B) {
      console.log('  Not a valid zip. Skipping.');
      fs.unlinkSync(dlPath);
      continue;
    }

    console.log('  Downloaded ' + (buf.length / 1024).toFixed(0) + ' KB — valid zip.');
    const extractDir = path.join(tmpDir, 'extract');
    fs.mkdirSync(extractDir, { recursive: true });

    try {
      run(`unzip -o -q "${dlPath}" -d "${extractDir}"`);
    } catch (e) {
      console.log('  Unzip failed. Trying next alternative...');
      fs.unlinkSync(dlPath);
      continue;
    }
    fs.unlinkSync(dlPath);

    // Flatten
    const entries = fs.readdirSync(extractDir);
    let srcRoot = extractDir;
    if (entries.length === 1 && fs.statSync(path.join(extractDir, entries[0])).isDirectory()) {
      console.log('  Flattening: ' + entries[0] + '/');
      srcRoot = path.join(extractDir, entries[0]);
    }

    const srcFiles = fs.readdirSync(srcRoot);
    for (const f of srcFiles) {
      const src = path.join(srcRoot, f);
      const dst = path.join(tmpDir, f);
      if (!fs.existsSync(dst)) {
        if (fs.statSync(src).isDirectory()) {
          run(`cp -r "${src}" "${dst}"`);
        } else {
          fs.copyFileSync(src, dst);
        }
      }
    }
    console.log('  Extracted ' + srcFiles.length + ' item(s).');
    extracted = true;
    break;
  }

  // Update README
  const readme = `# Corrupt Office Data/Text Extract Service

A web service (PHP) that extracts text and data from corrupt Microsoft Office files uploaded by users.

## Origin

Migrated from [SourceForge](https://sourceforge.net/projects/${sfProject}/) via [SF2GH Migrator](https://github.com/socrtwo/sf-to-github).

## License

MIT License
`;
  fs.writeFileSync(path.join(tmpDir, 'README.md'), readme);

  if (!fs.existsSync(path.join(tmpDir, '.gitignore'))) {
    fs.writeFileSync(path.join(tmpDir, '.gitignore'), '*.exe\n.DS_Store\nThumbs.db\n');
  }
  if (!fs.existsSync(path.join(tmpDir, 'LICENSE'))) {
    fs.writeFileSync(path.join(tmpDir, 'LICENSE'),
      `MIT License\n\nCopyright (c) ${new Date().getFullYear()} Paul D Pruitt\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.\n`);
  }

  // Remove the extract directory before committing
  const extractDir = path.join(tmpDir, 'extract');
  if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true });

  configureGit(run, tmpDir);
  run('git add -A', { cwd: tmpDir });
  const status = run('git status --porcelain', { cwd: tmpDir });
  if (status) {
    run('git commit -m "Add source files and README from SourceForge"', { cwd: tmpDir });
    console.log('  Pushing...');
    run('git push origin main', { cwd: tmpDir });
    console.log('  Pushed.');
  }

  fs.rmSync(tmpDir, { recursive: true });
  console.log('  DONE!');
}

async function main() {
  console.log('Fixing last 2 SF repos');

  await fixGenealogyoflife();
  await sleep(2000);
  await fixSaveofficedata();

  console.log('\n=== ALL DONE ===');
}

main().catch(console.error);
