'use strict';

(function () {
  // DOM elements
  const tokenInput = document.getElementById('githubToken');
  const toggleTokenBtn = document.getElementById('toggleToken');
  const urlsInput = document.getElementById('sourceUrls');
  const orgInput = document.getElementById('targetOrg');
  const privateCheck = document.getElementById('privateRepos');
  const btnDryRun = document.getElementById('btnDryRun');
  const btnMigrate = document.getElementById('btnMigrate');
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
  // Starts true for native app; may flip to true for web if server is unreachable.
  let clientSideMode = isNativeApp;

  function useClientSide() { return clientSideMode; }

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
    btnDryRun.disabled = !hasUrls;
    btnMigrate.disabled = !hasUrls || !tokenInput.value.trim();
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

  // ─── Dry Run ──────────────────────────────────────────────────────────────

  btnDryRun.addEventListener('click', function () {
    var urls = getUrls();
    if (urls.length === 0) return;

    clearLog();
    log('=== DRY RUN PREVIEW ===', 'log-header');
    log('Planning migration for ' + urls.length + ' URL(s)...', 'log-info');

    btnDryRun.classList.add('loading');
    btnDryRun.disabled = true;

    if (useClientSide() && window.MobileMigrate) {
      var completed = 0;
      urls.forEach(function (url, i) {
        var owner = orgInput.value.trim() || undefined;
        window.MobileMigrate.planMigration(url, { owner: owner })
          .then(function (plan) {
            log('', 'log-info');
            log('[' + (i + 1) + '/' + urls.length + '] ' + url, 'log-step');
            log('  Project: ' + plan.projectName, 'log-info');
            log('  SCM Type: ' + plan.scmType.toUpperCase(), 'log-info');
            log('  Source: ' + plan.sourceUrl, 'log-info');
            log('  Target: ' + plan.githubUrl, 'log-info');
            log('  Steps:', 'log-info');
            plan.steps.forEach(function (step, j) {
              log('    ' + (j + 1) + '. [' + step.step + '] ' + step.description, 'log-info');
              log('       $ ' + step.command, 'log-info');
            });
            var isSvn = plan.steps.some(function (s) { return s.step === 'unsupported'; });
            log(isSvn ? '  Status: Not supported in browser/mobile mode ✗' : '  Status: Ready to migrate ✓',
                isSvn ? 'log-warn' : 'log-success');
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
          log('  Project: ' + plan.projectName, 'log-info');
          log('  SCM Type: ' + plan.scmType.toUpperCase(), 'log-info');
          log('  Source: ' + plan.sourceUrl, 'log-info');
          log('  Target: ' + plan.githubUrl, 'log-info');
          log('  Steps:', 'log-info');
          plan.steps.forEach(function (step, j) {
            log('    ' + (j + 1) + '. [' + step.step + '] ' + step.description, 'log-info');
            log('       $ ' + step.command, 'log-info');
          });
          log('  Status: Ready to migrate ✓', 'log-success');
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

  // ─── Migrate ──────────────────────────────────────────────────────────────

  btnMigrate.addEventListener('click', function () {
    var urls = getUrls();
    var token = tokenInput.value.trim();
    if (urls.length === 0 || !token) return;

    if (!confirm(
      'This will create ' + urls.length + ' repository(ies) on GitHub and migrate the source code. Continue?'
    )) return;

    clearLog();
    log('=== MIGRATION STARTED ===', 'log-header');
    log('Migrating ' + urls.length + ' repository(ies)...', 'log-info');

    btnMigrate.classList.add('loading');
    btnMigrate.disabled = true;
    btnDryRun.disabled = true;

    if (useClientSide() && window.MobileMigrate) {
      var options = {
        org: orgInput.value.trim() || undefined,
        isPrivate: privateCheck.checked,
      };

      window.MobileMigrate.migrateBatch(urls, token, options, function (msg) {
        var cls = 'log-info';
        if (/error/i.test(msg) || /failed/i.test(msg)) cls = 'log-error';
        else if (/warning|tip|not supported/i.test(msg)) cls = 'log-warn';
        else if (/complete|success|created/i.test(msg)) cls = 'log-success';
        else if (/^\s*─{3}/.test(msg)) cls = 'log-step';
        log(msg, cls);
      })
        .then(function (result) {
          result.results.forEach(function (r, i) {
            if (r.success) {
              log('', 'log-info');
              log('[' + (i + 1) + '/' + urls.length + '] ' + (r.githubRepo || r.sourceUrl), 'log-step');
              log('  SCM: ' + r.scmType.toUpperCase(), 'log-info');
              log('  GitHub: ' + r.githubUrl, 'log-success');
              log('  Steps completed: ' + r.steps.join(' → '), 'log-info');
              log('  Status: Migration successful ✓', 'log-success');
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
            log('  Steps completed: ' + r.steps.join(' → '), 'log-info');
            log('  Status: Migration successful ✓', 'log-success');
          } else {
            log('  Source: ' + r.sourceUrl, 'log-info');
            log('  Error: ' + r.error, 'log-error');
            log('  Status: Migration failed ✗', 'log-error');
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
  });

  // Register Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function () {});
    });
  }
})();
