import axios from 'axios';
import type { SFProject } from '../types';

const SF_API_BASE = 'https://sourceforge.net/rest';

/**
 * Extract username from a SourceForge profile URL.
 * Handles formats like:
 *   https://sourceforge.net/u/username/profile/
 *   https://sourceforge.net/users/username/
 *   username (bare)
 */
export function extractUsername(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, '');
  const patterns = [
    /sourceforge\.net\/u\/([^/]+)/,
    /sourceforge\.net\/users\/([^/]+)/,
  ];
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) return match[1];
  }
  // Assume bare username if no URL pattern matched
  return trimmed.split('/').pop() || trimmed;
}

/**
 * Fetch all projects for a given SourceForge username via the JSON API.
 * Falls back to scraping if the API returns nothing.
 */
export async function fetchSFProjects(username: string): Promise<SFProject[]> {
  const url = `${SF_API_BASE}/u/${username}/`;
  const response = await axios.get(url, { timeout: 15000 });
  const data = response.data;

  const rawProjects: Array<{ name: string; shortname: string; summary: string }> =
    data?.projects ?? data?.user?.projects ?? [];

  return rawProjects.map((p) => enrichProject(p.shortname, p.name, p.summary));
}

/**
 * Determine the VCS type of a SourceForge project by querying the REST API.
 */
export async function detectVcsType(
  shortName: string
): Promise<{ vcsType: 'git' | 'svn' | 'unknown'; vcsUrl: string }> {
  try {
    const url = `${SF_API_BASE}/p/${shortName}/`;
    const response = await axios.get(url, { timeout: 10000 });
    const data = response.data;

    // Check for SCM tools listed in the project
    const tools: Array<{ name: string; mount_point: string; url: string }> =
      data?.tools ?? [];

    for (const tool of tools) {
      const name = (tool.name ?? '').toLowerCase();
      if (name === 'git') {
        const gitUrl = `https://git.code.sf.net/p/${shortName}/code`;
        return { vcsType: 'git', vcsUrl: gitUrl };
      }
      if (name === 'svn') {
        const svnUrl = `https://svn.code.sf.net/p/${shortName}/code`;
        return { vcsType: 'svn', vcsUrl: svnUrl };
      }
    }

    // Fallback: check git endpoint
    try {
      await axios.head(`https://git.code.sf.net/p/${shortName}/code`, { timeout: 5000 });
      return {
        vcsType: 'git',
        vcsUrl: `https://git.code.sf.net/p/${shortName}/code`,
      };
    } catch {
      // not git
    }

    return { vcsType: 'unknown', vcsUrl: '' };
  } catch {
    return { vcsType: 'unknown', vcsUrl: '' };
  }
}

/**
 * Build the GitHub importer URL for a given repository.
 */
export function buildGithubImportUrl(vcsUrl: string): string {
  if (!vcsUrl) return '';
  return `https://github.com/new/import?vcs_url=${encodeURIComponent(vcsUrl)}`;
}

/**
 * Create a project object with placeholder VCS info.
 */
function enrichProject(shortName: string, name: string, description: string): SFProject {
  // We will resolve VCS type lazily when the user initiates import
  const vcsUrl = `https://git.code.sf.net/p/${shortName}/code`;
  return {
    name: name || shortName,
    shortName,
    description: description || '',
    vcsType: 'unknown',
    vcsUrl,
    githubImportUrl: buildGithubImportUrl(vcsUrl),
    status: 'pending',
  };
}
