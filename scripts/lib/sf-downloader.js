'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Download a file from SourceForge using two-step mirror resolution.
 * @param {Function} run - Shell runner from createRunner()
 * @param {string} sfProject - SourceForge project slug
 * @param {string} fileName - File name on SourceForge
 * @param {Object} [opts]
 * @param {number} [opts.downloadTimeout=600] - curl max-time in seconds
 * @returns {string} Path to downloaded temp file (caller must clean up)
 */
function downloadFromSF(run, sfProject, fileName, opts = {}) {
  const downloadTimeout = opts.downloadTimeout || 600;
  const cmdTimeout = (downloadTimeout + 60) * 1000;

  const pageUrl = `https://sourceforge.net/projects/${sfProject}/files/${encodeURIComponent(fileName)}/download`;
  const tmpPage = path.join(os.tmpdir(), 'sf-page-' + Date.now() + '.html');
  const tmpFile = path.join(os.tmpdir(), 'sf-dl-' + Date.now() + '.bin');

  try {
    run(`curl -s -o "${tmpPage}" -A "Mozilla/5.0" "${pageUrl}"`, { timeout: 30000 });
    const html = fs.readFileSync(tmpPage, 'utf8');
    const match = html.match(/https:\/\/downloads\.sourceforge\.net\/[^"&]+/);
    if (!match) throw new Error('No mirror URL found for ' + fileName);
    const directUrl = match[0].replace(/&amp;/g, '&');

    console.log('  Downloading ' + fileName + '...');
    run(`curl -L -o "${tmpFile}" -A "Mozilla/5.0" --max-redirs 10 --connect-timeout 30 --max-time ${downloadTimeout} "${directUrl}"`,
      { timeout: cmdTimeout });

    if (!fs.existsSync(tmpFile)) throw new Error('Download produced no file');
    return tmpFile;
  } finally {
    try { fs.unlinkSync(tmpPage); } catch (_) {}
  }
}

module.exports = { downloadFromSF };
