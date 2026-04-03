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
    // encodeURIComponent handles any residual spaces or special chars safely
    return 'https://git.code.sf.net/p/' + encodeURIComponent(projectName) + '/code';
  }

  function getSshGitUrl(projectName) {
    return 'ssh://git.code.sf.net/p/' + encodeURIComponent(projectName) + '/code';
  }

  // ─── SourceForge Git Repo Pre-flight Check ───────────────────────────────
  // Returns: { status: 'has-code' | 'empty' | 'no-repo', tools: [...] }

  async function checkSFGitRepo(projectName, log) {
    log('[1/4] Checking SourceForge git repo...');

    // First, check what tools the project has via the REST API
    var projectUrl = 'https://sourceforge.net/rest/p/' + encodeURIComponent(projectName);
    try {
      var projectData = await nativeGetJSON(projectUrl);
      var tools = (projectData.tools || []).map(function (t) {
        return { name: t.name, mount_point: t.mount_point };
      });
      var hasGitTool = tools.some(function (t) {
        return t.name === 'git' || t.mount_point === 'code' || t.mount_point === 'git';
      });

      if (!hasGitTool) {
        return { status: 'no-repo', tools: tools };
      }
    } catch (e) {
      // If project API fails, try probing git directly
    }

    // Probe the git repo to see if it has content
    var gitUrl = getGitUrl(projectName);
    try {
      // Try fetching git info/refs — if it works, the repo exists
      var infoUrl = gitUrl + '/info/refs?service=git-upload-pack';
      var res = await fetch(infoUrl).catch(function () { return null; });
      if (res && res.ok) {
        var text = await res.text();
        // If the response is very short or empty, the repo exists but has no refs
        if (text.length < 50) {
          return { status: 'empty', tools: [] };
        }
        return { status: 'has-code', tools: [] };
      }
      // Try the REST API for the code tool
      var codeUrl = 'https://sourceforge.net/rest/p/' + encodeURIComponent(projectName) + '/code/';
      try {
        var codeData = await nativeGetJSON(codeUrl);
        // If we get data back, the tool exists
        if (codeData && codeData.commits && codeData.commits.length > 0) {
          return { status: 'has-code', tools: [] };
        }
        return { status: 'empty', tools: [] };
      } catch (codeErr) {
        if (codeErr.status === 404) {
          return { status: 'no-repo', tools: [] };
        }
        // Assume has code if we can't tell (let clone attempt figure it out)
        return { status: 'has-code', tools: [] };
      }
    } catch (e) {
      return { status: 'has-code', tools: [] };
    }
  }

  // ─── SourceForge Files Download ──────────────────────────────────────────
  // Downloads file listing from the SF File Release System (FRS)

  async function listSFFiles(projectName) {
    // The FRS API lists folders and files
    var url = 'https://sourceforge.net/rest/p/' + encodeURIComponent(projectName) + '/';
    var data = await nativeGetJSON(url);
    // Extract file download URLs from the project data
    // The FRS structure has folders → files with download URLs
    return data;
  }

  async function downloadSFFileList(projectName) {
    // Get the list of files from the Files section
    var url = 'https://sourceforge.net/projects/' + encodeURIComponent(projectName) + '/rss?path=/';
    try {
      var res = await fetch(url);
      if (!res.ok) return [];
      var text = await res.text();
      // Parse RSS to extract download links
      var files = [];
      var itemRegex = /<item>[\s\S]*?<link>([\s\S]*?)<\/link>[\s\S]*?<\/item>/gi;
      var match;
      while ((match = itemRegex.exec(text)) !== null) {
        var fileUrl = match[1].trim();
        if (fileUrl && fileUrl.indexOf('/download') !== -1) {
          var fileName = fileUrl.split('/').filter(function (p) { return p && p !== 'download'; }).pop();
          if (fileName) {
            files.push({ name: decodeURIComponent(fileName), url: fileUrl });
          }
        }
      }
      return files;
    } catch (e) {
      return [];
    }
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

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  async function githubFetch(method, apiPath, token, body) {
    // Retry up to 3 times with backoff — Android's OkHttp connection pool
    // can get exhausted during batch operations causing transient fetch failures.
    var lastErr;
    for (var attempt = 1; attempt <= 3; attempt++) {
      try {
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
      } catch (e) {
        lastErr = e;
        // Don't retry on definitive HTTP errors (4xx) — only on network failures
        if (e.status && e.status >= 400 && e.status < 500) throw e;
        if (attempt < 3) await sleep(attempt * 800);
      }
    }
    throw lastErr;
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

  // Detect whether we're running inside a Capacitor native shell.
  // CapacitorHttp patches window.fetch to bypass CORS on native platforms,
  // so we only need the CORS proxy when running in a plain browser.
  function needsCorsProxy() {
    return !(window.Capacitor && window.Capacitor.isNativePlatform &&
             window.Capacitor.isNativePlatform());
  }

  // Public CORS proxy for isomorphic-git when running in a browser.
  // SourceForge's git.code.sf.net does not send CORS headers, so browser-based
  // clones fail without a proxy.  The proxy is NOT used on native Capacitor
  // builds (CapacitorHttp handles it) or when the Express backend is available
  // (the server uses native git, not isomorphic-git).
  var CORS_PROXY = 'https://cors.isomorphic-git.org';

  // Check if the native JGit plugin is available (Capacitor Android/iOS build)
  function hasNativeGit() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform &&
              window.Capacitor.isNativePlatform() &&
              window.Capacitor.Plugins && window.Capacitor.Plugins.NativeGit);
  }

  function getNativeGit() {
    return window.Capacitor.Plugins.NativeGit;
  }

  // ─── Native JGit Migration (Android/iOS — supports SSH + HTTPS) ──────────

  async function migrateGitRepoNative(sourceUrl, token, owner, repoName, isPrivate, log) {
    var ng = getNativeGit();
    var dirName = 'sf2gh-' + repoName + '-' + Date.now();

    // Step 1: Create GitHub repository
    log('Creating GitHub repository ' + owner + '/' + repoName + '...');
    var repoData;
    var exists = await repoExists(token, owner, repoName);
    if (exists) {
      log('Repository already exists on GitHub, pushing into it.');
      repoData = { html_url: 'https://github.com/' + owner + '/' + repoName };
    } else {
      repoData = await createRepo(token, repoName, { isPrivate: isPrivate });
      log('Repository created: ' + repoData.html_url);
    }

    // Step 2: Clone from SourceForge using native JGit (supports SSH + HTTPS)
    log('[2/4] Cloning from ' + sourceUrl + ' (native git) ...');
    log('(Large repositories may take several minutes)');
    await ng.clone({ url: sourceUrl, dir: dirName });
    log('Clone complete.');

    // Discover branches and tags
    var branchResult = await ng.listBranches({ dir: dirName, remote: 'origin' });
    var tagResult = await ng.listTags({ dir: dirName });
    var remoteBranches = branchResult.branches || [];
    var tags = tagResult.tags || [];
    log('Found ' + remoteBranches.length + ' branch(es) and ' + tags.length + ' tag(s)');

    var githubUrl = 'https://github.com/' + owner + '/' + repoName + '.git';
    var pushedSteps = [];

    // Push each branch to GitHub
    log('[3/4] Pushing to GitHub...');
    for (var bi = 0; bi < remoteBranches.length; bi++) {
      var branch = remoteBranches[bi];
      if (branch === 'HEAD') continue;
      log('Pushing branch: ' + branch);
      try {
        await ng.push({
          dir: dirName,
          remoteUrl: githubUrl,
          ref: 'refs/remotes/origin/' + branch,
          remoteRef: 'refs/heads/' + branch,
          force: true,
          token: token,
        });
        pushedSteps.push('push:' + branch);
      } catch (pushErr) {
        log('Warning: could not push branch ' + branch + ': ' + (pushErr.message || pushErr));
      }
    }

    // Push each tag
    for (var ti = 0; ti < tags.length; ti++) {
      var tag = tags[ti];
      log('Pushing tag: ' + tag);
      try {
        await ng.push({
          dir: dirName,
          remoteUrl: githubUrl,
          ref: 'refs/tags/' + tag,
          remoteRef: 'refs/tags/' + tag,
          force: true,
          token: token,
        });
        pushedSteps.push('tag:' + tag);
      } catch (tagErr) {
        log('Warning: could not push tag ' + tag + ': ' + (tagErr.message || tagErr));
      }
    }

    // Step 6: Cleanup cloned repo from device storage
    try { await ng.cleanup({ dir: dirName }); } catch (_) {}

    log('Migration complete!');
    return {
      success: true,
      scmType: 'git',
      githubUrl: repoData.html_url,
      githubRepo: owner + '/' + repoName,
      steps: ['clone'].concat(pushedSteps),
    };
  }

  // ─── isomorphic-git Migration (browser fallback) ─────────────────────────

  async function migrateGitRepo(sourceUrl, token, owner, repoName, isPrivate, log) {
    // Prefer native JGit when available (supports SSH, no CORS issues)
    if (hasNativeGit()) {
      return migrateGitRepoNative(sourceUrl, token, owner, repoName, isPrivate, log);
    }
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
    var useCorsProxy = needsCorsProxy();
    log('Cloning from ' + sourceUrl + (useCorsProxy ? ' (via CORS proxy)' : '') + ' ...');
    log('(Large repositories may take several minutes)');
    var cloneOpts = {
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
    };
    if (useCorsProxy) {
      cloneOpts.corsProxy = CORS_PROXY;
    }
    await git.clone(cloneOpts);
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
          step: 'check-sf-repo',
          description: '[1/4] Check SourceForge git repo status (has code / empty / no Code tab)',
          command: 'GET /rest/p/' + parsed.projectName + '/',
        },
        {
          step: 'create-repo',
          description: '[2/4] Create GitHub repository: ' + owner + '/' + repoName,
          command: 'GitHub API POST /user/repos {"name":"' + repoName + '"}',
        },
        {
          step: 'clone',
          description: '[3/4] Clone all branches and tags from SourceForge',
          command: (hasNativeGit() ? 'JGit' : 'isomorphic-git') + ' clone ' + gitUrl,
        },
        {
          step: 'push',
          description: '[4/4] Push all branches and tags to GitHub',
          command: (hasNativeGit() ? 'JGit' : 'isomorphic-git') + ' push → github.com',
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
      // Brief pause between repos lets Android's HTTP connection pool drain,
      // preventing "Failed to fetch" on back-to-back GitHub API calls.
      if (i > 0) await sleep(600);

      log('');
      log('═══ [' + (i + 1) + '/' + urls.length + '] ' + rawUrl + ' ═══');

      try {
        var parsed = parseSourceForgeUrl(rawUrl);

        if (parsed.scmType === 'svn') {
          log('  SVN project — not supported on mobile. Use the desktop app.');
          results.push({
            success: false,
            sourceUrl: rawUrl,
            error: 'SVN migration is not supported on mobile — use the desktop or web version',
          });
          continue;
        }

        var repoName = sanitizeRepoName(parsed.projectName);
        var projectName = parsed.projectName;

        // ── Step 1: Pre-flight check ──────────────────────────────────
        var repoStatus = await checkSFGitRepo(projectName, function (msg) { log('  ' + msg); });

        if (repoStatus.status === 'no-repo') {
          log('  ✗ No Code/git tab found for this project.');
          log('  → Create one at: https://sourceforge.net/p/' + projectName + '/admin/tools');
          log('  → Click "Git" to add a Code tab, then re-run the migration.');
          results.push({
            success: false,
            sourceUrl: rawUrl,
            error: 'No Code/git tab — create one at sf.net/p/' + projectName + '/admin/tools',
          });
          continue;
        }

        if (repoStatus.status === 'empty') {
          log('  ⚠ Git repo exists but is empty.');
          // Try to populate from Files section
          log('  [1.5/4] Checking Files section for downloadable content...');
          var sfFiles = await downloadSFFileList(projectName);
          if (sfFiles.length > 0) {
            log('  Found ' + sfFiles.length + ' file(s) in Files section.');
            log('  Note: Files section contains release downloads (zips, etc.),');
            log('  not source code. Push source to the Code tab manually first,');
            log('  or continue to migrate the empty repo structure to GitHub.');
          } else {
            log('  No files found in Files section either.');
            log('  The repo is empty — migrating empty repo structure to GitHub.');
          }
        } else {
          log('  ✓ Git repo has content.');
        }

        // ── Step 2: Clone from SourceForge ────────────────────────────
        log('  [2/4] Cloning from SourceForge...');
        var gitUrl = getGitUrl(projectName);

        var result = await migrateGitRepo(
          gitUrl,
          token,
          owner,
          repoName,
          Boolean(options.isPrivate),
          function (msg) { log('  ' + msg); }
        );

        // ── Step 3 & 4 are inside migrateGitRepo (push branches, push tags)
        log('  [4/4] Migration complete for ' + projectName);
        results.push(Object.assign({ sourceUrl: rawUrl }, result));

      } catch (err) {
        var msg = err.message || String(err);
        // Distinguish CORS / network errors from actual 404s
        var isCors = msg.indexOf('CORS') !== -1 || msg.indexOf('Failed to fetch') !== -1 ||
                     msg.indexOf('NetworkError') !== -1 || msg.indexOf('TypeError') !== -1 ||
                     msg.indexOf('Load failed') !== -1;
        if (isCors) {
          log('  Clone failed — likely a CORS issue (SourceForge blocks browser git requests).');
          log('  Tip: Use the desktop app, native mobile app (APK/IPA), or self-host the web server.');
          results.push({ success: false, sourceUrl: rawUrl, error: 'CORS blocked — use desktop or native app' });
        } else if (msg.indexOf('404') !== -1 || msg.indexOf('Not Found') !== -1) {
          log('  Git repository not found (404). This project may not have a Code tab.');
          log('  → Create one at: https://sourceforge.net/p/' + (parsed ? parsed.projectName : '???') + '/admin/tools');
          results.push({ success: false, sourceUrl: rawUrl, error: 'No git repo (404) — create Code tab on SF first' });
        } else {
          log('  Error: ' + msg);
          results.push({ success: false, sourceUrl: rawUrl, error: msg });
        }
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
        // The Allura API often omits shortname/unix_name but includes the
        // canonical project URL.  Extract the slug from that URL first,
        // then fall back to explicit fields, then slugify the display name.
        var shortname = p.shortname || p.unix_name || p.id;
        if (!shortname && p.url) {
          var m = String(p.url).match(/sourceforge\.net\/p(?:rojects?)?\/([^/?#\s]+)/i);
          if (m) shortname = decodeURIComponent(m[1]);
        }
        if (!shortname && p.name) {
          // Last resort: slugify display name  (lower-case, strip non-alnum)
          shortname = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        }
        if (!shortname || seen.has(shortname)) return;
        seen.add(shortname);
        // p.url from the Allura API is often a relative path like /p/slug/ —
        // convert to an absolute URL before storing.
        var canonicalUrl = p.url
          ? (String(p.url).startsWith('/') ? 'https://sourceforge.net' + p.url : String(p.url))
          : null;
        repos.push({
          name: p.name || shortname,
          shortname: shortname,
          sfProjectUrl: canonicalUrl || ('https://sourceforge.net/p/' + shortname + '/'),
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
