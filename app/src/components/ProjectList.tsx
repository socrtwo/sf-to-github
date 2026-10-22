import type { SFProject } from '../types';
import { ProjectCard } from './ProjectCard';

interface Props {
  projects: SFProject[];
  onImport: (shortName: string) => void;
  onImportAll: () => void;
  onReset: (shortName: string) => void;
  username: string;
}

export function ProjectList({
  projects,
  onImport,
  onImportAll,
  onReset,
  username,
}: Props) {
  if (projects.length === 0) return null;

  const pendingCount = projects.filter((p) => p.status === 'pending').length;
  const doneCount = projects.filter((p) => p.status === 'done').length;

  return (
    <section className="project-list-section">
      <div className="list-header">
        <h2 className="list-title">
          Projects for <span className="username">@{username}</span>
          <span className="project-count">{projects.length}</span>
        </h2>
        <div className="list-stats">
          <span className="stat">
            <span className="stat-value">{doneCount}</span> imported
          </span>
          <span className="stat">
            <span className="stat-value">{pendingCount}</span> pending
          </span>
        </div>
        {pendingCount > 0 && (
          <button className="btn btn-primary" onClick={onImportAll}>
            Import All ({pendingCount})
          </button>
        )}
      </div>

      <div className="info-box">
        <p>
          <strong>How it works:</strong> Clicking <em>Import to GitHub</em>{' '}
          will open the GitHub importer pre-filled with the SourceForge
          repository URL. Sign in to GitHub and follow the prompts to complete
          each import.
        </p>
      </div>

      <div className="project-grid">
        {projects.map((project) => (
          <ProjectCard
            key={project.shortName}
            project={project}
            onImport={onImport}
            onReset={onReset}
          />
        ))}
      </div>
    </section>
  );
}
