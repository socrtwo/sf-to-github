export interface SFProject {
  name: string;
  shortName: string;
  description: string;
  vcsType: 'git' | 'svn' | 'unknown';
  vcsUrl: string;
  githubImportUrl: string;
  status: ImportStatus;
  error?: string;
}

export type ImportStatus = 'pending' | 'importing' | 'done' | 'error' | 'skipped';

export interface SFApiProject {
  name: string;
  shortname: string;
  summary: string;
  url: string;
}

export interface SFApiResponse {
  user?: {
    name: string;
    username: string;
  };
  projects?: SFApiProject[];
}
