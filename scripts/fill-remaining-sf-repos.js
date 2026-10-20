#!/usr/bin/env node
'use strict';

/**
 * Fill remaining empty SF-migrated GitHub repos with files from SourceForge.
 * Downloads from SF, extracts, commits source, and creates releases for exes.
 *
 * Usage: cd ~/sf-to-github
 *        GITHUB_TOKEN=ghp_YOUR_TOKEN node scripts/fill-remaining-sf-repos.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

const TOKEN = process.env.GITHUB_TOKEN;
const OWNER = process.env.GITHUB_OWNER || 'socrtwo';

if (!TOKEN) {
  console.error('Set GITHUB_TOKEN environment variable.');
  process.exit(1);
}

const PROJECTS = [
  {
    repo: 'coffice2txt-SF',
    sfProject: 'coffice2txt',
    name: 'Corrupt Office File Salvager',
    desc: 'Salvages text from corrupt Microsoft Office files (DOCX, XLSX, PPTX).',
    files: [
      { sf: 'corrupt_office_salvager_setup_1.0.3_source.zip', type: 'source' },
      { sf: 'corrupt_office_salvager_setup_1.0.3_without_adware.exe', type: 'exe', version: 'v1.0.3' },
    ],
  },
  {
    repo: 'excel2ged-SF',
    sfProject: 'excel2ged',
    name: 'Excel2GED',
    desc: 'Converts Excel spreadsheets to GEDCOM genealogy format. Multiple versions available.',
    files: [
      { sf: 'Excel2GED3.23.11.11.zip', type: 'source' },
    ],
  },
  {
    repo: 'shiftf3-SF',
    sfProject: 'shiftf3',
    name: 'Shift F3 Case Changer',
    desc: 'Changes text case (upper/lower/title) like Shift+F3 in Microsoft Word, but works in any application.',
    files: [
      { sf: 'shift-f3-case-changer-0.52.zip', type: 'source' },
    ],
  },
  {
    repo: 'excelrcvryaddin-SF',
    sfProject: 'excelrcvryaddin',
    name: 'Excel Recovery Add-In',
    desc: 'An Excel add-in that provides recovery tools for corrupt Excel workbooks.',
    files: [
      { sf: 'excel_recovery_addin_source_code.zip', type: 'source' },
    ],
  },
  {
    repo: 'saveofficedata-SF',
    sfProject: 'saveofficedata',
    name: 'Corrupt Office Data/Text Extract Service',
    desc: 'A web service (PHP) that extracts text and data from corrupt Microsoft Office files uploaded by users.',
    files: [
      { sf: 'corrupt_extractor_service.zip', type: 'source' },
    ],
  },
  {
    repo: 'genealogyoflife-SF',
    sfProject: 'genealogyoflife',
    name: 'Genealogy of Life',
    desc: 'Converts the Catalogue of Life species database into GEDCOM genealogy format. Includes the 2008 dataset.',
    files: [
      { sf: 'Database-With-2008-Data.zip', type: 'source' },
    ],
  },
  {
    repo: 'fasterposter-SF',
    sfProject: 'fasterposter',
    name: 'Faster Poster',
    desc: 'A website platform for creating and sharing posters quickly.',
    files: [
      { sf: 'fasterposter.com_11_29_2011.zip', type: 'source' },
    ],
  },
];

function run(cmd, opts = {}) {
  console.log('  $ ' + cmd.substring(0, 100) + (cmd.length > 100 ? '...' : ''));
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
    console.log('  Downloading ' + fileName + '...');
    run(`curl -L -o "${tmpFile}" -A "Mozilla/5.0" --max-redirs 10 --max-time 300 "${directUrl}"`, { timeout: 360000 });
    if (!fs.existsSync(tmpFile)) throw new Error('No file produced');
    return tmpFile;
  } finally {
    try { fs.unlinkSync(tmpPage); } catch (_) {}
  }
}

function githubApi(method, apiPath, body, binary) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: binary ? 'uploads.github.com' : 'api.github.com',
      path: apiPath,
      method: method,
      headers: {
        'User-Agent': 'SF2GH-Migrator/1.0',
        'Authorization': 'Bearer ' + TOKEN,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    };
    if (binary) {
      options.headers['Content-Type'] = 'application/octet-stream';
      options.headers['Content-Length'] = binary.length;
    } else {
      options.headers['Accept'] = 'application/vnd.github+json';
      if (body) options.headers['Content-Type'] = 'application/json';
    }
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (d) => { data += d; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch (_) { resolve({ status: res.statusCode, data: {} }); }
      });
    });
    req.on('error', reject);
    if (binary) req.write(binary);
    else if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function processProject(project) {
  console.log(`\n=== ${project.repo} (${project.name}) ===`);

  const tmpDir = path.join(os.tmpdir(), 'sf-fill-' + project.repo);
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    // Clone the repo
    const repoDir = path.join(tmpDir, 'repo');
    const cloneUrl = `https://${TOKEN}@github.com/${OWNER}/${project.repo}.git`;
    console.log('  Cloning...');
    run(`git clone "${cloneUrl}" "${repoDir}"`);

    // Check if already has content
    const existing = fs.readdirSync(repoDir).filter(f => f !== '.git');
    const hasRealContent = existing.some(f =>
      f !== 'README.md' && f !== 'readme.txt' && f !== 'releases' &&
      f !== '.gitignore' && f !== 'LICENSE'
    );

    if (hasRealContent) {
      console.log('  Already has content (' + existing.join(', ') + '). Skipping source extraction.');
    } else {
      // Download and extract source files
      for (const file of project.files.filter(f => f.type === 'source')) {
        let dlPath;
        try {
          dlPath = downloadFromSF(project.sfProject, file.sf);
        } catch (err) {
          console.log('  Download failed: ' + err.message.split('\n')[0]);
          continue;
        }

        const buf = fs.readFileSync(dlPath);
        // Check if valid zip
        if (buf[0] === 0x50 && buf[1] === 0x4B) {
          console.log('  Downloaded ' + (buf.length / 1024).toFixed(0) + ' KB — valid zip.');
          const extractDir = path.join(tmpDir, 'extract');
          fs.mkdirSync(extractDir, { recursive: true });
          try {
            run(`unzip -o -q "${dlPath}" -d "${extractDir}"`);
          } catch (e) {
            console.log('  Unzip failed: ' + e.message.split('\n')[0]);
            fs.unlinkSync(dlPath);
            continue;
          }

          // Flatten single subdir
          const entries = fs.readdirSync(extractDir);
          let srcRoot = extractDir;
          if (entries.length === 1 && fs.statSync(path.join(extractDir, entries[0])).isDirectory()) {
            console.log('  Flattening: ' + entries[0] + '/');
            srcRoot = path.join(extractDir, entries[0]);
          }

          // Copy to repo
          const srcFiles = fs.readdirSync(srcRoot);
          for (const f of srcFiles) {
            const src = path.join(srcRoot, f);
            const dst = path.join(repoDir, f);
            if (!fs.existsSync(dst)) {
              if (fs.statSync(src).isDirectory()) {
                run(`cp -r "${src}" "${dst}"`);
              } else {
                fs.copyFileSync(src, dst);
              }
            }
          }
          console.log('  Extracted ' + srcFiles.length + ' item(s).');
        } else {
          console.log('  Not a valid zip. Copying as-is.');
          fs.copyFileSync(dlPath, path.join(repoDir, file.sf));
        }
        fs.unlinkSync(dlPath);
      }
    }

    // Add standard files
    if (!fs.existsSync(path.join(repoDir, '.gitignore'))) {
      fs.writeFileSync(path.join(repoDir, '.gitignore'), '*.exe\n*.msi\n.DS_Store\nThumbs.db\n.vs/\n');
    }
    if (!fs.existsSync(path.join(repoDir, 'LICENSE'))) {
      fs.writeFileSync(path.join(repoDir, 'LICENSE'),
        `MIT License\n\nCopyright (c) ${new Date().getFullYear()} Paul D Pruitt\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.\n`);
    }

    // Update README
    const hasExe = project.files.some(f => f.type === 'exe');
    const readme = `# ${project.name}\n\n${project.desc}\n\n## Origin\n\nMigrated from [SourceForge](https://sourceforge.net/projects/${project.sfProject}/) via [SF2GH Migrator](https://github.com/socrtwo/sf-to-github).\n` +
      (hasExe ? `\n## Downloads\n\nSee the [Releases](https://github.com/${OWNER}/${project.repo}/releases) page for the installer.\n` : '') +
      `\n## License\n\nMIT License\n`;
    fs.writeFileSync(path.join(repoDir, 'README.md'), readme);

    // Commit and push
    run('git config user.name "SF2GH Migrator"', { cwd: repoDir });
    run('git config user.email "sf2gh@localhost"', { cwd: repoDir });
    run('git add -A', { cwd: repoDir });
    const status = run('git status --porcelain', { cwd: repoDir });
    if (status) {
      run('git commit -m "Add source files and README from SourceForge"', { cwd: repoDir });
      console.log('  Pushing source...');
      run('git push origin main', { cwd: repoDir });
      console.log('  Source pushed.');
    } else {
      console.log('  No source changes to commit.');
    }

    // Handle exe files — create GitHub release
    for (const file of project.files.filter(f => f.type === 'exe')) {
      console.log('  Downloading exe for release...');
      let exePath;
      try {
        exePath = downloadFromSF(project.sfProject, file.sf);
      } catch (err) {
        console.log('  Exe download failed: ' + err.message.split('\n')[0]);
        continue;
      }

      const exeSize = fs.statSync(exePath).size;
      console.log('  Exe: ' + (exeSize / 1024 / 1024).toFixed(1) + ' MB');

      // Create release
      const version = file.version || 'v1.0.0';
      console.log('  Creating release ' + version + '...');
      const releaseRes = await githubApi('POST', `/repos/${OWNER}/${project.repo}/releases`, {
        tag_name: version,
        name: project.name + ' ' + version,
        body: `${project.desc}\n\nDownload the installer below.\n\nMigrated from [SourceForge](https://sourceforge.net/projects/${project.sfProject}/).`,
        draft: false,
        prerelease: false,
      });

      if (releaseRes.status === 201) {
        const releaseId = releaseRes.data.id;
        console.log('  Uploading exe...');
        const exeBuf = fs.readFileSync(exePath);
        const assetRes = await githubApi(
          'POST',
          `/repos/${OWNER}/${project.repo}/releases/${releaseId}/assets?name=${encodeURIComponent(file.sf)}`,
          null, exeBuf
        );
        if (assetRes.status === 201) {
          console.log('  Exe uploaded to release!');
        } else {
          console.log('  Upload failed: ' + (assetRes.data.message || assetRes.status));
        }
      } else {
        console.log('  Release failed: ' + (releaseRes.data.message || releaseRes.status));
      }
      fs.unlinkSync(exePath);
    }

    console.log('  DONE!');
  } catch (err) {
    console.error('  ERROR: ' + err.message.split('\n')[0]);
  } finally {
    if (fs.existsSync(tmpDir)) try { fs.rmSync(tmpDir, { recursive: true }); } catch (_) {}
  }
}

async function main() {
  console.log('Fill Remaining SF Repos');
  console.log('Owner: ' + OWNER);
  console.log('Projects: ' + PROJECTS.length);

  for (const project of PROJECTS) {
    await processProject(project);
    await sleep(1000);
  }

  console.log('\n=== ALL DONE ===');
}

main().catch(console.error);
