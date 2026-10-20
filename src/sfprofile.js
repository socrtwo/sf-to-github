'use strict';

const https = require('https');

/**
 * Parse a SourceForge profile URL or plain username into a username string.
 * Accepts:
 *   https://sourceforge.net/u/USERNAME/profile/
 *   https://sourceforge.net/users/USERNAME/
 *   https://sourceforge.net/u/USERNAME
 *   USERNAME  (plain)
 */
function parseSFUsername(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') return null;
  const s = rawInput.trim();

  // URL forms
  const urlMatch = s.match(/sourceforge\.net\/(?:u(?:sers?)?|p)\/([^/?#\s]+)/i);
  if (urlMatch) return urlMatch[1].toLowerCase();

  // Plain username: alphanumeric + _ - .
  if (/^[a-zA-Z0-9_.\-]+$/.test(s)) return s.toLowerCase();

  return null;
}

/**
 * Fetch a SourceForge user's profile from the Allura REST API.
 * Returns the raw JSON object.
 */
function fetchSFProfile(username) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'sourceforge.net',
        path: '/rest/u/' + encodeURIComponent(username) + '/profile',
        method: 'GET',
        headers: {
          'User-Agent': 'SF2GH-Migrator/1.0',
          Accept: 'application/json',
        },
      },
      (res) => {
        if (res.statusCode === 404) {
          return reject(new Error('SourceForge user "' + username + '" not found'));
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString()));
          } catch {
            reject(new Error('Invalid JSON from SourceForge API'));
          }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error('SourceForge API request timed out')));
    req.end();
  });
}

/**
 * Extract repository info from a SourceForge profile response.
 * Returns an array of { name, shortname, url, sfProjectUrl } objects.
 */
function extractRepos(profileData) {
  const seen = new Set();
  const repos = [];

  const addProjects = (list) => {
    if (!Array.isArray(list)) return;
    for (const p of list) {
      // Allura API often omits shortname/unix_name but includes the canonical URL.
      // Extract slug from URL first, then explicit fields, then slugify display name.
      let shortname = p.shortname || p.unix_name || p.id;
      if (!shortname && p.url) {
        const m = String(p.url).match(/sourceforge\.net\/p(?:rojects?)?\/([^/?#\s]+)/i);
        if (m) shortname = decodeURIComponent(m[1]);
      }
      if (!shortname && p.name) {
        shortname = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      }
      if (!shortname || seen.has(shortname)) continue;
      seen.add(shortname);
      // p.url from the Allura API is often a relative path like /p/slug/
      const canonicalUrl = p.url
        ? (String(p.url).startsWith('/') ? 'https://sourceforge.net' + p.url : String(p.url))
        : null;
      repos.push({
        name: p.name || shortname,
        shortname: shortname,
        sfProjectUrl: canonicalUrl || ('https://sourceforge.net/p/' + shortname + '/'),
      });
    }
  };

  // The Allura API nests data inside a top-level key named after the username,
  // or directly in the root.  Handle both.
  const root = profileData.user || profileData;
  addProjects(root.projects);
  addProjects(root.developer_on);

  return repos;
}

module.exports = { parseSFUsername, fetchSFProfile, extractRepos };
