'use strict';

const { parseSourceForgeUrl, ScmType } = require('../src/detect');

describe('ScmType', () => {
  it('has GIT, SVN, and UNKNOWN values', () => {
    expect(ScmType.GIT).toBe('git');
    expect(ScmType.SVN).toBe('svn');
    expect(ScmType.UNKNOWN).toBe('unknown');
  });

  it('is frozen', () => {
    expect(Object.isFrozen(ScmType)).toBe(true);
  });
});

describe('parseSourceForgeUrl', () => {
  describe('standard project URLs', () => {
    it('parses https://sourceforge.net/projects/<name>/', () => {
      const result = parseSourceForgeUrl('https://sourceforge.net/projects/my-project/');
      expect(result).toEqual({ projectName: 'my-project', scmHint: null });
    });

    it('parses without trailing slash', () => {
      const result = parseSourceForgeUrl('https://sourceforge.net/projects/my-project');
      expect(result).toEqual({ projectName: 'my-project', scmHint: null });
    });
  });

  describe('short project URLs', () => {
    it('parses https://sourceforge.net/p/<name>/code/', () => {
      const result = parseSourceForgeUrl('https://sourceforge.net/p/my-project/code/');
      expect(result).toEqual({ projectName: 'my-project', scmHint: null });
    });
  });

  describe('Git URLs', () => {
    it('parses https://git.code.sf.net/p/<name>/code', () => {
      const result = parseSourceForgeUrl('https://git.code.sf.net/p/my-project/code');
      expect(result).toEqual({ projectName: 'my-project', scmHint: ScmType.GIT });
    });

    it('parses git:// protocol URLs', () => {
      const result = parseSourceForgeUrl('git://git.code.sf.net/p/my-project/code');
      expect(result).toEqual({ projectName: 'my-project', scmHint: ScmType.GIT });
    });
  });

  describe('SVN URLs', () => {
    it('parses https://svn.code.sf.net/p/<name>/code', () => {
      const result = parseSourceForgeUrl('https://svn.code.sf.net/p/my-project/code');
      expect(result).toEqual({ projectName: 'my-project', scmHint: ScmType.SVN });
    });
  });

  describe('legacy SVN URLs', () => {
    it('parses https://<name>.svn.sourceforge.net/svnroot/<name>/', () => {
      const result = parseSourceForgeUrl('https://my-project.svn.sourceforge.net/svnroot/my-project/');
      expect(result).toEqual({ projectName: 'my-project', scmHint: ScmType.SVN });
    });
  });

  describe('invalid inputs', () => {
    it('throws on empty string', () => {
      expect(() => parseSourceForgeUrl('')).toThrow('URL must be a non-empty string');
    });

    it('throws on null', () => {
      expect(() => parseSourceForgeUrl(null)).toThrow('URL must be a non-empty string');
    });

    it('throws on undefined', () => {
      expect(() => parseSourceForgeUrl(undefined)).toThrow('URL must be a non-empty string');
    });

    it('throws on non-string input', () => {
      expect(() => parseSourceForgeUrl(123)).toThrow('URL must be a non-empty string');
    });

    it('throws on non-SourceForge URL', () => {
      expect(() => parseSourceForgeUrl('https://github.com/owner/repo')).toThrow(
        'Not a SourceForge URL'
      );
    });

    it('throws on unparseable URL', () => {
      expect(() => parseSourceForgeUrl('not-a-url')).toThrow('Invalid URL');
    });

    it('throws when project name cannot be extracted', () => {
      expect(() => parseSourceForgeUrl('https://sourceforge.net/')).toThrow(
        'Cannot extract project name'
      );
    });
  });

  describe('whitespace handling', () => {
    it('trims whitespace from input', () => {
      const result = parseSourceForgeUrl('  https://sourceforge.net/projects/my-project/  ');
      expect(result).toEqual({ projectName: 'my-project', scmHint: null });
    });
  });
});
