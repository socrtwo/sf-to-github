'use strict';

const path = require('path');

/**
 * Generate the sequence of shell commands needed to migrate a Git repository.
 *
 * Steps:
 *   1. git clone --mirror <sourceUrl> <workDir>
 *   2. cd <workDir>
 *   3. git remote set-url origin <githubUrl>
 *   4. git push --mirror
 *
 * Returns an array of { cmd, args, cwd? } objects.
 */
function gitMirrorCommands(sourceUrl, githubUrl, workDir) {
  if (!sourceUrl) throw new Error('sourceUrl is required');
  if (!githubUrl) throw new Error('githubUrl is required');
  if (!workDir) throw new Error('workDir is required');

  return [
    {
      step: 'clone',
      description: 'Clone source Git repository (mirror)',
      cmd: 'git',
      args: ['clone', '--mirror', sourceUrl, workDir],
    },
    {
      step: 'set-remote',
      description: 'Set push remote to GitHub',
      cmd: 'git',
      args: ['remote', 'set-url', 'origin', githubUrl],
      cwd: workDir,
    },
    {
      step: 'push',
      description: 'Push mirror to GitHub',
      cmd: 'git',
      args: ['push', '--mirror'],
      cwd: workDir,
    },
  ];
}

/**
 * Generate the sequence of shell commands needed to migrate an SVN repository.
 *
 * Steps:
 *   1. git svn clone --stdlayout <svnUrl> <workDir>
 *   2. cd <workDir>
 *   3. Convert SVN remote branches to local branches
 *   4. Convert SVN tags to Git tags
 *   5. git remote add origin <githubUrl>
 *   6. git push origin --all
 *   7. git push origin --tags
 *
 * Returns an array of { cmd, args, cwd? } objects.
 */
function svnMigrationCommands(svnUrl, githubUrl, workDir) {
  if (!svnUrl) throw new Error('svnUrl is required');
  if (!githubUrl) throw new Error('githubUrl is required');
  if (!workDir) throw new Error('workDir is required');

  return [
    {
      step: 'svn-clone',
      description: 'Clone SVN repository via git-svn',
      cmd: 'git',
      args: ['svn', 'clone', '--stdlayout', svnUrl, workDir],
    },
    {
      step: 'convert-branches',
      description: 'Convert SVN remote branches to local Git branches',
      cmd: 'bash',
      args: [
        '-c',
        'for branch in $(git branch -r | grep -v "tags/" | grep -v "trunk" | sed "s|origin/||"); do git branch "$branch" "remotes/origin/$branch" 2>/dev/null || true; done',
      ],
      cwd: workDir,
    },
    {
      step: 'convert-tags',
      description: 'Convert SVN tag branches to proper Git tags',
      cmd: 'bash',
      args: [
        '-c',
        'for tag in $(git branch -r | grep "tags/" | sed "s|.*tags/||"); do git tag "$tag" "remotes/origin/tags/$tag" 2>/dev/null || true; done',
      ],
      cwd: workDir,
    },
    {
      step: 'add-remote',
      description: 'Add GitHub as remote',
      cmd: 'git',
      args: ['remote', 'add', 'origin', githubUrl],
      cwd: workDir,
    },
    {
      step: 'push-branches',
      description: 'Push all branches to GitHub',
      cmd: 'git',
      args: ['push', 'origin', '--all'],
      cwd: workDir,
    },
    {
      step: 'push-tags',
      description: 'Push all tags to GitHub',
      cmd: 'git',
      args: ['push', 'origin', '--tags'],
      cwd: workDir,
    },
  ];
}

/**
 * Build the work directory path for a migration job.
 */
function workDirPath(baseTmpDir, projectName) {
  return path.join(baseTmpDir, `sf2gh-${projectName}-${Date.now()}`);
}

module.exports = { gitMirrorCommands, svnMigrationCommands, workDirPath };
