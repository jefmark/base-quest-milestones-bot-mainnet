import { defineConfig, loadEnv } from 'vite';
import { loadPublicBuildEnv } from './scripts/build-env.mjs';

function normalizeBasePath(value) {
  if (!value) return '';
  try {
    const url = new URL(value);
    const pathname = url.pathname || '/';
    return pathname.endsWith('/') ? pathname : `${pathname}/`;
  } catch {
    return '';
  }
}

function githubPagesBase() {
  const repository = process.env.GITHUB_REPOSITORY || '';
  const [owner, repo] = repository.split('/');
  if (!owner || !repo) return '/';
  if (repo.toLowerCase() === `${owner.toLowerCase()}.github.io`) return '/';
  return `/${repo}/`;
}

export default defineConfig(({ command, mode }) => {
  // Local production builds must use the same .env base as the Vite bundle.
  // Without loadEnv(), Vite embeds the intended chain while the static pages
  // and metadata post-processors might silently use a different environment.
  loadPublicBuildEnv(process.cwd(), mode);
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const publishedUrl = process.env.VITE_PUBLIC_APP_URL || env.VITE_PUBLIC_APP_URL;
  return {
    server: { host: '127.0.0.1', fs: { deny: ['.env', '.env.*', '*.{crt,pem,key,p12,pfx}', '**/.git/**', '**/operations/**'] } },
    base: command === 'build'
      ? (normalizeBasePath(publishedUrl) || (process.env.GITHUB_ACTIONS ? githubPagesBase() : '/'))
      : '/',
  };
});
