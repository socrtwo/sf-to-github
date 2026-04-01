'use strict';

const { execFile } = require('child_process');
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
 * Probe a remote URL to check if it is a reachable Git repository.
 * Returns a promise that resolves to true/false.
 */
function probeGit(projectName) {
  if (!/^[a-zA-Z0-9._-]+$/.test(projectName)) {
    return Promise.resolve(false);
  }
  const gitUrl = `https://git.code.sf.net/p/${projectName}/code`;
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
function probeSvn(projectName) {
  if (!/^[a-zA-Z0-9._-]+$/.test(projectName)) {
    return Promise.resolve(false);
  }
  const svnUrl = `https://svn.code.sf.net/p/${projectName}/code`;
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
 * Detect the SCM type for a SourceForge project.
 * First checks the URL pattern for hints, then probes the remote.
 * Returns { projectName, scmType, gitUrl?, svnUrl? }
 */
async function detect(rawUrl) {
  const { projectName, scmHint } = parseSourceForgeUrl(rawUrl);

  if (scmHint === ScmType.GIT) {
    return {
      projectName,
      scmType: ScmType.GIT,
      gitUrl: `https://git.code.sf.net/p/${projectName}/code`,
    };
  }

  if (scmHint === ScmType.SVN) {
    return {
      projectName,
      scmType: ScmType.SVN,
      svnUrl: `https://svn.code.sf.net/p/${projectName}/code`,
    };
  }

  // No hint — probe both
  const [isGit, isSvn] = await Promise.all([
    probeGit(projectName),
    probeSvn(projectName),
  ]);

  if (isGit) {
    return {
      projectName,
      scmType: ScmType.GIT,
      gitUrl: `https://git.code.sf.net/p/${projectName}/code`,
    };
  }

  if (isSvn) {
    return {
      projectName,
      scmType: ScmType.SVN,
      svnUrl: `https://svn.code.sf.net/p/${projectName}/code`,
    };
  }

  return { projectName, scmType: ScmType.UNKNOWN };
}

module.exports = { detect, parseSourceForgeUrl, probeGit, probeSvn, ScmType };
