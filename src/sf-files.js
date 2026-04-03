'use strict';

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const http = require('http');
const logger = require('./logger');

/**
 * Download a file from a URL to a local path.
 * Follows redirects (SourceForge uses several).
 */
function downloadFile(url, destPath, maxRedirects) {
  if (maxRedirects === undefined) maxRedirects = 10;
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error('Too many redirects'));
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers: { 'User-Agent': 'SF2GH-Migrator/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let next = res.headers.location;
        if (next.startsWith('/')) {
          const parsed = new URL(url);
          next = parsed.protocol + '//' + parsed.host + next;
        }
        res.resume();
        return resolve(downloadFile(next, destPath, maxRedirects - 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`Download failed: HTTP ${res.statusCode}`));
      }
      const file = fs.createWriteStream(destPath);
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
      file.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(120000, () => { req.destroy(); reject(new Error('Download timeout')); });
  });
}

/**
 * Fetch JSON from a URL (follows redirects).
 */
function fetchJSON(url, maxRedirects) {
  if (maxRedirects === undefined) maxRedirects = 5;
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error('Too many redirects'));
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'SF2GH-Migrator/1.0' },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        let next = res.headers.location;
        if (next.startsWith('/')) {
          const parsed = new URL(url);
          next = parsed.protocol + '//' + parsed.host + next;
        }
        return resolve(fetchJSON(next, maxRedirects - 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Invalid JSON response')); }
      });
    }).on('error', reject);
  });
}

/**
 * List downloadable files from a SourceForge project's Files section.
 * Uses the Allura REST API: /rest/p/{project}/files/
 * Returns array of { name, url, size }
 */
async function listSFFiles(projectName) {
  const files = [];

  // Try the REST API for the file release system
  const apiUrl = `https://sourceforge.net/rest/p/${encodeURIComponent(projectName)}/`;
  try {
    const data = await fetchJSON(apiUrl);
    // Check for 'files' or 'categories' in the project tools
    if (data.tools) {
      const filesTool = data.tools.find(t =>
        t.name === 'files' || t.mount_point === 'files'
      );
      if (filesTool) {
        // Query the files endpoint
        const filesUrl = `https://sourceforge.net/rest/p/${encodeURIComponent(projectName)}/files/`;
        try {
          const filesData = await fetchJSON(filesUrl);
          if (filesData && Array.isArray(filesData.files)) {
            for (const f of filesData.files) {
              if (f.url) {
                files.push({
                  name: f.name || path.basename(f.url),
                  url: f.url.startsWith('/') ? 'https://sourceforge.net' + f.url : f.url,
                  size: f.size || 0,
                });
              }
            }
          }
        } catch (_) { /* files endpoint may not exist */ }
      }
    }
  } catch (_) { /* project API may fail */ }

  // Fallback: scrape the RSS feed for download links
  if (files.length === 0) {
    const rssUrl = `https://sourceforge.net/projects/${encodeURIComponent(projectName)}/rss?path=/`;
    try {
      const rssText = await new Promise((resolve, reject) => {
        https.get(rssUrl, { headers: { 'User-Agent': 'SF2GH-Migrator/1.0' } }, (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => resolve(data));
        }).on('error', reject);
      });

      const itemRegex = /<item>[\s\S]*?<link>([\s\S]*?)<\/link>[\s\S]*?<\/item>/gi;
      let match;
      while ((match = itemRegex.exec(rssText)) !== null) {
        const fileUrl = match[1].trim();
        if (fileUrl && fileUrl.indexOf('/download') !== -1) {
          const parts = fileUrl.split('/').filter(p => p && p !== 'download');
          const fileName = decodeURIComponent(parts[parts.length - 1] || 'unknown');
          files.push({ name: fileName, url: fileUrl, size: 0 });
        }
      }
    } catch (_) { /* RSS may fail */ }
  }

  return files;
}

