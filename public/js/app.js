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

  // Detect mobile (Capacitor native shell)
  const isMobile = window.MobileMigrate && window.MobileMigrate.isPlatformMobile();

  // Toggle token visibility
  toggleTokenBtn.addEventListener('click', function () {
    tokenInput.type = tokenInput.type === 'password' ? 'text' : 'password';
  });

  // Enable/disable buttons based on input
  function updateButtons() {
    var hasUrls = urlsInput.value.trim().length > 0;
    btnDryRun.disabled = !hasUrls;
    btnMigrate.disabled = !hasUrls || !tokenInput.value.trim();
  }
  tokenInput.addEventListener('input', updateButtons);
  urlsInput.addEventListener('input', updateButtons);

  // Health check
  function checkHealth() {
    var dot = healthStatus.querySelector('.status-dot');
    var text = healthStatus.querySelector('.status-text');

    if (isMobile) {
      dot.className = 'status-dot online';
      text.textContent = 'Mobile Mode';
      return;
    }

    fetch('/api/health')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        dot.className = 'status-dot online';
        text.textContent = 'Server v' + data.version;
      })
      .catch(function () {
        dot.className = 'status-dot offline';
        text.textContent = 'Offline';
      });
  }
  checkHealth();
  if (!isMobile) setInterval(checkHealth, 30000);

  // Logging
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

  function logHtml(html, className) {
    var line = document.createElement('div');
    line.className = className || 'log-info';
    line.innerHTML = html;
    outputLog.appendChild(line);
    outputLog.scrollTop = outputLog.scrollHeight;
  }

  // Parse URLs from textarea
  function getUrls() {
    return urlsInput.value
      .split('\n')
      .map(function (u) { return u.trim(); })
      .filter(function (u) { return u.length > 0; });
  }

  // Server API helper (web/desktop only)
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

  // ─── Dry Run ────────────────────────────────────────────────────────────

  btnDryRun.addEventListener('click', function () {
    var urls = getUrls();
    if (urls.length === 0) return;

    clearLog();
    log('=== DRY RUN PREVIEW ===', 'log-header');
    log('Planning migration for ' + urls.length + ' URL(s)...', 'log-info');

    btnDryRun.classList.add('loading');
    btnDryRun.disabled = true;

    if (isMobile) {
      // Mobile path: resolve plans client-side, no server needed
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
            log(isSvn ? '  Status: Not supported on mobile ✗' : '  Status: Ready to migrate ✓',
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

    // Web/desktop path: server-side plan
    var completed = 0;
    urls.forEach(function (url, i) {
      var body = {
        url: url,
        owner: orgInput.value.trim() || undefined,
      };

      apiPost('/api/plan', body)
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

  // ─── Migrate ─────────────────────────────────────────────────────────────

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

    if (isMobile) {
      // Mobile path: migrate using isomorphic-git, no server needed
      var options = {
        org: orgInput.value.trim() || undefined,
        isPrivate: privateCheck.checked,
      };

      window.MobileMigrate.migrateBatch(urls, token, options, function (msg) {
        // Colour-code log lines from mobile migrator
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

    // Web/desktop path: server-side migration
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
      navigator.serviceWorker.register('/sw.js').catch(function () {
        // Service worker registration failed silently
      });
    });
  }
})();
