import { describe, it, expect } from 'vitest';
import {
  extractUsername,
  buildGithubImportUrl,
} from '../services/sourceforge';

describe('extractUsername', () => {
  it('extracts username from /u/ style URL', () => {
    expect(extractUsername('https://sourceforge.net/u/johndoe/profile/')).toBe('johndoe');
  });

  it('extracts username from /users/ style URL', () => {
    expect(extractUsername('https://sourceforge.net/users/janedoe/')).toBe('janedoe');
  });

  it('returns bare username unchanged', () => {
    expect(extractUsername('myuser')).toBe('myuser');
  });

  it('trims whitespace and trailing slashes', () => {
    expect(extractUsername('  johndoe  ')).toBe('johndoe');
  });

  it('handles URL without trailing slash', () => {
    expect(extractUsername('https://sourceforge.net/u/alice/profile')).toBe('alice');
  });
});

describe('buildGithubImportUrl', () => {
  it('builds a correct GitHub import URL for a git repo', () => {
    const vcsUrl = 'https://git.code.sf.net/p/myproject/code';
    const result = buildGithubImportUrl(vcsUrl);
    expect(result).toBe(
      'https://github.com/new/import?vcs_url=https%3A%2F%2Fgit.code.sf.net%2Fp%2Fmyproject%2Fcode'
    );
  });

  it('builds a correct GitHub import URL for an SVN repo', () => {
    const vcsUrl = 'https://svn.code.sf.net/p/mysvnproject/code';
    const result = buildGithubImportUrl(vcsUrl);
    expect(result).toBe(
      'https://github.com/new/import?vcs_url=https%3A%2F%2Fsvn.code.sf.net%2Fp%2Fmysvnproject%2Fcode'
    );
  });

  it('returns empty string for empty vcsUrl', () => {
    expect(buildGithubImportUrl('')).toBe('');
  });

  it('URL-encodes special characters in the repo URL', () => {
    const result = buildGithubImportUrl('https://example.com/repo with spaces');
    expect(result).toContain('repo%20with%20spaces');
  });
});
