import { ProfileForm } from './components/ProfileForm';
import { ProjectList } from './components/ProjectList';
import { useProjectImport } from './hooks/useProjectImport';
import './App.css';

function App() {
  const {
    projects,
    loading,
    error,
    username,
    loadProjects,
    importProject,
    importAll,
    resetStatus,
  } = useProjectImport();

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="app-logo">
            <span className="logo-sf">SF</span>
            <span className="logo-arrow">→</span>
            <span className="logo-gh">GH</span>
          </div>
          <div>
            <h1 className="app-title">SourceForge → GitHub</h1>
            <p className="app-subtitle">
              Migrate your SourceForge projects to GitHub with one click
            </p>
          </div>
        </div>
      </header>

      <main className="app-main">
        <ProfileForm onSubmit={loadProjects} loading={loading} />

        {error && (
          <div className="alert alert-error" role="alert">
            <span className="alert-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {loading && (
          <div className="loading-state">
            <div className="spinner-large" aria-label="Loading projects" />
            <p>Fetching your SourceForge projects…</p>
          </div>
        )}

        <ProjectList
          projects={projects}
          onImport={importProject}
          onImportAll={importAll}
          onReset={resetStatus}
          username={username}
        />
      </main>

      <footer className="app-footer">
        <p>
          This tool opens the{' '}
          <a
            href="https://github.com/new/import"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub Import Tool
          </a>{' '}
          pre-filled for each of your SourceForge projects. A GitHub account is
          required.
        </p>
      </footer>
    </div>
  );
}

export default App;
