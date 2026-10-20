#!/usr/bin/env node
'use strict';

/**
 * Clean up all SF-migrated GitHub repos:
 * 1. Remove IDE junk (.suo, .vs/, .vbproj.user)
 * 2. Delete duplicate files (readme.txt, MIT_License.txt, license.txt, .bak)
 * 3. Sanitize config files (config.php → config.example.php)
 * 4. Extract wordrecovery-SF source from zip
 * 5. Organize crrptoffcxtrctr-SF into src/ folder
 * 6. Remove stray files
 * 7. Update .gitignore in all repos
 *
 * Usage: cd ~/sf-to-github
 *        GITHUB_TOKEN=ghp_YOUR_TOKEN node scripts/cleanup-sf-repos.js
 *
 * Token needs "repo" and "workflow" scopes.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const TOKEN = process.env.GITHUB_TOKEN;
const OWNER = process.env.GITHUB_OWNER || 'socrtwo';

if (!TOKEN) {
  console.error('Set GITHUB_TOKEN environment variable.');
  process.exit(1);
}

function run(cmd, opts = {}) {
  console.log('    $ ' + cmd.substring(0, 110) + (cmd.length > 110 ? '...' : ''));
  return execSync(cmd, { stdio: 'pipe', timeout: 300000, ...opts }).toString().trim();
}

function downloadFromSF(sfProject, fileName) {
  const pageUrl = `https://sourceforge.net/projects/${sfProject}/files/${encodeURIComponent(fileName)}/download`;
  const tmpPage = path.join(os.tmpdir(), 'sf-page-' + Date.now() + '.html');
  const tmpFile = path.join(os.tmpdir(), 'sf-dl-' + Date.now() + '.bin');
  try {
    run(`curl -s -o "${tmpPage}" -A "Mozilla/5.0" "${pageUrl}"`, { timeout: 30000 });
    const html = fs.readFileSync(tmpPage, 'utf8');
    const match = html.match(/https:\/\/downloads\.sourceforge\.net\/[^"&]+/);
    if (!match) throw new Error('No mirror URL found');
    const directUrl = match[0].replace(/&amp;/g, '&');
    run(`curl -L -o "${tmpFile}" -A "Mozilla/5.0" --max-redirs 10 --max-time 600 "${directUrl}"`, { timeout: 660000 });
    return tmpFile;
  } finally {
    try { fs.unlinkSync(tmpPage); } catch (_) {}
  }
}

// Files to delete from all repos
const JUNK_FILES = [
  '*.suo', '*.user', '*.bak', '*.cachefile',
  'Lorem Ipsum.txt', 'cookiefile',
];

const DUPLICATE_FILES = [
  'readme.txt', 'Readme.txt', 'README.txt',
  'MIT_License.txt', 'license.txt',
];

const JUNK_DIRS = ['.vs'];

const GOOD_GITIGNORE = `# IDE / Visual Studio
*.suo
*.user
*.userosscache
*.sln.docstates
.vs/
[Bb]in/
[Oo]bj/
[Dd]ebug/
[Rr]elease/
packages/
*.nupkg

# OS
.DS_Store
Thumbs.db
desktop.ini
ehthumbs.db

# Backups
*.bak
*.tmp
*.swp
*~

# Config with credentials
config.php
cookiefile
`;

// All repos to clean
const REPOS = [
  'autoscrshotanno-SF',
  'catalog-of-life-SF',
  'coffice2txt-SF',
  'corruptexcelrec-SF',
  'crrptoffcxtrctr-SF',
  'damageddocx2txt-SF',
  'datarecoverfree-SF',
  'excel2ged-SF',
  'excelrcvryaddin-SF',
  'fasterposter-SF',
  'ged2wiki-SF',
  'genealogyoflife-SF',
  'godskingsheroes-SF',
  'oorecovery-SF',
  'pptxrecovery-SF',
  'qatindex-SF',
  'quickwordrecovr-SF',
  'saveofficedata-SF',
  'savvyoffice-SF',
  'shiftf3-SF',
  'vistaprevrsrcvr-SF',
  'whereyoubin-SF',
  'wordrecovery-SF',
  'xmltrncatorfixr-SF',
];

function deleteRecursive(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function findFiles(dir, pattern) {
  const results = [];
  function walk(d) {
    try {
      for (const e of fs.readdirSync(d)) {
        if (e === '.git') continue;
        const full = path.join(d, e);
        const stat = fs.lstatSync(full);
        if (stat.isDirectory()) walk(full);
        else {
          if (pattern instanceof RegExp) {
            if (pattern.test(e)) results.push(full);
          } else if (e === pattern) {
            results.push(full);
          }
        }
      }
    } catch (_) {}
  }
  walk(dir);
  return results;
}

async function cleanRepo(repoName) {
  console.log(`\n=== ${repoName} ===`);

  const tmpDir = path.join(os.tmpdir(), 'sf-clean-' + repoName);
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });

  try {
    const cloneUrl = `https://${TOKEN}@github.com/${OWNER}/${repoName}.git`;
    console.log('  Cloning...');
    run(`git clone "${cloneUrl}" "${tmpDir}"`);

    const allFiles = fs.readdirSync(tmpDir).filter(f => f !== '.git');
    if (allFiles.length === 0) {
      console.log('  Empty repo. Skipping.');
      return;
    }

    let changes = 0;

    // 1. Remove IDE junk directories
    for (const junkDir of JUNK_DIRS) {
      const dirPath = path.join(tmpDir, junkDir);
      if (fs.existsSync(dirPath)) {
        console.log('  Removing directory: ' + junkDir + '/');
        deleteRecursive(dirPath);
        changes++;
      }
      // Also find nested ones
      const nested = findFiles(tmpDir, junkDir).filter(f => fs.existsSync(f) && fs.lstatSync(f).isDirectory());
    }

    // 2. Remove junk files (*.suo, *.user, *.bak, etc.)
    for (const pattern of JUNK_FILES) {
      let files;
      if (pattern.startsWith('*')) {
        const ext = pattern.substring(1);
        files = findFiles(tmpDir, new RegExp(ext.replace('.', '\\.') + '$', 'i'));
      } else {
        files = findFiles(tmpDir, pattern);
      }
      for (const f of files) {
        console.log('  Removing: ' + path.relative(tmpDir, f));
        fs.unlinkSync(f);
        changes++;
      }
    }

    // 3. Remove duplicate readme/license files (keep README.md and LICENSE)
    for (const dup of DUPLICATE_FILES) {
      const dupPath = path.join(tmpDir, dup);
      if (fs.existsSync(dupPath)) {
        // Only delete if we have the proper version
        const hasProper = (dup.toLowerCase().includes('readme') && fs.existsSync(path.join(tmpDir, 'README.md'))) ||
                          (dup.toLowerCase().includes('license') && fs.existsSync(path.join(tmpDir, 'LICENSE')));
        if (hasProper) {
          console.log('  Removing duplicate: ' + dup);
          fs.unlinkSync(dupPath);
          changes++;
        }
      }
    }

    // 4. Special: whereyoubin-SF — sanitize config.php
    if (repoName === 'whereyoubin-SF') {
      const configPath = path.join(tmpDir, 'config.php');
      if (fs.existsSync(configPath)) {
        const examplePath = path.join(tmpDir, 'config.example.php');
        if (!fs.existsSync(examplePath)) {
          console.log('  Creating config.example.php from config.php');
          let config = fs.readFileSync(configPath, 'utf8');
          // Redact passwords/keys
          config = config.replace(/(password|passwd|pass|secret|key|token)\s*[=:]\s*['"][^'"]*['"]/gi,
            (match) => match.replace(/['"][^'"]*['"]/, "'CHANGE_ME'"));
          fs.writeFileSync(examplePath, config);
          changes++;
        }
        console.log('  Removing config.php (credentials)');
        fs.unlinkSync(configPath);
        changes++;
      }
    }

    // 5. Special: crrptoffcxtrctr-SF — move Delphi files into src/
    if (repoName === 'crrptoffcxtrctr-SF') {
      const delphiExts = ['.pas', '.dfm', '.dpr', '.res', '.dof', '.cfg'];
      const looseDelphiFiles = allFiles.filter(f =>
        delphiExts.some(ext => f.toLowerCase().endsWith(ext))
      );
      if (looseDelphiFiles.length > 5) {
        const srcDir = path.join(tmpDir, 'src');
        if (!fs.existsSync(srcDir)) {
          fs.mkdirSync(srcDir);
          console.log('  Moving ' + looseDelphiFiles.length + ' Delphi files into src/');
          for (const f of looseDelphiFiles) {
            const src = path.join(tmpDir, f);
            const dst = path.join(srcDir, f);
            if (fs.existsSync(src)) {
              fs.renameSync(src, dst);
              changes++;
            }
          }
        }
      }
    }

    // 6. Special: vistaprevrsrcvr-SF — move stray FormMain.resx
    if (repoName === 'vistaprevrsrcvr-SF') {
      const strayResx = path.join(tmpDir, 'FormMain.resx');
      if (fs.existsSync(strayResx)) {
        // Find the project folder and move it there
        const projDirs = fs.readdirSync(tmpDir).filter(d =>
          fs.existsSync(path.join(tmpDir, d)) &&
          fs.lstatSync(path.join(tmpDir, d)).isDirectory() &&
          d !== '.git' && d !== 'releases' && d !== '.github'
        );
        if (projDirs.length > 0) {
          const dst = path.join(tmpDir, projDirs[0], 'FormMain.resx');
          if (!fs.existsSync(dst)) {
            console.log('  Moving stray FormMain.resx into ' + projDirs[0] + '/');
            fs.renameSync(strayResx, dst);
            changes++;
          }
        }
      }
    }

    // 7. Special: wordrecovery-SF — extract source if still zipped
    if (repoName === 'wordrecovery-SF') {
      const hasSource = allFiles.some(f =>
        f.endsWith('.sln') || f.endsWith('.vbproj') || f.endsWith('.cs') || f.endsWith('.vb')
      );
      const hasZips = allFiles.some(f => f.endsWith('.zip') || f.endsWith('.7z'));
      if (!hasSource && hasZips) {
        console.log('  Source not extracted yet. Downloading from SF...');
        try {
          const dlPath = downloadFromSF('wordrecovery', 'Version 3.0.5-alpha-source.zip');
          const buf = fs.readFileSync(dlPath);
          if (buf[0] === 0x50 && buf[1] === 0x4B) {
            const extractDir = path.join(os.tmpdir(), 'sf-extract-wordrecovery');
            if (fs.existsSync(extractDir)) deleteRecursive(extractDir);
            fs.mkdirSync(extractDir, { recursive: true });
            run(`unzip -o -q "${dlPath}" -d "${extractDir}"`);

            // Flatten
            const entries = fs.readdirSync(extractDir);
            let srcRoot = extractDir;
            if (entries.length === 1 && fs.lstatSync(path.join(extractDir, entries[0])).isDirectory()) {
              srcRoot = path.join(extractDir, entries[0]);
            }

            // Move zips to releases/
            const relDir = path.join(tmpDir, 'releases');
            fs.mkdirSync(relDir, { recursive: true });
            for (const f of allFiles) {
              if ((f.endsWith('.zip') || f.endsWith('.7z')) && f !== 'README.md') {
                const src = path.join(tmpDir, f);
                if (fs.existsSync(src)) fs.renameSync(src, path.join(relDir, f));
              }
            }

            // Copy extracted source
            for (const f of fs.readdirSync(srcRoot)) {
              const src = path.join(srcRoot, f);
              const dst = path.join(tmpDir, f);
              if (!fs.existsSync(dst)) {
                if (fs.lstatSync(src).isDirectory()) {
                  run(`cp -r "${src}" "${dst}"`);
                } else {
                  fs.copyFileSync(src, dst);
                }
              }
            }
            console.log('  Source extracted from SF.');
            changes++;
            deleteRecursive(extractDir);
          }
          fs.unlinkSync(dlPath);
        } catch (err) {
          console.log('  Could not extract: ' + err.message.split('\n')[0]);
        }
      }
    }

    // 8. Update .gitignore for all repos
    const gitignorePath = path.join(tmpDir, '.gitignore');
    const currentGitignore = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';
    if (!currentGitignore.includes('.vs/') || !currentGitignore.includes('*.suo')) {
      console.log('  Updating .gitignore');
      fs.writeFileSync(gitignorePath, GOOD_GITIGNORE);
      changes++;
    }

    // 9. Commit and push
    if (changes === 0) {
      console.log('  No changes needed.');
      return;
    }

    run('git config user.name "SF2GH Migrator"', { cwd: tmpDir });
    run('git config user.email "sf2gh@localhost"', { cwd: tmpDir });
    run('git add -A', { cwd: tmpDir });

    const status = run('git status --porcelain', { cwd: tmpDir });
    if (!status) {
      console.log('  No changes to commit.');
      return;
    }

    run('git commit -m "Cleanup: remove IDE junk, duplicates, organize files"', { cwd: tmpDir });
    console.log('  Pushing...');
    run('git push origin main', { cwd: tmpDir });
    console.log('  DONE! (' + changes + ' changes)');

  } catch (err) {
    console.error('  ERROR: ' + err.message.split('\n')[0]);
  } finally {
    if (fs.existsSync(tmpDir)) try { fs.rmSync(tmpDir, { recursive: true }); } catch (_) {}
  }
}

async function main() {
  console.log('SF Repo Cleanup Script');
  console.log('Owner: ' + OWNER);
  console.log('Repos: ' + REPOS.length);
  console.log('');
  console.log('Cleaning: IDE junk, duplicate files, stray files,');
  console.log('          config credentials, .gitignore updates');
  console.log('');

  for (const repo of REPOS) {
    await cleanRepo(repo);
  }

  console.log('\n=== ALL DONE ===');
}

main().catch(console.error);
