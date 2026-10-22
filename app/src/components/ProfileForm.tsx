import { useState } from 'react';
import type { FormEvent } from 'react';

interface Props {
  onSubmit: (url: string) => void;
  loading: boolean;
}

export function ProfileForm({ onSubmit, loading }: Props) {
  const [value, setValue] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (value.trim()) onSubmit(value.trim());
  };

  return (
    <form className="profile-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="sf-profile-url" className="form-label">
          SourceForge Profile URL or Username
        </label>
        <div className="form-row">
          <input
            id="sf-profile-url"
            type="text"
            className="form-input"
            placeholder="e.g. https://sourceforge.net/u/yourusername/profile/ or yourusername"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={loading}
            autoFocus
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !value.trim()}
          >
            {loading ? (
              <>
                <span className="spinner" aria-hidden="true" /> Loading…
              </>
            ) : (
              'Fetch Projects'
            )}
          </button>
        </div>
        <p className="form-hint">
          Enter your SourceForge profile URL or just your username to list all
          your projects.
        </p>
      </div>
    </form>
  );
}
