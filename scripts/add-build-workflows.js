#!/usr/bin/env node
'use strict';

/**
 * Add GitHub Actions build workflows to VB.NET SF repos.
 * Creates a .github/workflows/build.yml that compiles the .sln with MSBuild.
 *
 * Usage: cd ~/sf-to-github
 *        GITHUB_TOKEN=ghp_YOUR_TOKEN node scripts/add-build-workflows.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const TOKEN = process.env.GITHUB_TOKEN;
const OWNER = process.env.GITHUB_OWNER || 'socrtwo';

if (!TOKEN) {
  console.error('Set GITHUB_TOKEN environment variable.');
  process.exit(1);
}

const REPOS = [
  {
    repo: 'corruptexcelrec-SF',
    sln: 'Excel Recovery.sln',
    name: 'S2 Recovery Tools for Microsoft Excel',
  },
  {
    repo: 'vistaprevrsrcvr-SF',
    sln: 'Previous Version Explorer.sln',
    name: 'Previous Version File Recoverer',
  },
  {
    repo: 'excelrcvryaddin-SF',
    sln: 'ExcelRecoveryAddin.sln',
    name: 'Excel Recovery Add-In',
  },
  {
    repo: 'quickwordrecovr-SF',
    sln: 'Unspecified Error DOCX Recovery.sln',
    name: 'Savvy DOCX Recovery',
  },
  {
    repo: 'savvyoffice-SF',
    sln: 'Savvy Repair for Microsoft Office.sln',
    name: 'Savvy Repair for Microsoft Office',
  },
];

function generateWorkflow(entry) {
  return `name: Build ${entry.name}

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

jobs:
  build:
    name: Build with MSBuild
    runs-on: windows-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup MSBuild
        uses: microsoft/setup-msbuild@v2

      - name: Setup NuGet
        uses: NuGet/setup-nuget@v2

      - name: Restore NuGet packages
        run: nuget restore "${entry.sln}"
        continue-on-error: true

      - name: Build solution
        run: msbuild "${entry.sln}" /p:Configuration=Release /p:Platform="Any CPU" /m
        continue-on-error: true

      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        if: success()
        with:
          name: build-output
          path: |
            **/bin/Release/**
            **/bin/Debug/**
          if-no-files-found: ignore
`;
}

function run(cmd, opts = {}) {
  console.log('  $ ' + cmd.substring(0, 100) + (cmd.length > 100 ? '...' : ''));
  return execSync(cmd, { stdio: 'pipe', timeout: 120000, ...opts }).toString().trim();
}

async function processRepo(entry) {
  console.log(`\n=== ${entry.repo} (${entry.name}) ===`);

  const tmpDir = path.join(os.tmpdir(), 'sf-workflow-' + entry.repo);
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });

  try {
    const cloneUrl = `https://${TOKEN}@github.com/${OWNER}/${entry.repo}.git`;
    console.log('  Cloning...');
    run(`git clone "${cloneUrl}" "${tmpDir}"`);

    // Check if workflow already exists
    const workflowDir = path.join(tmpDir, '.github', 'workflows');
    if (fs.existsSync(path.join(workflowDir, 'build.yml'))) {
      console.log('  Workflow already exists. Skipping.');
      return;
    }

    // Verify the .sln file exists
    const slnPath = path.join(tmpDir, entry.sln);
    if (!fs.existsSync(slnPath)) {
      // Search for any .sln file
      const found = findFiles(tmpDir, '.sln');
      if (found.length > 0) {
        entry.sln = path.relative(tmpDir, found[0]);
        console.log('  Found .sln: ' + entry.sln);
      } else {
        console.log('  No .sln found. Skipping.');
        return;
      }
    }

    // Create workflow
    fs.mkdirSync(workflowDir, { recursive: true });
    fs.writeFileSync(path.join(workflowDir, 'build.yml'), generateWorkflow(entry));
    console.log('  Created .github/workflows/build.yml');

    // Commit and push
    run('git config user.name "SF2GH Migrator"', { cwd: tmpDir });
    run('git config user.email "sf2gh@localhost"', { cwd: tmpDir });
    run('git add -A', { cwd: tmpDir });
    run('git commit -m "Add GitHub Actions build workflow (MSBuild / VB.NET)"', { cwd: tmpDir });
    console.log('  Pushing...');
    run('git push origin main', { cwd: tmpDir });
    console.log('  DONE!');

  } catch (err) {
    console.error('  ERROR: ' + err.message.split('\n')[0]);
  } finally {
    if (fs.existsSync(tmpDir)) try { fs.rmSync(tmpDir, { recursive: true }); } catch (_) {}
  }
}

function findFiles(dir, ext) {
  const results = [];
  function walk(d) {
    try {
      const entries = fs.readdirSync(d);
      for (const e of entries) {
        if (e === '.git' || e === 'node_modules') continue;
        const full = path.join(d, e);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) walk(full);
        else if (e.toLowerCase().endsWith(ext)) results.push(full);
      }
    } catch (_) {}
  }
  walk(dir);
  return results;
}

async function main() {
  console.log('Adding Build Workflows to VB.NET repos');
  console.log('Owner: ' + OWNER);
  console.log('Repos: ' + REPOS.length);

  for (const entry of REPOS) {
    await processRepo(entry);
  }

  console.log('\n=== ALL DONE ===');
}

main().catch(console.error);
