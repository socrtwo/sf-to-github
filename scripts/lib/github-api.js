'use strict';

const https = require('https');

/**
 * Create a GitHub API client.
 * @param {string} token - GitHub personal access token
 * @returns {{ githubApi: Function, sleep: Function }}
 */
function createGitHubApi(token) {
  /**
   * Make a GitHub API request.
   * @param {string} method - HTTP method
   * @param {string} apiPath - API path (e.g. /repos/owner/repo/contents/README.md)
   * @param {Object} [body] - JSON body for POST/PUT
   * @param {Buffer} [binary] - Binary data for upload (switches to uploads.github.com)
   * @returns {Promise<{status: number, data: Object}>}
   */
  function githubApi(method, apiPath, body, binary) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: binary ? 'uploads.github.com' : 'api.github.com',
        path: apiPath,
        method: method,
        headers: {
          'User-Agent': 'SF2GH-Migrator/1.5',
          'Authorization': 'Bearer ' + token,
          'X-GitHub-Api-Version': '2022-11-28',
        },
      };
      if (binary) {
        options.headers['Content-Type'] = 'application/octet-stream';
        options.headers['Content-Length'] = binary.length;
      } else {
        options.headers['Accept'] = 'application/vnd.github+json';
        if (body) options.headers['Content-Type'] = 'application/json';
      }

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (d) => { data += d; });
        res.on('end', () => {
          try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
          catch (_) { resolve({ status: res.statusCode, data: {} }); }
        });
      });
      req.on('error', reject);
      req.setTimeout(300000);
      if (binary) req.write(binary);
      else if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  return { githubApi };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = { createGitHubApi, sleep };
