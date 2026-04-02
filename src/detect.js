'use strict';

const { execFile } = require('child_process');
const https = require('https');
const { URL } = require('url');

const SF_HOST = 'sourceforge.net';

/**
 * Supported SCM types.
 */
const ScmType = Object.freeze({
  GIT: 'git',
  SVN: 'svn',
  UNKNOWN: 'unknown',
});

/**
 * Validate and parse a SourceForge URL.
 * Accepts formats like:
 *   https://sourceforge.net/projects/<name>/
 *   https://sourceforge.net/p/<name>/code/
 *   https://svn.code.sf.net/p/<name>/code/
 *   https://<name>.svn.sourceforge.net/svnroot/<name>/
 *   git://git.code.sf.net/p/<name>/code
 *   https://git.code.sf.net/p/<name>/code
 *
 * Returns { projectName, scmHint } or throws.
 */
function parseSourceForgeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new Error('URL must be a non-empty string');
  }

  const trimmed = rawUrl.trim();

  // Detect scm hint from subdomain patterns
  if (/^(git:\/\/|https?:\/\/)git\.code\.sf\.net\//i.test(trimmed)) {
    const match = trimmed.match(/\/p\/([^/]+)/i);
    if (match) {
      return { projectName: match[1], scmHint: ScmType.GIT };
    }
  }

  if (/^https?:\/\/svn\.code\.sf\.net\//i.test(trimmed)) {
    const match = trimmed.match(/\/p\/([^/]+)/i);
    if (match) {
      return { projectName: match[1], scmHint: ScmType.SVN };
    }
  }

  // Legacy SVN format: https://<name>.svn.sourceforge.net/
  const legacySvn = trimmed.match(
    /^https?:\/\/([^.]+)\.svn\.sourceforge\.net\//i
  );
  if (legacySvn) {
    return { projectName: legacySvn[1], scmHint: ScmType.SVN };
  }

  // Standard project URLs: https://sourceforge.net/projects/<name>/ or /p/<name>/
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`Invalid URL: ${trimmed}`);
  }

  if (parsed.hostname !== SF_HOST && !parsed.hostname.endsWith(`.${SF_HOST}`)) {
    throw new Error(
      `Not a SourceForge URL (expected hostname ${SF_HOST})`
    );
  }

  const projectsMatch = parsed.pathname.match(
    /^\/(projects|p)\/([^/]+)/i
  );
  if (projectsMatch) {
    return { projectName: projectsMatch[2], scmHint: null };
  }

  throw new Error(
    `Cannot extract project name from URL: ${trimmed}`
  );
}

/**
 * Fetch the list of SCM tools for a SourceForge project via the REST API.
 * Returns an array of { scmType, mountPoint } objects.
 * Falls back to an empty array on network errors.
 */
function discoverTools(projectName) {
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: 'sourceforge.net',
        path: '/rest/p/' + encodeURIComponent(projectName),
        method: 'GET',
        headers: {
          'User-Agent': 'SF2GH-Migrator/1.0',
          Accept: 'application/json',
        },
      },
      (res) => {
        if (res.statusCode !== 200) {
          return resolve([]);
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          try {
            const data = JSON.parse(Buffer.concat(chunks).toString());
            const tools = data.tools || [];
            const scmTools = [];
            for (const t of tools) {
              const name = (t.name || '').toLowerCase();
              const mount = t.mount_point;
              if (!mount) continue;
              if (name === 'git') {
                scmTools.push({ scmType: ScmType.GIT, mountPoint: mount });
              } else if (name === 'svn') {
                scmTools.push({ scmType: ScmType.SVN, mountPoint: mount });
              } else if (name === 'hg') {
                scmTools.push({ scmType: 'hg', mountPoint: mount });
              }
            }
            resolve(scmTools);
          } catch {
            resolve([]);
          }
        });
      }
    );
    req.on('error', () => resolve([]));
    req.setTimeout(15000, () => { req.destroy(); resolve([]); });
    req.end();
  });
}

/**
 * Probe a remote URL to check if it is a reachable Git repository.
 * Returns a promise that resolves to true/false.
 */
