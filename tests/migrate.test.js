'use strict';

jest.mock('../src/detect', () => ({
  detect: jest.fn(),
  ScmType: { GIT: 'git', SVN: 'svn', UNKNOWN: 'unknown' },
}));

const { planMigration, runCommand } = require('../src/migrate');
const { detect, ScmType } = require('../src/detect');

describe('planMigration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a plan for a Git project', async () => {
    detect.mockResolvedValue({
      projectName: 'test-project',
      scmType: ScmType.GIT,
      gitUrl: 'https://git.code.sf.net/p/test-project/code',
    });

    const plan = await planMigration('https://sourceforge.net/projects/test-project/');

    expect(plan).toHaveProperty('projectName', 'test-project');
    expect(plan).toHaveProperty('scmType', 'git');
    expect(plan).toHaveProperty('repoName', 'test-project');
    expect(plan).toHaveProperty('steps');
    expect(Array.isArray(plan.steps)).toBe(true);
    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan).toHaveProperty('sourceUrl', 'https://git.code.sf.net/p/test-project/code');
    expect(plan).toHaveProperty('description');
    expect(plan).toHaveProperty('workDir');
    expect(plan).toHaveProperty('githubUrl');
  });

  it('returns a plan for an SVN project', async () => {
    detect.mockResolvedValue({
      projectName: 'svn-project',
      scmType: ScmType.SVN,
      svnUrl: 'https://svn.code.sf.net/p/svn-project/code',
    });

    const plan = await planMigration('https://sourceforge.net/projects/svn-project/');

    expect(plan.scmType).toBe('svn');
    expect(plan.steps.length).toBeGreaterThan(0);
  });

  it('throws for unknown SCM type', async () => {
    detect.mockResolvedValue({
      projectName: 'unknown-project',
      scmType: ScmType.UNKNOWN,
    });

    await expect(
      planMigration('https://sourceforge.net/projects/unknown-project/')
    ).rejects.toThrow('Cannot determine SCM type');
  });

  it('each plan step has step, description, and command fields', async () => {
    detect.mockResolvedValue({
      projectName: 'test-project',
      scmType: ScmType.GIT,
      gitUrl: 'https://git.code.sf.net/p/test-project/code',
    });

    const plan = await planMigration('https://sourceforge.net/projects/test-project/');
    for (const step of plan.steps) {
      expect(step).toHaveProperty('step');
      expect(step).toHaveProperty('description');
      expect(step).toHaveProperty('command');
    }
  });

  it('uses custom repoName from options', async () => {
    detect.mockResolvedValue({
      projectName: 'test-project',
      scmType: ScmType.GIT,
      gitUrl: 'https://git.code.sf.net/p/test-project/code',
    });

    const plan = await planMigration('https://sourceforge.net/projects/test-project/', {
      repoName: 'custom-name',
    });
    expect(plan.repoName).toBe('custom-name');
  });

  it('uses custom owner from options', async () => {
    detect.mockResolvedValue({
      projectName: 'test-project',
      scmType: ScmType.GIT,
      gitUrl: 'https://git.code.sf.net/p/test-project/code',
    });

    const plan = await planMigration('https://sourceforge.net/projects/test-project/', {
      owner: 'my-org',
    });
    expect(plan.owner).toBe('my-org');
  });
});

describe('runCommand', () => {
  it('resolves for a successful command', async () => {
    const step = {
      step: 'test-echo',
      description: 'Echo test',
      cmd: 'echo',
      args: ['hello'],
    };

    const result = await runCommand(step);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('hello');
  });

  it('rejects for a failing command', async () => {
    const step = {
      step: 'test-fail',
      description: 'Failing test',
      cmd: 'node',
      args: ['-e', 'process.exit(1)'],
    };

    await expect(runCommand(step)).rejects.toHaveProperty('step', 'test-fail');
  });
});
