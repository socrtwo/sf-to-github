'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Create a shell runner with GIT_ASKPASS auth so tokens never appear in URLs or logs.
 * @param {string} token - GitHub token
 * @param {number} [defaultTimeout=300000] - Default command timeout in ms
 * @returns {{ run: Function, GIT_ENV: Object }}
 */
function createRunner(token, defaultTimeout = 300000) {
  const askpassScript = path.join(os.tmpdir(), 'sf2gh-askpass-' + process.pid + '.sh');
  fs.writeFileSync(askpassScript, `#!/bin/sh\necho "${token}"\n`, { mode: 0o700 });
  const GIT_ENV = { ...process.env, GIT_ASKPASS: askpassScript, GIT_TERMINAL_PROMPT: '0' };

  function run(cmd, opts = {}) {
    const display = cmd.substring(0, 120) + (cmd.length > 120 ? '...' : '');
    console.log('  $ ' + display);
    return execSync(cmd, { stdio: 'pipe', timeout: defaultTimeout, env: GIT_ENV, ...opts }).toString().trim();
  }

  return { run, GIT_ENV };
}

module.exports = { createRunner };
