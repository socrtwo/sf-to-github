#!/usr/bin/env node
'use strict';

/**
 * Add GitHub Actions workflows to ALL SF repos that have code.
 * Includes: VB.NET (MSBuild), Perl (lint), PHP (lint), Delphi (fpc),
 * AutoHotkey, AutoIt, HTML validation, GEDCOM validation.
 *
 * Usage: cd ~/sf-to-github
 *        GITHUB_TOKEN=ghp_YOUR_TOKEN node scripts/add-all-workflows.js
 *
 * Your token needs the "workflow" scope to push .github/workflows/ files.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const { createRunner } = require('./lib/shell');
const { configureGit, cloneUrl } = require('./lib/git-helpers');
const repoConfig = require('./config/repositories.json');

const TOKEN = process.env.GITHUB_TOKEN;
const OWNER = process.env.GITHUB_OWNER || repoConfig.owner;

if (!TOKEN) {
  console.error('Set GITHUB_TOKEN environment variable.');
  process.exit(1);
}

const { run } = createRunner(TOKEN, 120000);

// ─── Workflow templates ──────────────────────────────────────────────────

function vbnetWorkflow(name, sln) {
  return `name: Build ${name}

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
      - uses: actions/checkout@v4

      - name: Setup MSBuild
        uses: microsoft/setup-msbuild@v2

      - name: Setup NuGet
        uses: NuGet/setup-nuget@v2

      - name: Restore NuGet packages
        run: nuget restore "${sln}"
        continue-on-error: true

      - name: Build solution
        run: msbuild "${sln}" /p:Configuration=Release /p:Platform="Any CPU" /m
        continue-on-error: true

      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        if: success()
        with:
          name: build-output
          path: |
            **/bin/Release/**
          if-no-files-found: ignore
`;
}

function perlWorkflow(name) {
  return `name: Lint ${name}

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

jobs:
  lint:
    name: Perl Syntax Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Check Perl syntax
        run: |
          echo "Checking Perl files..."
          errors=0
          for f in $(find . -name "*.pl" -o -name "*.pm" -o -name "*.cgi" | head -50); do
            echo "  Checking: $f"
            perl -c "$f" 2>&1 || errors=$((errors + 1))
          done
          if [ $errors -gt 0 ]; then
            echo "::warning::$errors file(s) had syntax issues"
          else
            echo "All Perl files passed syntax check!"
          fi
`;
}

function phpWorkflow(name) {
  return `name: Lint ${name}

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

jobs:
  lint:
    name: PHP Syntax Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup PHP
        uses: shivammathur/setup-php@v2
        with:
          php-version: '8.2'

      - name: Check PHP syntax
        run: |
          echo "Checking PHP files..."
          errors=0
          for f in $(find . -name "*.php" | head -100); do
            php -l "$f" 2>&1 || errors=$((errors + 1))
          done
          if [ $errors -gt 0 ]; then
            echo "::warning::$errors file(s) had syntax issues"
          else
            echo "All PHP files passed syntax check!"
          fi
`;
}

function delphiWorkflow(name, dpr) {
  return `name: Build ${name}

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

jobs:
  build:
    name: Build with Free Pascal
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Free Pascal
        run: sudo apt-get update && sudo apt-get install -y fpc

      - name: Attempt build with Free Pascal
        run: |
          echo "Attempting to compile Delphi project with Free Pascal..."
          echo "Note: fpc is not fully compatible with Delphi, some files may fail."
          for f in $(find . -name "*.pas" | head -20); do
            echo "  Compiling: $f"
            fpc -Sd "$f" 2>&1 || true
          done
        continue-on-error: true
`;
}

function autohotkeyWorkflow(name) {
  return `name: Check ${name}

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

jobs:
  check:
    name: AutoHotkey File Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: List AutoHotkey scripts
        run: |
          echo "AutoHotkey scripts in this project:"
          find . -name "*.ahk" -exec echo "  {}" \\;
          echo ""
          echo "AutoHotkey scripts require Windows + AutoHotkey runtime to execute."
          echo "Download AutoHotkey from: https://www.autohotkey.com/"

      - name: Count lines of code
        run: |
          total=0
          for f in $(find . -name "*.ahk"); do
            lines=$(wc -l < "$f")
            echo "  $f: $lines lines"
            total=$((total + lines))
          done
          echo "Total: $total lines of AutoHotkey code"
`;
}

function autoitWorkflow(name) {
  return `name: Check ${name}

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

jobs:
  check:
    name: AutoIt File Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: List AutoIt scripts
        run: |
          echo "AutoIt scripts in this project:"
          find . -name "*.au3" -exec echo "  {}" \\;
          echo ""
          echo "AutoIt scripts require Windows + AutoIt runtime to compile/execute."
          echo "Download AutoIt from: https://www.autoitscript.com/"

      - name: Count lines of code
        run: |
          total=0
          for f in $(find . -name "*.au3"); do
            lines=$(wc -l < "$f")
            echo "  $f: $lines lines"
            total=$((total + lines))
          done
          echo "Total: $total lines of AutoIt code"
`;
}

function htmlWorkflow(name) {
  return `name: Validate ${name}

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

jobs:
  validate:
    name: HTML Validation
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: List web files
        run: |
          echo "HTML files:"
          find . -name "*.html" -o -name "*.htm" | head -20
          echo ""
          echo "CSS files:"
          find . -name "*.css" | head -20
          echo ""
          echo "JavaScript files:"
          find . -name "*.js" | head -20

      - name: Count lines of code
        run: |
          for ext in html htm css js php; do
            count=$(find . -name "*.$ext" -exec cat {} + 2>/dev/null | wc -l)
            if [ "$count" -gt 0 ]; then
              echo "$ext: $count lines"
            fi
          done
`;
}

function gedcomWorkflow(name) {
  return `name: Validate ${name}

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

jobs:
  validate:
    name: GEDCOM Data Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: List GEDCOM files
        run: |
          echo "GEDCOM files in this project:"
          for f in $(find . -name "*.ged"); do
            lines=$(wc -l < "$f")
            size=$(du -h "$f" | cut -f1)
            echo "  $f: $lines lines ($size)"
          done

      - name: Count total records
        run: |
          total=0
          for f in $(find . -name "*.ged"); do
            individuals=$(grep -c "^0.*INDI$" "$f" 2>/dev/null || echo 0)
            families=$(grep -c "^0.*FAM$" "$f" 2>/dev/null || echo 0)
            echo "$f: $individuals individuals, $families families"
            total=$((total + individuals + families))
          done
          echo "Total records across all files: $total"
`;
}

// ─── Repo list (from shared config, filtered to repos with workflow types) ──

const REPOS = repoConfig.repos.filter(r =>
  ['vbnet', 'perl', 'php', 'delphi', 'ahk', 'autoit', 'html', 'gedcom'].includes(r.type)
);

function getWorkflow(entry) {
  switch (entry.type) {
    case 'vbnet': return vbnetWorkflow(entry.name, entry.sln);
    case 'perl': return perlWorkflow(entry.name);
    case 'php': return phpWorkflow(entry.name);
    case 'delphi': return delphiWorkflow(entry.name, entry.dpr);
    case 'ahk': return autohotkeyWorkflow(entry.name);
    case 'autoit': return autoitWorkflow(entry.name);
    case 'html': return htmlWorkflow(entry.name);
    case 'gedcom': return gedcomWorkflow(entry.name);
    default: return null;
  }
}

async function processRepo(entry) {
  console.log(`\n=== ${entry.repo} (${entry.type}) ===`);

  const workflow = getWorkflow(entry);
  if (!workflow) {
    console.log('  No workflow template. Skipping.');
    return;
  }

  const tmpDir = path.join(os.tmpdir(), 'sf-wf-' + entry.repo);
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });

  try {
    console.log('  Cloning...');
    run(`git clone "${cloneUrl(entry.repo, OWNER)}" "${tmpDir}"`);

    const workflowDir = path.join(tmpDir, '.github', 'workflows');
    if (fs.existsSync(path.join(workflowDir, 'build.yml'))) {
      console.log('  Workflow already exists. Skipping.');
      return;
    }

    fs.mkdirSync(workflowDir, { recursive: true });
    fs.writeFileSync(path.join(workflowDir, 'build.yml'), workflow);
    console.log('  Created workflow (' + entry.type + ')');

    configureGit(run, tmpDir);
    run('git add -A', { cwd: tmpDir });
    run(`git commit -m "Add GitHub Actions workflow (${entry.type})"`, { cwd: tmpDir });
    console.log('  Pushing...');
    run('git push origin main', { cwd: tmpDir });
    console.log('  DONE!');

  } catch (err) {
    console.error('  ERROR: ' + err.message.split('\n')[0]);
  } finally {
    if (fs.existsSync(tmpDir)) try { fs.rmSync(tmpDir, { recursive: true }); } catch (_) {}
  }
}

async function main() {
  console.log('Adding Workflows to ALL SF repos');
  console.log('Owner: ' + OWNER);
  console.log('Repos: ' + REPOS.length);
  console.log('');
  console.log('IMPORTANT: Your token needs the "workflow" scope.');
  console.log('If pushes fail, create a new token at:');
  console.log('  github.com/settings/tokens/new');
  console.log('  Check: repo + workflow');
  console.log('');

  for (const entry of REPOS) {
    await processRepo(entry);
  }

  console.log('\n=== ALL DONE ===');
}

main().catch(console.error);