function probeGit(projectName, mountPoint) {
  if (!/^[a-zA-Z0-9._-]+$/.test(projectName)) {
    return Promise.resolve(false);
  }
  const gitUrl = `https://git.code.sf.net/p/${projectName}/${mountPoint}`;
  return new Promise((resolve) => {
    execFile(
      'git',
      ['ls-remote', '--exit-code', '--heads', gitUrl],
      { timeout: 30000 },
      (err) => resolve(!err)
    );
  });
}

/**
 * Probe a remote URL to check if it is a reachable SVN repository.
 * Returns a promise that resolves to true/false.
 */
function probeSvn(projectName, mountPoint) {
  if (!/^[a-zA-Z0-9._-]+$/.test(projectName)) {
    return Promise.resolve(false);
  }
  const svnUrl = `https://svn.code.sf.net/p/${projectName}/${mountPoint}`;
  return new Promise((resolve) => {
    execFile(
      'svn',
      ['info', '--non-interactive', svnUrl],
      { timeout: 30000 },
      (err) => resolve(!err)
    );
  });
}

/**
 * Extract the mount point from a SourceForge SCM URL.
 * e.g. "https://git.code.sf.net/p/myproject/code" → "code"
 *      "https://svn.code.sf.net/p/myproject/trunk" → "trunk"
 */
function extractMountPoint(rawUrl) {
  const m = rawUrl.match(/\.(?:code\.)?sf\.net\/p\/[^/]+\/([^/?#]+)/i);
  return m ? m[1] : 'code';
}

/**
 * Detect the SCM type for a SourceForge project.
 * First checks the URL pattern for hints, then queries the SourceForge
 * REST API to discover available SCM tools and their mount points.
 * Falls back to probing common mount points if the API is unavailable.
 * Returns { projectName, scmType, gitUrl?, svnUrl? }
 */
async function detect(rawUrl) {
  const { projectName, scmHint } = parseSourceForgeUrl(rawUrl);

  // If the URL explicitly specifies an SCM subdomain, extract mount point from URL
  if (scmHint === ScmType.GIT) {
    const mount = extractMountPoint(rawUrl);
    return {
      projectName,
      scmType: ScmType.GIT,
      gitUrl: `https://git.code.sf.net/p/${projectName}/${mount}`,
    };
  }

  if (scmHint === ScmType.SVN) {
    const mount = extractMountPoint(rawUrl);
    return {
      projectName,
      scmType: ScmType.SVN,
      svnUrl: `https://svn.code.sf.net/p/${projectName}/${mount}`,
    };
  }

  // No hint — query SourceForge REST API to discover available SCM tools
  const tools = await discoverTools(projectName);

  // Try git tools first, then svn
  for (const tool of tools) {
    if (tool.scmType === ScmType.GIT) {
      return {
        projectName,
        scmType: ScmType.GIT,
        gitUrl: `https://git.code.sf.net/p/${projectName}/${tool.mountPoint}`,
      };
    }
  }
  for (const tool of tools) {
    if (tool.scmType === ScmType.SVN) {
      return {
        projectName,
        scmType: ScmType.SVN,
        svnUrl: `https://svn.code.sf.net/p/${projectName}/${tool.mountPoint}`,
      };
    }
  }

  // API returned no SCM tools — fall back to probing common mount points
  const commonMounts = ['code', 'git', 'svn', projectName];
  for (const mount of commonMounts) {
    const isGit = await probeGit(projectName, mount);
    if (isGit) {
      return {
        projectName,
        scmType: ScmType.GIT,
        gitUrl: `https://git.code.sf.net/p/${projectName}/${mount}`,
      };
    }
  }
  for (const mount of commonMounts) {
    const isSvn = await probeSvn(projectName, mount);
    if (isSvn) {
      return {
        projectName,
        scmType: ScmType.SVN,
        svnUrl: `https://svn.code.sf.net/p/${projectName}/${mount}`,
      };
    }
  }

  return { projectName, scmType: ScmType.UNKNOWN };
}

module.exports = { detect, discoverTools, parseSourceForgeUrl, probeGit, probeSvn, ScmType };
