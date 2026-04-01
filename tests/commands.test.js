'use strict';

const { gitMirrorCommands, svnMigrationCommands, workDirPath } = require('../src/commands');

describe('gitMirrorCommands', () => {
  const sourceUrl = 'https://git.code.sf.net/p/my-project/code';
  const githubUrl = 'https://token@github.com/owner/my-project.git';
  const workDir = '/work/sf2gh-my-project-123';

  it('returns an array of 3 steps', () => {
    const steps = gitMirrorCommands(sourceUrl, githubUrl, workDir);
    expect(steps).toHaveLength(3);
  });

  it('has clone, set-remote, and push steps', () => {
    const steps = gitMirrorCommands(sourceUrl, githubUrl, workDir);
    expect(steps[0].step).toBe('clone');
    expect(steps[1].step).toBe('set-remote');
    expect(steps[2].step).toBe('push');
  });

  it('each step has required fields', () => {
    const steps = gitMirrorCommands(sourceUrl, githubUrl, workDir);
    for (const step of steps) {
      expect(step).toHaveProperty('step');
      expect(step).toHaveProperty('description');
      expect(step).toHaveProperty('cmd');
      expect(step).toHaveProperty('args');
      expect(typeof step.step).toBe('string');
      expect(typeof step.description).toBe('string');
      expect(typeof step.cmd).toBe('string');
      expect(Array.isArray(step.args)).toBe(true);
    }
  });

  it('clone step uses git clone --mirror with source and work dir', () => {
    const steps = gitMirrorCommands(sourceUrl, githubUrl, workDir);
    expect(steps[0].cmd).toBe('git');
    expect(steps[0].args).toEqual(['clone', '--mirror', sourceUrl, workDir]);
  });

  it('set-remote step uses the github URL', () => {
    const steps = gitMirrorCommands(sourceUrl, githubUrl, workDir);
    expect(steps[1].args).toContain(githubUrl);
    expect(steps[1].cwd).toBe(workDir);
  });

  it('push step uses --mirror flag', () => {
    const steps = gitMirrorCommands(sourceUrl, githubUrl, workDir);
    expect(steps[2].args).toContain('--mirror');
    expect(steps[2].cwd).toBe(workDir);
  });

  it('throws when sourceUrl is missing', () => {
    expect(() => gitMirrorCommands('', githubUrl, workDir)).toThrow('sourceUrl is required');
  });

  it('throws when githubUrl is missing', () => {
    expect(() => gitMirrorCommands(sourceUrl, '', workDir)).toThrow('githubUrl is required');
  });

  it('throws when workDir is missing', () => {
    expect(() => gitMirrorCommands(sourceUrl, githubUrl, '')).toThrow('workDir is required');
  });
});

describe('svnMigrationCommands', () => {
  const svnUrl = 'https://svn.code.sf.net/p/my-project/code';
  const githubUrl = 'https://token@github.com/owner/my-project.git';
  const workDir = '/work/sf2gh-my-project-123';

  it('returns an array of 6 steps', () => {
    const steps = svnMigrationCommands(svnUrl, githubUrl, workDir);
    expect(steps).toHaveLength(6);
  });

  it('includes all required step names', () => {
    const steps = svnMigrationCommands(svnUrl, githubUrl, workDir);
    const stepNames = steps.map((s) => s.step);
    expect(stepNames).toEqual([
      'svn-clone',
      'convert-branches',
      'convert-tags',
      'add-remote',
      'push-branches',
      'push-tags',
    ]);
  });

  it('each step has required fields', () => {
    const steps = svnMigrationCommands(svnUrl, githubUrl, workDir);
    for (const step of steps) {
      expect(step).toHaveProperty('step');
      expect(step).toHaveProperty('description');
      expect(step).toHaveProperty('cmd');
      expect(step).toHaveProperty('args');
    }
  });

  it('svn-clone step uses git svn clone --stdlayout', () => {
    const steps = svnMigrationCommands(svnUrl, githubUrl, workDir);
    expect(steps[0].cmd).toBe('git');
    expect(steps[0].args).toContain('svn');
    expect(steps[0].args).toContain('clone');
    expect(steps[0].args).toContain('--stdlayout');
  });

  it('add-remote step adds the github URL as origin', () => {
    const steps = svnMigrationCommands(svnUrl, githubUrl, workDir);
    const addRemote = steps.find((s) => s.step === 'add-remote');
    expect(addRemote.args).toContain(githubUrl);
    expect(addRemote.cwd).toBe(workDir);
  });

  it('throws when svnUrl is missing', () => {
    expect(() => svnMigrationCommands('', githubUrl, workDir)).toThrow('svnUrl is required');
  });

  it('throws when githubUrl is missing', () => {
    expect(() => svnMigrationCommands(svnUrl, '', workDir)).toThrow('githubUrl is required');
  });

  it('throws when workDir is missing', () => {
    expect(() => svnMigrationCommands(svnUrl, githubUrl, '')).toThrow('workDir is required');
  });
});

describe('workDirPath', () => {
  it('returns a path under the given base directory', () => {
    const result = workDirPath('/base/tmp', 'my-project');
    expect(result).toMatch(/^\/base\/tmp\//);
  });

  it('includes the project name in the path', () => {
    const result = workDirPath('/base/tmp', 'my-project');
    expect(result).toContain('my-project');
  });

  it('includes the sf2gh prefix', () => {
    const result = workDirPath('/base/tmp', 'my-project');
    expect(result).toContain('sf2gh-');
  });
});
