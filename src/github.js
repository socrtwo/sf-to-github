'use strict';

const https = require('https');

const GITHUB_API = 'api.github.com';

/**
 * Make an authenticated request to the GitHub REST API.
 */
function githubRequest(method, path, token, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: GITHUB_API,
      path,
      method,
      headers: {
        'User-Agent': 'SF2GH-Migrator/1.0',
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    };

    if (body) {
      options.headers['Content-Type'] = 'application/json';
    }

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        let data;
        try {
          data = JSON.parse(raw);
        } catch {
          data = raw;
        }

        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ status: res.statusCode, data });
        } else {
          const err = new Error(
            `GitHub API ${res.statusCode}: ${data.message || raw}`
          );
          err.status = res.statusCode;
          err.data = data;
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy(new Error('GitHub API request timed out'));
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

/**
 * Create a new GitHub repository.
 *
 * @param {string} token - GitHub personal access token
 * @param {string} name - Repository name
 * @param {object} options - Additional options
 * @param {string} [options.description] - Repository description
 * @param {boolean} [options.isPrivate] - Whether the repo should be private
 * @param {string} [options.org] - Organization name (if creating under an org)
 * @returns {Promise<object>} Created repository data
 */
async function createRepo(token, name, options = {}) {
  if (!token) throw new Error('GitHub token is required');
  if (!name) throw new Error('Repository name is required');

  const body = {
    name,
    description: options.description || '',
    private: Boolean(options.isPrivate),
    auto_init: false,
    has_issues: true,
    has_projects: false,
    has_wiki: false,
  };

  const apiPath = options.org
    ? `/orgs/${encodeURIComponent(options.org)}/repos`
    : '/user/repos';

  const result = await githubRequest('POST', apiPath, token, body);
  return result.data;
}

/**
 * Check if a GitHub repository already exists.
 */
async function repoExists(token, owner, name) {
  try {
    await githubRequest(
      'GET',
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`,
      token
    );
    return true;
  } catch (err) {
    if (err.status === 404) return false;
    throw err;
  }
}

/**
 * Get the authenticated user's login name.
 */
async function getAuthenticatedUser(token) {
  const result = await githubRequest('GET', '/user', token);
  return result.data;
}

/**
 * Build the clone URL for a GitHub repository with embedded token for pushing.
 */
function buildPushUrl(token, owner, repoName) {
  return `https://${token}@github.com/${owner}/${repoName}.git`;
}

/**
 * Build the public clone URL for a GitHub repository.
 */
function buildCloneUrl(owner, repoName) {
  return `https://github.com/${owner}/${repoName}.git`;
}

module.exports = {
  createRepo,
  repoExists,
  getAuthenticatedUser,
  buildPushUrl,
  buildCloneUrl,
  githubRequest,
};
