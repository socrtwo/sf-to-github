'use strict';

/**
 * Sanitize a SourceForge project name into a valid GitHub repository name.
 *
 * GitHub repo names may contain alphanumeric characters, hyphens, underscores,
 * and periods. They cannot start with a period, end with ".git", or contain
 * consecutive periods.
 */
function sanitizeRepoName(name) {
  if (!name || typeof name !== 'string') {
    throw new Error('Repository name must be a non-empty string');
  }

  let sanitized = name
    .trim()
    .toLowerCase()
    // Replace spaces and disallowed characters with hyphens
    .replace(/[^a-z0-9._-]/g, '-')
    // Collapse consecutive hyphens
    .replace(/-{2,}/g, '-')
    // Collapse consecutive periods
    .replace(/\.{2,}/g, '.')
    // Remove leading periods or hyphens
    .replace(/^[.\-]+/, '')
    // Remove trailing hyphens
    .replace(/-+$/, '');

  // Remove trailing .git suffix
  if (sanitized.endsWith('.git')) {
    sanitized = sanitized.slice(0, -4);
  }

  // Remove trailing period
  sanitized = sanitized.replace(/\.+$/, '');

  if (!sanitized) {
    throw new Error(
      `Cannot produce valid repository name from: "${name}"`
    );
  }

  return sanitized;
}

/**
 * Build a GitHub-friendly description from a SourceForge project name.
 */
function buildDescription(projectName, sourceUrl) {
  return `Migrated from SourceForge project "${projectName}" (${sourceUrl})`;
}

module.exports = { sanitizeRepoName, buildDescription };
