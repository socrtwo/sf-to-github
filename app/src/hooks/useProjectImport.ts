import { useState, useCallback } from 'react';
import type { SFProject, ImportStatus } from '../types';
import {
  extractUsername,
  fetchSFProjects,
  detectVcsType,
  buildGithubImportUrl,
} from '../services/sourceforge';

export function useProjectImport() {
  const [projects, setProjects] = useState<SFProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState('');

  const updateProject = useCallback(
    (shortName: string, patch: Partial<SFProject>) => {
      setProjects((prev) =>
        prev.map((p) => (p.shortName === shortName ? { ...p, ...patch } : p))
      );
    },
    []
  );

  const loadProjects = useCallback(async (profileUrl: string) => {
    setLoading(true);
    setError(null);
    setProjects([]);
    try {
      const user = extractUsername(profileUrl);
      setUsername(user);
      const list = await fetchSFProjects(user);
      if (list.length === 0) {
        setError(
          `No projects found for "${user}". ` +
            'Please double-check the SourceForge profile URL.'
        );
      }
      setProjects(list);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unknown error occurred.';
      setError(
        `Failed to fetch projects: ${message}. ` +
          'Make sure the profile URL is correct and accessible.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const resolveVcs = useCallback(
    async (shortName: string) => {
      updateProject(shortName, { status: 'importing' });
      const { vcsType, vcsUrl } = await detectVcsType(shortName);
      const githubImportUrl = buildGithubImportUrl(vcsUrl);
      updateProject(shortName, { vcsType, vcsUrl, githubImportUrl });
      return { vcsType, vcsUrl, githubImportUrl };
    },
    [updateProject]
  );

  const importProject = useCallback(
    async (shortName: string) => {
      const project = projects.find((p) => p.shortName === shortName);
      if (!project) return;

      updateProject(shortName, { status: 'importing', error: undefined });

      try {
        let { vcsType, vcsUrl, githubImportUrl } = project;

        if (vcsType === 'unknown') {
          const resolved = await resolveVcs(shortName);
          vcsType = resolved.vcsType;
          vcsUrl = resolved.vcsUrl;
          githubImportUrl = resolved.githubImportUrl;
        }

        if (!vcsUrl || vcsType === 'unknown') {
          updateProject(shortName, {
            status: 'error',
            error: 'Could not determine repository type. Please import manually.',
          });
          return;
        }

        // Open the GitHub importer in a new tab / window
        window.open(githubImportUrl, '_blank', 'noopener,noreferrer');
        updateProject(shortName, { status: 'done' });
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Unknown error occurred.';
        updateProject(shortName, { status: 'error', error: message });
      }
    },
    [projects, resolveVcs, updateProject]
  );

  const importAll = useCallback(async () => {
    const pending = projects.filter((p) => p.status === 'pending');
    for (const project of pending) {
      await importProject(project.shortName);
      // Small delay between imports to avoid overwhelming GitHub
      await new Promise((r) => setTimeout(r, 800));
    }
  }, [projects, importProject]);

  const resetStatus = useCallback((shortName: string) => {
    updateProject(shortName, { status: 'pending', error: undefined });
  }, [updateProject]);

  const setStatus = useCallback((shortName: string, status: ImportStatus) => {
    updateProject(shortName, { status });
  }, [updateProject]);

  return {
    projects,
    loading,
    error,
    username,
    loadProjects,
    importProject,
    importAll,
    resetStatus,
    setStatus,
  };
}
