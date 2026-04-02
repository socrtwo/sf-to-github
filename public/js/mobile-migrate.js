'use strict';

/**
 * Mobile migration module for Capacitor (iOS/Android).
 *
 * Uses isomorphic-git (loaded via CDN in index.html) for git operations and
 * the GitHub REST API via fetch for repository management.
 * No backend server required — runs entirely on-device.
 *
 * Exposes window.MobileMigrate with:
 *   isPlatformMobile()         — true when running in Capacitor native shell
 *   planMigration(url, opts)   — dry-run, returns same shape as /api/plan
 *   migrateBatch(urls, token, opts, logFn) — migrate, same shape as /api/migrate/batch
 */
window.MobileMigrate = (function () {

  // ─── Platform Detection ───────────────────────────────────────────────────

  function isPlatformMobile() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform &&
              window.Capacitor.isNativePlatform());
  }

  // ─── SourceForge URL Parsing ──────────────────────────────────────────────
  // Mirrors the logic in src/detect.js without Node.js dependencies.

  function parseSourceForgeUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') {
      throw new Error('URL must be a non-empty string');
    }
    const trimmed = rawUrl.trim();

    // git.code.sf.net/p/{project}/{repo}
    if (/^(git:\/\/|https?:\/\/)git\.code\.sf\.net\//i.test(trimmed)) {
      const m = trimmed.match(/\/p\/([^/]+)/i);
      if (m) return { projectName: m[1], scmType: 'git' };
    }

    // svn.code.sf.net/p/{project}
    if (/^https?:\/\/svn\.code\.sf\.net\//i.test(trimmed)) {
      const m = trimmed.match(/\/p\/([^/]+)/i);
      if (m) return { projectName: m[1], scmType: 'svn' };
    }

    // Legacy SVN: {project}.svn.sourceforge.net
    const legacySvn = trimmed.match(/^https?:\/\/([^.]+)\.svn\.sourceforge\.net\//i);
    if (legacySvn) return { projectName: legacySvn[1], scmType: 'svn' };

    // sourceforge.net/projects/{name} or /p/{name}
    const sfMatch = trimmed.match(/sourceforge\.net\/(?:projects?|p)\/([^/?#]+)/i);
    if (sfMatch) {
      // Assume git when the URL is ambiguous (no svn/git subdomain)
      return { projectName: sfMatch[1], scmType: 'git-assumed' };
    }

    throw new Error('Unrecognized SourceForge URL: ' + rawUrl);
  }

  function getGitUrl(projectName) {
    return 'https://git.code.sf.net/p/' + projectName + '/code';
  }

  // ─── Repo Name Sanitization ───────────────────────────────────────────────

  function sanitizeRepoName(name) {
    return (name || '')
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '-')
      .replace(/^[.-]+/, '')
      .replace(/[.-]+$/, '')
      .replace(/-{2,}/g, '-')
      .slice(0, 100) || 'migrated-repo';
  }

  // ─── GitHub API via fetch ─────────────────────────────────────────────────

  async function githubFetch(method, apiPath, token, body) {
    const res = await fetch('https://api.github.com' + apiPath, {
      method: method,
      headers: Object.assign({
        'User-Agent': 'SF2GH-Migrator/1.0',
        'Accept': 'application/vnd.github+json',
        'Authorization': 'Bearer ' + token,
        'X-GitHub-Api-Version': '2022-11-28',
      }, body ? { 'Content-Type': 'application/json' } : {}),
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json().catch(function () { return {}; });
    if (!res.ok) {
      const err = new Error('GitHub API ' + res.status + ': ' + (data.message || res.statusText));
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  async function getAuthenticatedUser(token) {
    return githubFetch('GET', '/user', token);
  }

  async function createRepo(token, name, options) {
    options = options || {};
    const body = {
      name: name,
      description: 'Migrated from SourceForge via SF2GH Migrator',
      private: Boolean(options.isPrivate),
      auto_init: false,
      has_issues: true,
      has_projects: false,
      has_wiki: false,
    };
    const apiPath = options.org
      ? '/orgs/' + encodeURIComponent(options.org) + '/repos'
      : '/user/repos';
    return githubFetch('POST', apiPath, token, body);
  }

  async function repoExists(token, owner, name) {
    try {
      await githubFetch('GET', '/repos/' + encodeURIComponent(owner) + '/' + encodeURIComponent(name), token);
      return true;
    } catch (e) {
      if (e.status === 404) return false;
      throw e;
    }
  }

  // ─── isomorphic-git helpers ───────────────────────────────────────────────

  function getGitLibs() {
    if (!window.git) throw new Error('isomorphic-git not loaded. Ensure you have an internet connection and reload the app.');
    if (!window.LightningFS) throw new Error('LightningFS not loaded. Ensure you have an internet connection and reload the app.');
    if (!window.GitHttp) throw new Error('isomorphic-git HTTP module not loaded. Ensure you have an internet connection and reload the app.');
    return { git: window.git, LightningFS: window.LightningFS, http: window.GitHttp };
  }

  // ─── Git Migration via isomorphic-git ────────────────────────────────────

  async function migrateGitRepo(sourceUrl, token, owner, repoName, isPrivate, log) {
    const { git, LightningFS, http } = getGitLibs();

    // Create a fresh IndexedDB-backed filesystem for this migration
    const fs = new LightningFS('sf2gh-' + repoName + '-' + Date.now());
    const dir = '/repo';

    // Step 1: Create GitHub repository
    log('Creating GitHub repository ' + owner + '/' + repoName + '...');
    let repoData;
    const exists = await repoExists(token, owner, repoName);
    if (exists) {
      log('Repository already exists on GitHub, pushing into it.');
      repoData = { html_url: 'https://github.com/' + owner + '/' + repoName };
    } else {
      repoData = await createRepo(token, repoName, { isPrivate: isPrivate });
      log('Repository created: ' + repoData.html_url);
    }

    // Step 2: Clone from SourceForge (all branches + tags)
    log('Cloning from ' + sourceUrl + ' ...');
    log('(Large repositories may take several minutes)');
    await git.clone({
      fs: fs,
      http: http,
      dir: dir,
      url: sourceUrl,
      singleBranch: false,
      tags: true,
      onProgress: function (evt) {
        if (evt.phase) {
          var pct = evt.total ? Math.round((evt.loaded / evt.total) * 100) + '%' : evt.loaded + ' objects';
          log('[clone] ' + evt.phase + ' — ' + pct);
        }
      },
      onMessage: function (msg) {
        var trimmed = msg.trim();
        if (trimmed) log('[remote] ' + trimmed);
      },
    });
    log('Clone complete.');

    // Step 3: Discover all local branches and tags
    const branches = await git.listBranches({ fs: fs, dir: dir });
    const remoteBranches = await git.listBranches({ fs: fs, dir: dir, remote: 'origin' });
    const tags = await git.listTags({ fs: fs, dir: dir });
    log('Found ' + remoteBranches.length + ' branch(es) and ' + tags.length + ' tag(s)');

    const pushUrl = 'https://' + token + '@github.com/' + owner + '/' + repoName + '.git';
    const pushedSteps = [];

    // Step 4: Push each branch
    for (var bi = 0; bi < remoteBranches.length; bi++) {
      var branch = remoteBranches[bi];
      if (branch === 'HEAD') continue;
      log('Pushing branch: ' + branch);
      try {
        await git.push({
          fs: fs,
          http: http,
          dir: dir,
          url: pushUrl,
          ref: 'refs/remotes/origin/' + branch,
          remoteRef: 'refs/heads/' + branch,
          force: true,
          onAuth: function () { return { username: token, password: '' }; },
          onProgress: function (evt) {
            if (evt.phase) log('[push] ' + evt.phase);
          },
        });
        pushedSteps.push('push:' + branch);
      } catch (pushErr) {
        log('Warning: could not push branch ' + branch + ': ' + pushErr.message);
      }
    }

    // Step 5: Push each tag
    for (var ti = 0; ti < tags.length; ti++) {
      var tag = tags[ti];
      log('Pushing tag: ' + tag);
      try {
        await git.push({
          fs: fs,
          http: http,
          dir: dir,
          url: pushUrl,
          ref: 'refs/tags/' + tag,
          remoteRef: 'refs/tags/' + tag,
          force: true,
          onAuth: function () { return { username: token, password: '' }; },
        });
        pushedSteps.push('tag:' + tag);
      } catch (tagErr) {
        log('Warning: could not push tag ' + tag + ': ' + tagErr.message);
      }
    }

    log('Migration complete!');
    return {
      success: true,
      scmType: 'git',
      githubUrl: repoData.html_url,
      githubRepo: owner + '/' + repoName,
      steps: ['clone'].concat(pushedSteps),
    };
  }

  // ─── Dry Run (Plan) ───────────────────────────────────────────────────────

  async function planMigration(rawUrl, options) {
    options = options || {};
    const parsed = parseSourceForgeUrl(rawUrl);
    const repoName = sanitizeRepoName(options.repoName || parsed.projectName);
    const owner = options.owner || '(your GitHub username)';

    if (parsed.scmType === 'svn') {
      return {
        projectName: parsed.projectName,
        scmType: 'svn',
        sourceUrl: 'https://svn.code.sf.net/p/' + parsed.projectName + '/code',
        githubUrl: 'https://github.com/' + owner + '/' + repoName,
        steps: [
          {
            step: 'unsupported',
            description: 'SVN migration is not supported on mobile — use the desktop or web app',
            command: 'N/A',
          },
        ],
      };
    }

    const gitUrl = getGitUrl(parsed.projectName);
    const scmLabel = parsed.scmType === 'git-assumed' ? 'git (assumed from URL)' : 'git';

    return {
      projectName: parsed.projectName,
      scmType: scmLabel,
      sourceUrl: gitUrl,
      githubUrl: 'https://github.com/' + owner + '/' + repoName,
      steps: [
        {
          step: 'create-repo',
          description: 'Create GitHub repository: ' + owner + '/' + repoName,
          command: 'GitHub API POST /user/repos {"name":"' + repoName + '"}',
        },
        {
          step: 'clone',
          description: 'Clone all branches and tags from SourceForge into device storage',
          command: 'isomorphic-git clone --no-single-branch --tags ' + gitUrl,
        },
        {
          step: 'push-branches',
          description: 'Push all branches to GitHub',
          command: 'isomorphic-git push (each remote branch → github.com)',
        },
        {
          step: 'push-tags',
          description: 'Push all tags to GitHub',
          command: 'isomorphic-git push (each tag → github.com)',
        },
      ],
    };
  }

  // ─── Batch Migration ──────────────────────────────────────────────────────

  async function migrateBatch(urls, token, options, log) {
    options = options || {};

    log('Authenticating with GitHub...');
    const user = await getAuthenticatedUser(token);
    const owner = options.org || user.login;
    log('Signed in as: ' + user.login + (options.org ? ' (org: ' + options.org + ')' : ''));

    const results = [];
    for (var i = 0; i < urls.length; i++) {
      var rawUrl = urls[i];
      log('');
      log('─── [' + (i + 1) + '/' + urls.length + '] ' + rawUrl + ' ───');

      try {
        var parsed = parseSourceForgeUrl(rawUrl);

        if (parsed.scmType === 'svn') {
          log('SVN repositories are not supported on mobile.');
          log('To migrate this repo, use the desktop app or web version (requires a running server).');
          results.push({
            success: false,
            sourceUrl: rawUrl,
            error: 'SVN migration is not supported on mobile — use the desktop or web version',
          });
          continue;
        }

        var repoName = sanitizeRepoName(parsed.projectName);
        var gitUrl = getGitUrl(parsed.projectName);

        var result = await migrateGitRepo(
          gitUrl,
          token,
          owner,
          repoName,
          Boolean(options.isPrivate),
          function (msg) { log('  ' + msg); }
        );
        results.push(Object.assign({ sourceUrl: rawUrl }, result));

      } catch (err) {
        log('  Error: ' + err.message);
        if (err.message && err.message.toLowerCase().indexOf('cors') !== -1) {
          log('  Tip: This may be a CORS restriction. Try the desktop app for this repository.');
        }
        results.push({ success: false, sourceUrl: rawUrl, error: err.message });
      }
    }

    return { results: results };
  }

  // ─── SourceForge Profile Lookup (mobile — direct fetch) ──────────────────

  function parseSFUsername(rawInput) {
    if (!rawInput) return null;
    const s = rawInput.trim();
    const urlMatch = s.match(/sourceforge\.net\/(?:u(?:sers?)?|p)\/([^/?#\s]+)/i);
    if (urlMatch) return urlMatch[1].toLowerCase();
    if (/^[a-zA-Z0-9_.\-]+$/.test(s)) return s.toLowerCase();
    return null;
  }

  /**
   * Make an HTTP GET that returns parsed JSON.
   * On native Capacitor (iOS/Android), uses CapacitorHttp which makes
   * a real native HTTP call — bypasses WebView CORS restrictions entirely.
   * Falls back to window.fetch on web / desktop.
   */
  async function nativeGetJSON(url) {
    // CapacitorHttp is a built-in plugin in @capacitor/core v4+.
    // It is available via the Capacitor bridge without any extra import.
    var capHttp = window.Capacitor &&
                  window.Capacitor.Plugins &&
                  window.Capacitor.Plugins.CapacitorHttp;
    if (capHttp) {
      var resp = await capHttp.request({
        url: url,
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        responseType: 'json',
      });
      if (resp.status === 404) {
        var err = new Error('Not found (HTTP 404)');
        err.status = 404;
        throw err;
      }
      if (resp.status >= 400) {
        var e = new Error('HTTP ' + resp.status);
        e.status = resp.status;
        throw e;
      }
      // CapacitorHttp auto-parses JSON when responseType:'json'
      return typeof resp.data === 'string' ? JSON.parse(resp.data) : resp.data;
    }
    // Standard fetch path (web / Electron / browser)
    var res = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'SF2GH-Migrator/1.0' },
    });
    if (!res.ok) {
      var fe = new Error('HTTP ' + res.status);
      fe.status = res.status;
      throw fe;
    }
    return res.json();
  }

  async function lookupProfile(rawInput) {
    const username = parseSFUsername(rawInput);
    if (!username) throw new Error('Could not extract a SourceForge username from: ' + rawInput);

    const url = 'https://sourceforge.net/rest/u/' + encodeURIComponent(username) + '/profile';
    var data;
    try {
      data = await nativeGetJSON(url);
    } catch (e) {
      if (e.status === 404) throw new Error('SourceForge user "' + username + '" not found');
      throw new Error('SourceForge API error: ' + e.message +
        '. Check the username is correct at sourceforge.net/u/' + username + '/profile/');
    }
    const root = data.user || data;

    const seen = new Set();
    const repos = [];
    const addList = function (list) {
      if (!Array.isArray(list)) return;
      list.forEach(function (p) {
        var shortname = p.shortname || p.unix_name || p.name;
        if (!shortname || seen.has(shortname)) return;
        seen.add(shortname);
        repos.push({
          name: p.name || shortname,
          shortname: shortname,
          sfProjectUrl: 'https://sourceforge.net/projects/' + shortname + '/',
        });
      });
    };
    addList(root.projects);
    addList(root.developer_on);

    return { username: username, repos: repos };
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  return {
    isPlatformMobile: isPlatformMobile,
    planMigration: planMigration,
    migrateBatch: migrateBatch,
    lookupProfile: lookupProfile,
  };

})();
