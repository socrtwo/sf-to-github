export interface CloneOptions {
  url: string;
  dir: string;
  username?: string;
  password?: string;
}

export interface PushOptions {
  dir: string;
  remoteUrl: string;
  ref?: string;
  remoteRef?: string;
  force?: boolean;
  token?: string;
}

export interface BranchOptions {
  dir: string;
  remote?: string;
}

export interface TagOptions {
  dir: string;
}

export interface CleanupOptions {
  dir: string;
}

export interface CloneResult {
  success: boolean;
  dir: string;
}

export interface PushResult {
  success: boolean;
  updates: Array<{ ref: string; remoteRef: string; status: string }>;
}

export interface BranchResult {
  branches: string[];
}

export interface TagResult {
  tags: string[];
}

export interface NativeGitPlugin {
  clone(options: CloneOptions): Promise<CloneResult>;
  push(options: PushOptions): Promise<PushResult>;
  listBranches(options: BranchOptions): Promise<BranchResult>;
  listTags(options: TagOptions): Promise<TagResult>;
  cleanup(options: CleanupOptions): Promise<{ success: boolean }>;
}