/**
 * Extract an archive file (zip or tar.gz/tgz/tar.bz2).
 * Returns the extraction directory path.
 */
async function extractArchive(archivePath, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  const ext = archivePath.toLowerCase();

  if (ext.endsWith('.zip')) {
    await runCmd('unzip', ['-o', '-q', archivePath, '-d', destDir]);
  } else if (ext.endsWith('.tar.gz') || ext.endsWith('.tgz')) {
    await runCmd('tar', ['xzf', archivePath, '-C', destDir]);
  } else if (ext.endsWith('.tar.bz2') || ext.endsWith('.tbz2')) {
    await runCmd('tar', ['xjf', archivePath, '-C', destDir]);
  } else if (ext.endsWith('.tar')) {
    await runCmd('tar', ['xf', archivePath, '-C', destDir]);
  } else {
    // Not an archive — just copy the file into destDir
    fs.copyFileSync(archivePath, path.join(destDir, path.basename(archivePath)));
  }
  return destDir;
}

function runCmd(cmd, args, opts) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 300000, ...opts }, (err, stdout, stderr) => {
      if (err) reject(err);
      else resolve({ stdout, stderr });
    });
  });
}

/**
 * Flatten a directory — if it contains a single subdirectory, move contents up.
 * Many release archives contain a top-level folder like "project-1.0/".
 */
function flattenSingleSubdir(dir) {
  const entries = fs.readdirSync(dir);
  if (entries.length === 1) {
    const child = path.join(dir, entries[0]);
    if (fs.statSync(child).isDirectory()) {
      // Move all contents of the single subdirectory up
      const childEntries = fs.readdirSync(child);
      for (const e of childEntries) {
        fs.renameSync(path.join(child, e), path.join(dir, e));
      }
      fs.rmdirSync(child);
    }
  }
}

/**
 * Populate an empty SourceForge Code/git tab with files from the Files section.
 *
 * Steps:
 *   1. Download release files from SF Files tab
 *   2. Extract archives (zip/tar)
 *   3. git init + add + commit
 *   4. git push to SF Code tab via HTTPS with username
 *
 * @param {string} projectName - SF project short name
 * @param {string} sfUsername  - SF username for HTTPS push
 * @param {object} opts        - { onLog: fn }
 * @returns {object}           - { success, filesCount, message }
 */
