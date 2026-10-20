import { registerPlugin } from '@capacitor/core';

import type { NativeGitPlugin } from './definitions';

const NativeGit = registerPlugin<NativeGitPlugin>('NativeGit');

export * from './definitions';
export { NativeGit };
