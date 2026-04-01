'use strict';

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { detect, ScmType } = require('./detect');
const { sanitizeRepoName, buildDescription } = require('./sanitize');
const { gitMirrorCommands, svnMigrationCommands, workDirPath } = require('./commands');
const github = require('./github');
const logger = require('./logger');

/**
 * Run a single command step.
 * Returns { stdout, stderr, exitCode }.
 */
function runCommand(step) {
  return new Promise((resolve, reject) => {
    // 50 MB buffer for large repo output; 10-min timeout for slow SVN clones
    const opts = { maxBuffer: 50 * 1024 * 1024, timeout: 600000 };
    if (step.cwd) opts.cwd = step.cwd;

    logger.info(`[${step.step}] ${step.description}: ${step.cmd} ${step.args.join(' ')}`);

    execFile(step.cmd, step.args, opts, (err, stdout, stderr) => {
      if (err) {
        logger.error(`[${step.step}] failed: ${err.message}`);
        reject(
          Object.assign(err, {
            step: step.step,
            stdout,
            stderr,
          })
        );
      } else {
        logger.info(`[${step.step}] completed successfully`);
        resolve({ stdout, stderr, exitCode: 0 });
      }
    });
  });
}

/**
 * Execute a full migration plan (array of command steps).
 * Returns results for each step.
 */
async function executePlan(steps) {
  const results = [];
  for (const step of steps) {
    const result = await runCommand(step);
    results.push({ step: step.step, ...result });
  }
  return results;
}

/**
 * Plan a migration without executing it (dry run).
 * Returns the full plan with commands that would be executed.
 */
async function planMigration(rawUrl, options = {}) {
  const detected = await detect(rawUrl);
  const repoName = sanitizeRepoName(options.repoName || detected.projectName);
  const owner = options.owner || 'YOUR_USERNAME';
  const description = buildDescription(detected.projectName, rawUrl);
  const tmpBase = options.tmpDir || os.tmpdir();
  const workDir = workDirPath(tmpBase, repoName);

  const githubCloneUrl = github.buildCloneUrl(owner, repoName);
  const githubPushUrl = options.token
    ? github.buildPushUrl(options.token, owner, repoName)
    : githubCloneUrl;

  let steps;
  if (detected.scmType === ScmType.GIT) {
    steps = gitMirrorCommands(detected.gitUrl, githubPushUrl, workDir);
  } else if (detected.scmType === ScmType.SVN) {
    steps = svnMigrationCommands(detected.svnUrl, githubPushUrl, workDir);
  } else {
    throw new Error(
      `Cannot determine SCM type for project "${detected.projectName}". ` +
      'Neither Git nor SVN repository was found.'
    );
  }

  return {
    projectName: detected.projectName,
    scmType: detected.scmType,
    sourceUrl: detected.gitUrl || detected.svnUrl,
    repoName,
    owner,
    description,
    workDir,
    githubUrl: githubCloneUrl,
    steps: steps.map(({ cmd, args, cwd, step, description }) => ({
      step,
      description,
      command: `${cmd} ${args.join(' ')}`,
      cwd: cwd || null,
    })),
  };
}

/**
 * Run a full migration: detect SCM, create GitHub repo, execute migration.
 */
async function migrate(rawUrl, options = {}) {
  const { token, owner, org, isPrivate, repoName: customName, tmpDir } = options;

  if (!token) throw new Error('GitHub token is required');

  // Step 1: Detect SCM type
  logger.info(`Detecting SCM type for: ${rawUrl}`);
  const detected = await detect(rawUrl);

  if (detected.scmType === ScmType.UNKNOWN) {
    throw new Error(
      `Cannot determine SCM type for "${detected.projectName}". ` +
      'Neither Git nor SVN repository was found.'
    );
  }

  logger.info(`Detected ${detected.scmType} repository: ${detected.projectName}`);

  // Step 2: Prepare repo details
  const repoName = sanitizeRepoName(customName || detected.projectName);
  const description = buildDescription(detected.projectName, rawUrl);

  // Step 3: Get owner
  let repoOwner = owner;
  if (!repoOwner && !org) {
    const user = await github.getAuthenticatedUser(token);
    repoOwner = user.login;
  }
  const effectiveOwner = org || repoOwner;

  // Step 4: Check if repo exists
  const exists = await github.repoExists(token, effectiveOwner, repoName);
  if (exists) {
    throw new Error(
      `Repository "${effectiveOwner}/${repoName}" already exists on GitHub`
    );
  }

  // Step 5: Create GitHub repo
  logger.info(`Creating GitHub repo: ${effectiveOwner}/${repoName}`);
  const createdRepo = await github.createRepo(token, repoName, {
    description,
    isPrivate: Boolean(isPrivate),
    org,
  });

  // Step 6: Generate and execute migration commands
  const tmpBase = tmpDir || os.tmpdir();
  const workDir = workDirPath(tmpBase, repoName);
  const pushUrl = github.buildPushUrl(token, effectiveOwner, repoName);

  let steps;
  if (detected.scmType === ScmType.GIT) {
    steps = gitMirrorCommands(detected.gitUrl, pushUrl, workDir);
  } else {
    steps = svnMigrationCommands(detected.svnUrl, pushUrl, workDir);
  }

  const results = await executePlan(steps);

  // Step 7: Clean up work directory
  try {
    fs.rmSync(workDir, { recursive: true, force: true });
    logger.info('Cleaned up work directory');
  } catch (cleanupErr) {
    logger.warn(`Cleanup warning: ${cleanupErr.message}`);
  }

  return {
    success: true,
    projectName: detected.projectName,
    scmType: detected.scmType,
    githubRepo: `${effectiveOwner}/${repoName}`,
    githubUrl: createdRepo.html_url,
    steps: results.map((r) => r.step),
  };
}

/**
 * Migrate multiple SourceForge projects in sequence.
 * Returns an array of results (success or error for each).
 */
async function migrateBatch(urls, options = {}) {
  const results = [];
  for (const url of urls) {
    try {
      const result = await migrate(url, options);
      results.push(result);
    } catch (err) {
      results.push({
        success: false,
        sourceUrl: url,
        error: err.message,
      });
    }
  }
  return results;
}

module.exports = { migrate, migrateBatch, planMigration, executePlan, runCommand };
