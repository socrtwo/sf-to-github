#!/usr/bin/env node
'use strict';

/**
 * Transfer SF executables to GitHub releases and extract source where available.
 *
 * Usage: cd ~/sf-to-github
 *        GITHUB_TOKEN=ghp_YOUR_TOKEN node scripts/transfer-sf-exes.js
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
    repo: 'oorecovery-SF',
    sfProject: 'oorecovery',
    name: 'Corrupt Open Office Recovery',
    exe: 'open_office_salvager_1.3.0_setup_without_adware.exe',
    source: null,
    version: 'v1.3.0',
    desc: 'Recovers text and data from corrupt OpenOffice/LibreOffice documents.',
  },
  {
    repo: 'pptxrecovery-SF',
    sfProject: 'pptxrecovery',
    name: 'Corrupt PPTX Salvager',
    exe: 'corrupt_pptx_salvager_setup_1.0.3_without_adware.exe',
    source: null,
    version: 'v1.0.3',
    desc: 'Extracts text and images from corrupt PowerPoint PPTX files.',
  },
  {
    repo: 'coffice2txt-SF',
    sfProject: 'coffice2txt',
    name: 'Corrupt Office File Salvager',
    exe: 'corrupt_office_salvager_setup_1.0.3_without_adware.exe',
    source: 'corrupt_office_salvager_setup_1.0.3_source.zip',
    version: 'v1.0.3',
    desc: 'Salvages text from corrupt Microsoft Office files (DOCX, XLSX, PPTX).',
  },
  {
    repo: 'damageddocx2txt-SF',
    sfProject: 'damageddocx2txt',
    name: 'Corrupt DOCX Salvager',
    exe: 'corrupt_docx_salvager_setup_2.0.4_without_adware.exe',
    source: 'Corrupt_DOCX_Salvager_Source.pl',
    version: 'v2.0.4',
    desc: 'Extracts text from corrupt Word DOCX files using Perl-based XML parsing.',
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
  } catch (err) {
    try { fs.unlinkSync(tmpPage); } catch (_) {}
    try { fs.unlinkSync(tmpFile); } catch (_) {}
    throw err;
  } finally {
    try { fs.unlinkSync(tmpPage); } catch (_) {}
  }
}

function githubApi(method, apiPath, body, binary) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: apiPath,
      method: method,
      headers: {
        'User-Agent': 'SF2GH-Migrator/1.0',
        'Authorization': 'Bearer ' + TOKEN,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    };
    if (binary) {
      options.hostname = 'uploads.github.com';
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

  const tmpDir = path.join(os.tmpdir(), 'sf-exe-' + project.repo);
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    // Step 1: If there's source code, clone repo, extract, commit, push
    if (project.source) {
      console.log('  Step 1: Extracting source code...');
      const cloneUrl = `https://${TOKEN}@github.com/${OWNER}/${project.repo}.git`;
      const repoDir = path.join(tmpDir, 'repo');
      run(`git clone "${cloneUrl}" "${repoDir}"`);

      // Check if already has content beyond README
      const files = fs.readdirSync(repoDir).filter(f => f !== '.git');
      const hasContent = files.some(f => f !== 'README.md' && f !== 'readme.txt');

      if (!hasContent) {
        // Download source from SF
        const srcFile = downloadFromSF(project.sfProject, project.source);
        const ext = project.source.toLowerCase();

        if (ext.endsWith('.zip')) {
          const extractDir = path.join(tmpDir, 'extracted');
          fs.mkdirSync(extractDir, { recursive: true });
          run(`unzip -o -q "${srcFile}" -d "${extractDir}"`);

          // Flatten single subdir
          const entries = fs.readdirSync(extractDir);
          let srcRoot = extractDir;
          if (entries.length === 1 && fs.statSync(path.join(extractDir, entries[0])).isDirectory()) {
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
        } else {
          // Single source file (e.g. .pl)
          fs.copyFileSync(srcFile, path.join(repoDir, project.source));
        }
        try { fs.unlinkSync(srcFile); } catch (_) {}

        // Add .gitignore and LICENSE if missing
        if (!fs.existsSync(path.join(repoDir, '.gitignore'))) {
          fs.writeFileSync(path.join(repoDir, '.gitignore'), '*.exe\n*.msi\n.DS_Store\nThumbs.db\n');
        }
        if (!fs.existsSync(path.join(repoDir, 'LICENSE'))) {
          fs.writeFileSync(path.join(repoDir, 'LICENSE'),
            `MIT License\n\nCopyright (c) ${new Date().getFullYear()} Paul D Pruitt\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the "Software"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE.\n`);
        }

        // Update README
        const readme = `# ${project.name}\n\n${project.desc}\n\n**Language:** See source files\n\n## Origin\n\nMigrated from [SourceForge](https://sourceforge.net/projects/${project.sfProject}/) via [SF2GH Migrator](https://github.com/socrtwo/sf-to-github).\n\n## Downloads\n\nSee the [Releases](https://github.com/${OWNER}/${project.repo}/releases) page for the installer (.exe).\n\n## License\n\nMIT License\n`;
        fs.writeFileSync(path.join(repoDir, 'README.md'), readme);

        run('git config user.name "SF2GH Migrator"', { cwd: repoDir });
        run('git config user.email "sf2gh@localhost"', { cwd: repoDir });
        run('git add -A', { cwd: repoDir });
        const status = run('git status --porcelain', { cwd: repoDir });
        if (status) {
          run('git commit -m "Add source code and README from SourceForge"', { cwd: repoDir });
          run('git push origin main', { cwd: repoDir });
          console.log('  Source committed and pushed.');
        }
      } else {
        console.log('  Repo already has content, skipping source extraction.');
      }
    } else {
      // No source — just make sure repo has a README
      console.log('  No source code available (exe only).');
      const readmeContent = `# ${project.name}\n\n${project.desc}\n\n**Note:** This project has no published source code. The installer (.exe) is available in the [Releases](https://github.com/${OWNER}/${project.repo}/releases) section.\n\n## Origin\n\nMigrated from [SourceForge](https://sourceforge.net/projects/${project.sfProject}/).\n\n## Downloads\n\nSee the [Releases](https://github.com/${OWNER}/${project.repo}/releases) page.\n`;

      // Update README via API
      const getRes = await githubApi('GET', `/repos/${OWNER}/${project.repo}/contents/README.md`);
      const sha = getRes.data.sha || null;
      const body = {
        message: 'Update README with project description',
        content: Buffer.from(readmeContent).toString('base64'),
        branch: 'main',
      };
      if (sha) body.sha = sha;
      await githubApi('PUT', `/repos/${OWNER}/${project.repo}/contents/README.md`, body);
      console.log('  README updated.');
    }

    // Step 2: Download exe from SF
    console.log('  Step 2: Downloading exe from SourceForge...');
    let exePath;
    try {
      exePath = downloadFromSF(project.sfProject, project.exe);
    } catch (dlErr) {
      console.log('  Download failed: ' + dlErr.message);
      return;
    }

    const exeSize = fs.statSync(exePath).size;
    console.log('  Downloaded: ' + (exeSize / 1024 / 1024).toFixed(1) + ' MB');

    // Step 3: Create GitHub release
    console.log('  Step 3: Creating GitHub release ' + project.version + '...');

    // Delete existing release with same tag if any
    const existingRes = await githubApi('GET', `/repos/${OWNER}/${project.repo}/releases/tags/${project.version}`);
    if (existingRes.status === 200 && existingRes.data.id) {
      await githubApi('DELETE', `/repos/${OWNER}/${project.repo}/releases/${existingRes.data.id}`);
      await sleep(1000);
    }

    const releaseRes = await githubApi('POST', `/repos/${OWNER}/${project.repo}/releases`, {
      tag_name: project.version,
      name: project.name + ' ' + project.version,
      body: `## ${project.name}\n\n${project.desc}\n\nMigrated from [SourceForge](https://sourceforge.net/projects/${project.sfProject}/).\n\n### Download\n\nDownload the installer below and run it on Windows.`,
      draft: false,
      prerelease: false,
    });

    if (releaseRes.status !== 201) {
      console.log('  Release creation failed: ' + (releaseRes.data.message || releaseRes.status));
      fs.unlinkSync(exePath);
      return;
    }

    const releaseId = releaseRes.data.id;
    const uploadUrl = releaseRes.data.upload_url.replace('{?name,label}', '');
    console.log('  Release created. Uploading exe...');

    // Step 4: Upload exe as release asset
    const exeBuffer = fs.readFileSync(exePath);
    const assetRes = await githubApi(
      'POST',
      `/repos/${OWNER}/${project.repo}/releases/${releaseId}/assets?name=${encodeURIComponent(project.exe)}`,
      null,
      exeBuffer
    );

    if (assetRes.status === 201) {
      console.log('  Exe uploaded to release!');
    } else {
      console.log('  Upload failed: ' + (assetRes.data.message || assetRes.status));
    }

    fs.unlinkSync(exePath);
    console.log('  DONE!');

  } catch (err) {
    console.error('  ERROR: ' + err.message.split('\n')[0]);
  } finally {
    if (fs.existsSync(tmpDir)) try { fs.rmSync(tmpDir, { recursive: true }); } catch (_) {}
  }
}

async function main() {
  console.log('Transfer SF Executables to GitHub Releases');
  console.log('Owner: ' + OWNER);
  console.log('Projects: ' + PROJECTS.length);

  for (const project of PROJECTS) {
    await processProject(project);
    await sleep(1000);
  }

  console.log('\n=== ALL DONE ===');
}

main().catch(console.error);
