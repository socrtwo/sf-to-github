'use strict';

const { buildPushUrl, buildCloneUrl, createRepo } = require('../src/github');

describe('buildPushUrl', () => {
  it('returns URL with token embedded', () => {
    const url = buildPushUrl('my-token', 'owner', 'repo-name');
    expect(url).toBe('https://my-token@github.com/owner/repo-name.git');
  });

  it('includes the owner in the URL', () => {
    const url = buildPushUrl('tok', 'myuser', 'myrepo');
    expect(url).toContain('myuser');
  });

  it('includes the repo name in the URL', () => {
    const url = buildPushUrl('tok', 'owner', 'my-repo');
    expect(url).toContain('my-repo');
  });
});

describe('buildCloneUrl', () => {
  it('returns clean HTTPS URL without token', () => {
    const url = buildCloneUrl('owner', 'repo-name');
    expect(url).toBe('https://github.com/owner/repo-name.git');
  });

  it('does not contain any credentials', () => {
    const url = buildCloneUrl('owner', 'repo');
    expect(url).not.toContain('@');
  });
});

describe('createRepo', () => {
  it('throws without token', async () => {
    await expect(createRepo('', 'repo-name')).rejects.toThrow('GitHub token is required');
  });

  it('throws without name', async () => {
    await expect(createRepo('my-token', '')).rejects.toThrow('Repository name is required');
  });

  it('throws with null token', async () => {
    await expect(createRepo(null, 'repo-name')).rejects.toThrow('GitHub token is required');
  });

  it('throws with null name', async () => {
    await expect(createRepo('my-token', null)).rejects.toThrow('Repository name is required');
  });
});
