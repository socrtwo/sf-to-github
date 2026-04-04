'use strict';

(function () {
  // DOM elements
  const tokenInput = document.getElementById('githubToken');
  const toggleTokenBtn = document.getElementById('toggleToken');
  const urlsInput = document.getElementById('sourceUrls');
  const orgInput = document.getElementById('targetOrg');
  const privateCheck = document.getElementById('privateRepos');
  const renamePosition = document.getElementById('renamePosition');
  const renameInput = document.getElementById('repoRename');
  const btnDryRun = document.getElementById('btnDryRun');
  const btnMigrate = document.getElementById('btnMigrate');
  const btnCheckCodeTabs = document.getElementById('btnCheckCodeTabs');
  const btnPopulateCode = document.getElementById('btnPopulateCode');
  const btnAutomate = document.getElementById('btnAutomate');
  const codeTabResults = document.getElementById('codeTabResults');
  const outputSection = document.getElementById('outputSection');
  const outputLog = document.getElementById('outputLog');
  const healthStatus = document.getElementById('healthStatus');
  const sfProfileInput = document.getElementById('sfProfile');
  const btnLookupProfile = document.getElementById('btnLookupProfile');
  const profileProjectsSection = document.getElementById('profileProjects');
  const profileProjectsLabel = document.getElementById('profileProjectsLabel');
  const projectCheckboxList = document.getElementById('projectCheckboxList');
  const btnSelectAll = document.getElementById('btnSelectAllProjects');
  const btnDeselectAll = document.getElementById('btnDeselectAllProjects');
  const btnAddSelected = document.getElementById('btnAddSelected');
  const btnHelp = document.getElementById('btnHelp');
  const helpModal = document.getElementById('helpModal');
  const helpModalClose = document.getElementById('helpModalClose');

  // Running inside Capacitor native shell (iOS/Android app)?
  const isNativeApp = !!(window.Capacitor && window.Capacitor.isNativePlatform &&
                         window.Capacitor.isNativePlatform());

  // Whether to use the client-side (isomorphic-git) path instead of the server API.
  let clientSideMode = isNativeApp;

  function useClientSide() { return clientSideMode; }

  // Get SF username from profile input
  function getSfUsername() {
    var sfUser = sfProfileInput.value.trim();
    if (sfUser && sfUser.indexOf('/') !== -1) {
      var m = sfUser.match(/(?:u(?:sers?)?|p)\/([^/?#\s]+)/i);
      if (m) sfUser = m[1];
    }
    return sfUser || '';
  }

  // Apply repo rename prefix/suffix
  function applyRename(name) {
    var pos = renamePosition.value;
    var fix = renameInput.value.trim();
    if (!fix || pos === 'none') return name;
    if (pos === 'prefix') return fix + name;
    if (pos === 'suffix') return name + fix;
    return name;
  }

  // ─── Help modal ───────────────────────────────────────────────────────────

  btnHelp.addEventListener('click', function () {
    helpModal.hidden = false;
    helpModal.setAttribute('aria-hidden', 'false');
  });
  helpModalClose.addEventListener('click', closeHelp);
  helpModal.addEventListener('click', function (e) {
    if (e.target === helpModal) closeHelp();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !helpModal.hidden) closeHelp();
  });
  function closeHelp() {
    helpModal.hidden = true;
    helpModal.setAttribute('aria-hidden', 'true');
  }

  // ─── Toggle token visibility ──────────────────────────────────────────────

  toggleTokenBtn.addEventListener('click', function () {
    tokenInput.type = tokenInput.type === 'password' ? 'text' : 'password';
  });

  // ─── Button state ─────────────────────────────────────────────────────────

  function updateButtons() {
    var hasUrls = urlsInput.value.trim().length > 0;
    var hasToken = tokenInput.value.trim().length > 0;
    btnCheckCodeTabs.disabled = !hasUrls;
    btnPopulateCode.disabled = !hasUrls;
    btnDryRun.disabled = !hasUrls;
    btnMigrate.disabled = !hasUrls || !hasToken;
    btnAutomate.disabled = !hasUrls || !hasToken;
  }
  tokenInput.addEventListener('input', updateButtons);
  urlsInput.addEventListener('input', updateButtons);

  // ─── Profile Lookup ───────────────────────────────────────────────────────

  function renderProjectList(repos) {
    projectCheckboxList.innerHTML = '';
    repos.forEach(function (repo) {
      var label = document.createElement('label');
      label.className = 'project-checkbox-item';

      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = true;
      cb.value = repo.sfProjectUrl;

      var nameSpan = document.createElement('span');
      nameSpan.className = 'proj-name';
      nameSpan.textContent = repo.name;

      var urlSpan = document.createElement('span');
      urlSpan.className = 'proj-url';
      urlSpan.textContent = repo.sfProjectUrl;

      label.appendChild(cb);
      label.appendChild(nameSpan);
      label.appendChild(urlSpan);
      projectCheckboxList.appendChild(label);
    });
  }

  btnSelectAll.addEventListener('click', function () {
    projectCheckboxList.querySelectorAll('input[type=checkbox]').forEach(function (cb) { cb.checked = true; });
  });
  btnDeselectAll.addEventListener('click', function () {
    projectCheckboxList.querySelectorAll('input[type=checkbox]').forEach(function (cb) { cb.checked = false; });
  });
  btnAddSelected.addEventListener('click', function () {
    var existing = urlsInput.value.trim();
    var selected = [];
    projectCheckboxList.querySelectorAll('input[type=checkbox]:checked').forEach(function (cb) {
      selected.push(cb.value);
    });
    if (selected.length === 0) return;
    urlsInput.value = (existing ? existing + '\n' : '') + selected.join('\n');
    updateButtons();
    urlsInput.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  function doProfileLookup() {
    var raw = sfProfileInput.value.trim();
    if (!raw) return;

    btnLookupProfile.disabled = true;
    profileProjectsSection.hidden = true;

    var lookupPromise;
    if (useClientSide() && window.MobileMigrate) {
      lookupPromise = window.MobileMigrate.lookupProfile(raw);
    } else {
      lookupPromise = apiPost('/api/sf-profile', { profileUrl: raw }).then(function (result) {
        if (!result.ok) throw new Error(result.data.error || 'Profile lookup failed');
        return result.data;
      });
    }

    lookupPromise
      .then(function (data) {
        if (!data.repos || data.repos.length === 0) {
          profileProjectsLabel.textContent = 'No projects found for @' + data.username;
          profileProjectsSection.hidden = false;
          projectCheckboxList.innerHTML = '';
          return;
        }
        profileProjectsLabel.textContent =
          data.repos.length + ' project(s) found for @' + data.username + ' — select which to migrate:';
        renderProjectList(data.repos);
        profileProjectsSection.hidden = false;
      })
      .catch(function (err) {
        profileProjectsLabel.textContent = 'Error: ' + err.message;
        projectCheckboxList.innerHTML = '';
        profileProjectsSection.hidden = false;
      })
      .finally(function () {
        btnLookupProfile.disabled = false;
      });
  }

  btnLookupProfile.addEventListener('click', doProfileLookup);
  sfProfileInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') doProfileLookup();
  });

  // ─── Health check ─────────────────────────────────────────────────────────

  function setStatus(state, label) {
    var dot = healthStatus.querySelector('.status-dot');
    var text = healthStatus.querySelector('.status-text');
    dot.className = 'status-dot ' + state;
    text.textContent = label;
  }

  function checkHealth() {
    if (isNativeApp) {
      setStatus('online', 'Mobile App');
      return;
    }

    fetch('/api/health')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        clientSideMode = false;
        setStatus('online', 'Server v' + data.version);
      })
      .catch(function () {
        if (window.MobileMigrate) {
          clientSideMode = true;
          setStatus('online', 'Browser Mode');
        } else {
          clientSideMode = false;
          setStatus('offline', 'Server offline');
        }
      });
  }
  checkHealth();
  setInterval(checkHealth, 30000);

  // ─── Logging ──────────────────────────────────────────────────────────────

  function clearLog() {
    outputLog.innerHTML = '';
    outputSection.hidden = false;
  }

  function log(message, className) {
    var line = document.createElement('div');
    line.className = className || 'log-info';
    line.textContent = message;
    outputLog.appendChild(line);
    outputLog.scrollTop = outputLog.scrollHeight;
  }

  function getUrls() {
    return urlsInput.value
      .split('\n')
      .map(function (u) { return u.trim(); })
      .filter(function (u) { return u.length > 0; });
  }

  // Server API helper
  function apiPost(endpoint, body) {
    return fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(function (res) {
      return res.json().then(function (data) {
        return { ok: res.ok, status: res.status, data: data };
      });
    });
  }

  // ─── Step 1: Check Code Tabs ─────────────────────────────────────────────

  btnCheckCodeTabs.addEventListener('click', function () {
    var urls = getUrls();
    if (urls.length === 0) return;

    clearLog();
    log('=== CHECKING CODE TABS ===', 'log-header');
    btnCheckCodeTabs.classList.add('loading');
    btnCheckCodeTabs.disabled = true;

    var allHaveCode = true;
    var missingTabs = [];
    var completed = 0;

    urls.forEach(function (url, i) {
      var projectName;
      try {
        var sfMatch = url.match(/sourceforge\.net\/(?:projects?|p)\/([^/?#]+)/i);
        projectName = sfMatch ? sfMatch[1] : url;
      } catch (_) { projectName = url; }

      // Always check via SourceForge REST API directly (works in all modes)
      var checkFn;
      if (!useClientSide()) {
        // Server mode: use our backend API
        checkFn = apiPost('/api/detect', { url: url })
          .then(function (result) {
            if (result.ok && result.data.scmType !== 'unknown') {
              log('[' + (i + 1) + '/' + urls.length + '] ' + projectName + ' — ' + result.data.scmType.toUpperCase() + ' repo found', 'log-success');
            } else {
              allHaveCode = false;
              missingTabs.push(projectName);
              log('[' + (i + 1) + '/' + urls.length + '] ' + projectName + ' — No Code tab found', 'log-error');
            }
          });
      } else if (window.MobileMigrate) {
        // Browser/mobile mode: check via SF REST API
        var checkUrl = 'https://sourceforge.net/rest/p/' + encodeURIComponent(projectName) + '/code/';
        checkFn = fetch(checkUrl, { headers: { 'Accept': 'application/json' } })
          .then(function (res) {
            if (res.ok) {
              log('[' + (i + 1) + '/' + urls.length + '] ' + projectName + ' — Code tab exists', 'log-success');
            } else {
              allHaveCode = false;
              missingTabs.push(projectName);
              log('[' + (i + 1) + '/' + urls.length + '] ' + projectName + ' — No Code tab', 'log-error');
            }
          });
      } else {
        checkFn = Promise.resolve().then(function () {
          allHaveCode = false;
          missingTabs.push(projectName);
          log('[' + (i + 1) + '/' + urls.length + '] ' + projectName + ' — Cannot check (no server)', 'log-warn');
        });
      }

      checkFn
        .catch(function () {
          allHaveCode = false;
          missingTabs.push(projectName);
          log('[' + (i + 1) + '/' + urls.length + '] ' + projectName + ' — Could not check', 'log-warn');
        })
        .finally(finishCheck);

      function finishCheck() {
        completed++;
        if (completed < urls.length) return;

        log('', 'log-info');
        codeTabResults.hidden = false;

        if (allHaveCode) {
          codeTabResults.innerHTML = '<div class="results-panel success"><strong>All ' + urls.length + ' project(s) have Code tabs.</strong> Proceed to Step 2.</div>';
          log('All projects have Code tabs!', 'log-success');
        } else {
          var html = '<div class="results-panel warning">';
          html += '<strong>' + missingTabs.length + ' project(s) need a Code tab created:</strong>';
          html += '<ul>';
          missingTabs.forEach(function (name) {
            html += '<li><a href="https://sourceforge.net/p/' + encodeURIComponent(name) + '/admin/tools" target="_blank" rel="noopener">' + name + ' — Create Code Tab</a></li>';
          });
          html += '</ul>';
          html += '<p style="margin-top:12px"><strong>How to add a Code tab:</strong></p>';
          html += '<ol>';
          html += '<li>Click the link above to open the project\'s Admin &rarr; Tools page</li>';
          html += '<li>Find the "Available Tools" section</li>';
          html += '<li>Click <strong>"Git"</strong> to add a Git Code tab</li>';
          html += '<li>Click <strong>"Save"</strong></li>';
          html += '<li>Come back here and re-run this check</li>';
          html += '</ol>';
          html += '</div>';
          codeTabResults.innerHTML = html;
          log(missingTabs.length + ' project(s) need Code tabs — see links above.', 'log-warn');
        }

        log('=== CHECK COMPLETE ===', 'log-header');
        btnCheckCodeTabs.classList.remove('loading');
        updateButtons();
      }
    });
  });

  // ─── Step 2: Populate Empty Code Tabs ─────────────────────────────────────

  btnPopulateCode.addEventListener('click', function () {
    var urls = getUrls();
    if (urls.length === 0) return;

    var hasNative = !!(window.Capacitor && window.Capacitor.isNativePlatform &&
                       window.Capacitor.isNativePlatform() &&
                       window.Capacitor.Plugins && window.Capacitor.Plugins.NativeGit);

    if (useClientSide() && !hasNative) {
      alert('Step 2 (Populate Code Tabs) requires the desktop app, web server, or native mobile app (APK).\n\nIn Browser Mode, this step cannot run because it needs native git to push files to SourceForge.\n\nEither:\n- Run the app with "npm start" on a computer\n- Use the Electron desktop app\n- Use the Android APK\n- Skip to Step 3/4 if your Code tabs already have content');
      return;
    }

    var sfUser = getSfUsername();
    if (!sfUser) {
      alert('Enter your SourceForge username in the "Find by SourceForge Profile" field first.');
      sfProfileInput.focus();
      return;
    }

    clearLog();
    log('=== POPULATING CODE TABS ===', 'log-header');
    log('SF Username: ' + sfUser, 'log-info');
    btnPopulateCode.classList.add('loading');
    btnPopulateCode.disabled = true;

    var chain = Promise.resolve();
    urls.forEach(function (url, i) {
      chain = chain.then(function () {
        var sfMatch = url.match(/sourceforge\.net\/(?:projects?|p)\/([^/?#]+)/i);
        var projectName = sfMatch ? sfMatch[1] : url;
        log('', 'log-info');
        log('[' + (i + 1) + '/' + urls.length + '] ' + projectName, 'log-step');

        if (hasNative) {
          // Native path: use JGit plugin to download, init, commit, push
          var ng = window.Capacitor.Plugins.NativeGit;
          var pushUrl = 'https://' + encodeURIComponent(sfUser) + '@git.code.sf.net/p/' + encodeURIComponent(projectName) + '/code';
          var dirName = 'sf2gh-populate-' + projectName + '-' + Date.now();
          log('  Downloading files and pushing to SF Code tab (native)...', 'log-info');
          // For now, create a README and push it to establish the Code tab
          return ng.downloadFile({
            url: 'https://sourceforge.net/projects/' + encodeURIComponent(projectName) + '/',
            dir: dirName,
            fileName: 'README.md',
          }).then(function () {
            return ng.initCommitPush({
              dir: dirName,
              remoteUrl: pushUrl,
              message: 'Import from SourceForge Files section via SF2GH Migrator',
            });
          }).then(function () {
            log('  Populated Code tab via native git', 'log-success');
            return ng.cleanup({ dir: dirName });
          }).catch(function (err) {
            log('  Native populate failed: ' + (err.message || err), 'log-warn');
            try { ng.cleanup({ dir: dirName }); } catch (_) {}
          });
        }

        // Server path
        return apiPost('/api/sf-populate', { projectName: projectName, sfUsername: sfUser })
          .then(function (result) {
            if (result.ok && result.data.success) {
              log('  Populated with ' + result.data.filesCount + ' file(s)', 'log-success');
            } else {
              log('  ' + (result.data.message || result.data.error || 'Could not populate'), 'log-warn');
            }
          })
          .catch(function (err) {
            log('  Error: ' + err.message, 'log-error');
          });
      });
    });

    chain.finally(function () {
      log('', 'log-info');
      log('=== POPULATE COMPLETE ===', 'log-header');
      btnPopulateCode.classList.remove('loading');
      updateButtons();
    });
  });

  // ─── Step 3: Dry Run ──────────────────────────────────────────────────────

  btnDryRun.addEventListener('click', function () {
    var urls = getUrls();
    if (urls.length === 0) return;

    clearLog();
    log('=== DRY RUN PREVIEW ===', 'log-header');
    log('Planning migration for ' + urls.length + ' URL(s)...', 'log-info');
    if (renamePosition.value !== 'none' && renameInput.value.trim()) {
      log('Repo rename: ' + renamePosition.value + ' "' + renameInput.value.trim() + '"', 'log-info');
    }

    btnDryRun.classList.add('loading');
    btnDryRun.disabled = true;

    if (useClientSide() && window.MobileMigrate) {
      var completed = 0;
      urls.forEach(function (url, i) {
        var owner = orgInput.value.trim() || undefined;
        var sfU = getSfUsername();
        window.MobileMigrate.planMigration(url, { owner: owner, sfUsername: sfU || undefined })
          .then(function (plan) {
            var displayName = applyRename(plan.projectName);
            log('', 'log-info');
            log('[' + (i + 1) + '/' + urls.length + '] ' + url, 'log-step');
            log('  Project: ' + plan.projectName + (displayName !== plan.projectName ? ' -> ' + displayName : ''), 'log-info');
            log('  SCM Type: ' + plan.scmType.toUpperCase(), 'log-info');
            log('  Source: ' + plan.sourceUrl, 'log-info');
            log('  Target: ' + plan.githubUrl, 'log-info');
            log('  Steps:', 'log-info');
            plan.steps.forEach(function (step, j) {
              log('    ' + (j + 1) + '. [' + step.step + '] ' + step.description, 'log-info');
            });
            var isSvn = plan.steps.some(function (s) { return s.step === 'unsupported'; });
            log(isSvn ? '  Status: Not supported in browser/mobile mode' : '  Status: Ready to migrate', isSvn ? 'log-warn' : 'log-success');
          })
          .catch(function (err) {
            log('[' + (i + 1) + '] Error: ' + err.message, 'log-error');
          })
          .finally(function () {
            completed++;
            if (completed === urls.length) {
              log('', 'log-info');
              log('=== DRY RUN COMPLETE ===', 'log-header');
              btnDryRun.classList.remove('loading');
              updateButtons();
            }
          });
      });
      return;
    }

    var completed = 0;
    urls.forEach(function (url, i) {
      apiPost('/api/plan', { url: url, owner: orgInput.value.trim() || undefined })
        .then(function (result) {
          log('', 'log-info');
          log('[' + (i + 1) + '/' + urls.length + '] ' + url, 'log-step');
          if (!result.ok) {
            log('  Error: ' + result.data.error, 'log-error');
            return;
          }
          var plan = result.data;
          var displayName = applyRename(plan.projectName);
          log('  Project: ' + plan.projectName + (displayName !== plan.projectName ? ' -> ' + displayName : ''), 'log-info');
          log('  SCM Type: ' + plan.scmType.toUpperCase(), 'log-info');
          log('  Source: ' + plan.sourceUrl, 'log-info');
          log('  Target: ' + plan.githubUrl, 'log-info');
          log('  Status: Ready to migrate', 'log-success');
        })
        .catch(function (err) {
          log('[' + (i + 1) + '] Error: ' + err.message, 'log-error');
        })
        .finally(function () {
          completed++;
          if (completed === urls.length) {
            log('', 'log-info');
            log('=== DRY RUN COMPLETE ===', 'log-header');
            btnDryRun.classList.remove('loading');
            updateButtons();
          }
        });
    });
  });

  // ─── Step 4: Migrate ──────────────────────────────────────────────────────

  function runMigration() {
    var urls = getUrls();
    var token = tokenInput.value.trim();
    if (urls.length === 0 || !token) return;

    clearLog();
    log('=== MIGRATION STARTED ===', 'log-header');
    log('Migrating ' + urls.length + ' repository(ies)...', 'log-info');

    btnMigrate.classList.add('loading');
    btnMigrate.disabled = true;
    btnDryRun.disabled = true;
    btnAutomate.disabled = true;

    if (useClientSide() && window.MobileMigrate) {
      var sfUser = getSfUsername();
      var options = {
        org: orgInput.value.trim() || undefined,
        isPrivate: privateCheck.checked,
        sfUsername: sfUser || undefined,
      };

      window.MobileMigrate.migrateBatch(urls, token, options, function (msg) {
        var cls = 'log-info';
        if (/error/i.test(msg) || /failed/i.test(msg)) cls = 'log-error';
        else if (/warning|tip|not supported/i.test(msg)) cls = 'log-warn';
        else if (/complete|success|created/i.test(msg)) cls = 'log-success';
        else if (/^\s*[═─]{3}/.test(msg)) cls = 'log-step';
        log(msg, cls);
      })
        .then(function (result) {
          result.results.forEach(function (r, i) {
            if (r.success) {
              log('', 'log-info');
              log('[' + (i + 1) + '/' + urls.length + '] ' + (r.githubRepo || r.sourceUrl), 'log-step');
              log('  SCM: ' + r.scmType.toUpperCase(), 'log-info');
              log('  GitHub: ' + r.githubUrl, 'log-success');
              log('  Steps completed: ' + r.steps.join(' -> '), 'log-info');
              log('  Status: Migration successful', 'log-success');
            }
          });
          var succeeded = result.results.filter(function (r) { return r.success; }).length;
          var failed = result.results.length - succeeded;
          log('', 'log-info');
          log('Results: ' + succeeded + ' succeeded, ' + failed + ' failed',
              succeeded === result.results.length ? 'log-success' : 'log-warn');
        })
        .catch(function (err) {
          log('Migration failed: ' + err.message, 'log-error');
        })
        .finally(function () {
          log('', 'log-info');
          log('=== MIGRATION COMPLETE ===', 'log-header');
          btnMigrate.classList.remove('loading');
          updateButtons();
        });
      return;
    }

    apiPost('/api/migrate/batch', {
      urls: urls,
      token: token,
      org: orgInput.value.trim() || undefined,
      isPrivate: privateCheck.checked,
      sfUsername: getSfUsername() || undefined,
    })
      .then(function (result) {
        if (!result.ok) {
          log('Error: ' + result.data.error, 'log-error');
          return;
        }
        result.data.results.forEach(function (r, i) {
          log('', 'log-info');
          log('[' + (i + 1) + '/' + urls.length + '] ' + (r.githubRepo || r.sourceUrl), 'log-step');
          if (r.success) {
            log('  SCM: ' + r.scmType.toUpperCase(), 'log-info');
            log('  GitHub: ' + r.githubUrl, 'log-success');
            log('  Steps completed: ' + r.steps.join(' -> '), 'log-info');
            log('  Status: Migration successful', 'log-success');
          } else {
            log('  Source: ' + r.sourceUrl, 'log-info');
            log('  Error: ' + r.error, 'log-error');
            log('  Status: Migration failed', 'log-error');
          }
        });
        var succeeded = result.data.results.filter(function (r) { return r.success; }).length;
        var failed = result.data.results.length - succeeded;
        log('', 'log-info');
        log('Results: ' + succeeded + ' succeeded, ' + failed + ' failed',
            succeeded === result.data.results.length ? 'log-success' : 'log-warn');
      })
      .catch(function (err) {
        log('Request failed: ' + err.message, 'log-error');
      })
      .finally(function () {
        log('', 'log-info');
        log('=== MIGRATION COMPLETE ===', 'log-header');
        btnMigrate.classList.remove('loading');
        updateButtons();
      });
  }

  btnMigrate.addEventListener('click', function () {
    var urls = getUrls();
    var token = tokenInput.value.trim();
    if (urls.length === 0 || !token) return;
    if (!confirm('This will create ' + urls.length + ' repository(ies) on GitHub and migrate the source code. Continue?')) return;
    runMigration();
  });

  // ─── Automate All (Steps 2-4) ────────────────────────────────────────────

  btnAutomate.addEventListener('click', function () {
    var urls = getUrls();
    var token = tokenInput.value.trim();
    if (urls.length === 0 || !token) return;
    if (!confirm('This will:\n1. Populate empty Code tabs from SF Files\n2. Migrate all repos to GitHub\n\nContinue?')) return;

    clearLog();
    log('=== AUTOMATED MIGRATION ===', 'log-header');

    btnAutomate.classList.add('loading');
    btnAutomate.disabled = true;
    btnMigrate.disabled = true;
    btnPopulateCode.disabled = true;

    // Step 2: Populate first
    var sfUser = getSfUsername();
    var populateChain = Promise.resolve();

    if (sfUser && !useClientSide()) {
      log('--- Step 2: Populating empty Code tabs ---', 'log-step');
      urls.forEach(function (url, i) {
        populateChain = populateChain.then(function () {
          var sfMatch = url.match(/sourceforge\.net\/(?:projects?|p)\/([^/?#]+)/i);
          var projectName = sfMatch ? sfMatch[1] : url;
          return apiPost('/api/sf-populate', { projectName: projectName, sfUsername: sfUser })
            .then(function (result) {
              if (result.ok && result.data.success) {
                log('  ' + projectName + ': populated ' + result.data.filesCount + ' file(s)', 'log-success');
              } else {
                log('  ' + projectName + ': ' + (result.data.message || 'skipped'), 'log-info');
              }
            })
            .catch(function () {
              log('  ' + projectName + ': populate skipped', 'log-info');
            });
        });
      });
    }

    // Then Step 4: Migrate
    populateChain.then(function () {
      log('', 'log-info');
      log('--- Step 4: Migrating to GitHub ---', 'log-step');
      runMigration();
    }).catch(function (err) {
      log('Automation failed: ' + err.message, 'log-error');
      btnAutomate.classList.remove('loading');
      updateButtons();
    });
  });

  // Register Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function () {});
    });
  }
})();
