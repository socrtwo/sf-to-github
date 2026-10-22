import type { SFProject } from '../types';

interface Props {
  project: SFProject;
  onImport: (shortName: string) => void;
  onReset: (shortName: string) => void;
}

const STATUS_LABELS: Record<SFProject['status'], string> = {
  pending: 'Pending',
  importing: 'Opening…',
  done: 'Opened ✓',
  error: 'Error',
  skipped: 'Skipped',
};

const STATUS_CLASS: Record<SFProject['status'], string> = {
  pending: 'status-pending',
  importing: 'status-importing',
  done: 'status-done',
  error: 'status-error',
  skipped: 'status-skipped',
};

const VCS_ICONS: Record<SFProject['vcsType'], string> = {
  git: '⎇',
  svn: '📦',
  unknown: '❓',
};

export function ProjectCard({ project, onImport, onReset }: Props) {
  const isImporting = project.status === 'importing';
  const isDone = project.status === 'done';
  const isError = project.status === 'error';

  return (
    <div className={`project-card ${project.status}`}>
      <div className="project-header">
        <span className="project-vcs" title={`VCS: ${project.vcsType}`}>
          {VCS_ICONS[project.vcsType]}
        </span>
        <div className="project-info">
          <h3 className="project-name">{project.name}</h3>
          <span className="project-short">{project.shortName}</span>
        </div>
        <span className={`status-badge ${STATUS_CLASS[project.status]}`}>
          {STATUS_LABELS[project.status]}
        </span>
      </div>

      {project.description && (
        <p className="project-description">{project.description}</p>
      )}

      {project.vcsUrl && (
        <p className="project-vcs-url">
          <span className="label">Repository: </span>
          <a href={project.vcsUrl} target="_blank" rel="noopener noreferrer">
            {project.vcsUrl}
          </a>
        </p>
      )}

      {isError && project.error && (
        <p className="project-error">{project.error}</p>
      )}

      <div className="project-actions">
        {isDone ? (
          <a
            href={project.githubImportUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-sm"
          >
            Open GitHub Importer Again
          </a>
        ) : (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => onImport(project.shortName)}
            disabled={isImporting}
          >
            {isImporting ? 'Opening…' : 'Import to GitHub'}
          </button>
        )}

        {(isDone || isError) && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => onReset(project.shortName)}
          >
            Reset
          </button>
        )}

        <a
          href={`https://sourceforge.net/projects/${project.shortName}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-ghost btn-sm"
        >
          View on SF
        </a>
      </div>
    </div>
  );
}
