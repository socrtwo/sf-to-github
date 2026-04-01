'use strict';

const { sanitizeRepoName, buildDescription } = require('../src/sanitize');

describe('sanitizeRepoName', () => {
  it('keeps valid names unchanged', () => {
    expect(sanitizeRepoName('my-project')).toBe('my-project');
  });

  it('replaces spaces with hyphens', () => {
    expect(sanitizeRepoName('my project')).toBe('my-project');
  });

  it('replaces special characters with hyphens', () => {
    expect(sanitizeRepoName('my@project!')).toBe('my-project');
  });

  it('collapses consecutive hyphens', () => {
    expect(sanitizeRepoName('my--project')).toBe('my-project');
  });

  it('removes trailing .git suffix', () => {
    expect(sanitizeRepoName('project.git')).toBe('project');
  });

  it('removes leading periods', () => {
    expect(sanitizeRepoName('..project')).toBe('project');
  });

  it('removes leading hyphens', () => {
    expect(sanitizeRepoName('--project')).toBe('project');
  });

  it('converts to lowercase', () => {
    expect(sanitizeRepoName('MyProject')).toBe('myproject');
  });

  it('handles mixed case with special characters', () => {
    expect(sanitizeRepoName('My Cool Project!')).toBe('my-cool-project');
  });

  it('collapses consecutive periods', () => {
    expect(sanitizeRepoName('my..project')).toBe('my.project');
  });

  it('removes trailing hyphens', () => {
    expect(sanitizeRepoName('project--')).toBe('project');
  });

  it('trims whitespace', () => {
    expect(sanitizeRepoName('  my-project  ')).toBe('my-project');
  });

  it('throws on empty string', () => {
    expect(() => sanitizeRepoName('')).toThrow('Repository name must be a non-empty string');
  });

  it('throws on null', () => {
    expect(() => sanitizeRepoName(null)).toThrow('Repository name must be a non-empty string');
  });

  it('throws on undefined', () => {
    expect(() => sanitizeRepoName(undefined)).toThrow('Repository name must be a non-empty string');
  });

  it('throws when name becomes empty after sanitizing', () => {
    expect(() => sanitizeRepoName('!!!')).toThrow('Cannot produce valid repository name');
  });
});

describe('buildDescription', () => {
  it('returns formatted description with project name and URL', () => {
    const result = buildDescription('my-project', 'https://sourceforge.net/projects/my-project/');
    expect(result).toBe(
      'Migrated from SourceForge project "my-project" (https://sourceforge.net/projects/my-project/)'
    );
  });

  it('includes both project name and source URL', () => {
    const result = buildDescription('test-proj', 'https://sf.net/p/test-proj/');
    expect(result).toContain('test-proj');
    expect(result).toContain('https://sf.net/p/test-proj/');
  });
});
