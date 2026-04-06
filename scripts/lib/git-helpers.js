'use strict';

const OWNER_DEFAULT = 'socrtwo';

/**
 * Configure git user for commits in a cloned repo.
 * @param {Function} run - Shell runner from createRunner()
 * @param {string} cwd - Path to the git repo
 */
function configureGit(run, cwd) {
  run('git config user.name "SF2GH Migrator"', { cwd });
  run('git config user.email "sf2gh@localhost"', { cwd });
}

/**
 * Get the HTTPS clone URL for a GitHub repo (no token embedded).
 * @param {string} repo - Repository name
 * @param {string} [owner] - GitHub owner
 * @returns {string}
 */
function cloneUrl(repo, owner) {
  return `https://github.com/${owner || OWNER_DEFAULT}/${repo}.git`;
}

module.exports = { configureGit, cloneUrl };