async function populateSFCodeTab(projectName, sfUsername, opts = {}) {
  const log = opts.onLog || (() => {});

  // Step 1: List available files
  log('Listing files in SF Files section...');
  const sfFiles = await listSFFiles(projectName);
  if (sfFiles.length === 0) {
    return { success: false, filesCount: 0, message: 'No files found in SF Files section' };
  }
  log(`Found ${sfFiles.length} file(s) in Files section.`);

  // Step 2: Create temp directories
  const tmpBase = path.join(os.tmpdir(), `sf2gh-populate-${projectName}-${Date.now()}`);
  const downloadDir = path.join(tmpBase, 'downloads');
  const extractDir = path.join(tmpBase, 'extracted');
  const repoDir = path.join(tmpBase, 'repo');
  fs.mkdirSync(downloadDir, { recursive: true });
  fs.mkdirSync(extractDir, { recursive: true });

  try {
    // Step 3: Download files (limit to source-like files, skip large binaries)
    const sourceExtensions = [
      '.zip', '.tar.gz', '.tgz', '.tar.bz2', '.tar',
      '.txt', '.md', '.rst', '.readme',
      '.c', '.h', '.cpp', '.py', '.java', '.js', '.ts',
      '.html', '.css', '.xml', '.json', '.yml', '.yaml',
      '.sh', '.bat', '.cmd', '.pl', '.rb', '.go', '.rs',
      '.cs', '.vb', '.php', '.sql', '.r', '.m', '.swift',
    ];

    const filesToDownload = sfFiles.filter(f => {
      const lower = f.name.toLowerCase();
      return sourceExtensions.some(ext => lower.endsWith(ext)) ||
             lower.includes('readme') || lower.includes('license') ||
             lower.includes('changelog') || lower.includes('source');
    });

    if (filesToDownload.length === 0) {
      // Fall back to all files but skip obvious binaries
      const binaryExtensions = ['.exe', '.msi', '.dmg', '.rpm', '.deb', '.apk', '.ipa', '.appimage'];
      filesToDownload.push(...sfFiles.filter(f => {
        const lower = f.name.toLowerCase();
        return !binaryExtensions.some(ext => lower.endsWith(ext));
      }));
    }

    if (filesToDownload.length === 0) {
      return { success: false, filesCount: 0, message: 'No source files found (only binaries)' };
    }

    // Download up to 20 files max to avoid huge downloads
    const toDownload = filesToDownload.slice(0, 20);
    for (let i = 0; i < toDownload.length; i++) {
      const f = toDownload[i];
      const dest = path.join(downloadDir, f.name);
      log(`Downloading [${i + 1}/${toDownload.length}]: ${f.name}`);
      try {
        await downloadFile(f.url, dest);
      } catch (dlErr) {
        log(`  Warning: failed to download ${f.name}: ${dlErr.message}`);
      }
    }

    // Step 4: Extract archives into extractDir
    const downloaded = fs.readdirSync(downloadDir);
    log(`Extracting ${downloaded.length} file(s)...`);
    for (const fname of downloaded) {
      const fpath = path.join(downloadDir, fname);
      const lower = fname.toLowerCase();
      if (lower.endsWith('.zip') || lower.endsWith('.tar.gz') || lower.endsWith('.tgz') ||
          lower.endsWith('.tar.bz2') || lower.endsWith('.tar')) {
        try {
          await extractArchive(fpath, extractDir);
        } catch (exErr) {
          log(`  Warning: failed to extract ${fname}: ${exErr.message}`);
          // Copy as-is
          fs.copyFileSync(fpath, path.join(extractDir, fname));
        }
      } else {
        // Non-archive files: copy directly
        fs.copyFileSync(fpath, path.join(extractDir, fname));
      }
    }

    // Flatten single subdirectory (e.g. "project-1.0/src" → "src")
    flattenSingleSubdir(extractDir);

    // Count extracted files
    const extractedFiles = fs.readdirSync(extractDir);
    if (extractedFiles.length === 0) {
      return { success: false, filesCount: 0, message: 'No files extracted from downloads' };
    }
    log(`Extracted ${extractedFiles.length} item(s).`);

    // Step 5: Initialize git repo and add files
    log('Initializing git repo and adding files...');
    await runCmd('git', ['init'], { cwd: extractDir });
    await runCmd('git', ['add', '.'], { cwd: extractDir });
    await runCmd('git', [
      '-c', 'user.name=SF2GH Migrator',
      '-c', 'user.email=sf2gh@localhost',
      'commit', '-m', `Import files from SourceForge Files section\n\nExtracted from release downloads for project: ${projectName}`,
    ], { cwd: extractDir });

    // Step 6: Push to SF Code tab via HTTPS
    const pushUrl = `https://${encodeURIComponent(sfUsername)}@git.code.sf.net/p/${encodeURIComponent(projectName)}/code`;
    log(`Pushing to SF Code tab: ${pushUrl.replace(/\/\/[^@]+@/, '//***@')}`);
    await runCmd('git', ['remote', 'add', 'origin', pushUrl], { cwd: extractDir });
    await runCmd('git', ['push', '-u', 'origin', 'main'], { cwd: extractDir });
    log('Successfully populated SF Code tab!');

    return { success: true, filesCount: extractedFiles.length, message: 'Code tab populated' };
  } finally {
    // Cleanup temp directories
    try { fs.rmSync(tmpBase, { recursive: true, force: true }); } catch (_) {}
  }
}

module.exports = {
  listSFFiles,
  downloadFile,
  extractArchive,
  populateSFCodeTab,
};
