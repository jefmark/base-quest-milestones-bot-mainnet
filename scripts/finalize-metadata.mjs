import fs from 'node:fs';
import path from 'node:path';
import { loadPublicBuildEnv } from './build-env.mjs';
loadPublicBuildEnv();

function normalizeBase(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === 'localhost')) {
    throw new Error('PUBLIC_APP_URL must use HTTPS (HTTP localhost allowed for development only).');
  }
  if (url.username || url.password || url.hash || url.search) {
    throw new Error('PUBLIC_APP_URL must not contain credentials, query parameters, or fragment.');
  }
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url.href;
}

function deriveGitHubPagesUrl() {
  const repository = process.env.GITHUB_REPOSITORY || '';
  const [owner, repo] = repository.split('/');
  if (!owner || !repo) return '';
  if (repo.toLowerCase() === `${owner.toLowerCase()}.github.io`) {
    return `https://${owner}.github.io/`;
  }
  return `https://${owner}.github.io/${repo}/`;
}

const configured = process.env.VITE_PUBLIC_APP_URL || process.env.PUBLIC_APP_URL || '';
const derived = deriveGitHubPagesUrl();
const base = normalizeBase(configured || derived || 'http://localhost:4173/');
if (process.env.CI && !configured && !derived) throw new Error('Public metadata URL is not configured for CI.');
if (process.env.CI && !base.startsWith('https://')) {
  throw new Error('CI metadata publication must use a public HTTPS URL, never localhost.');
}
const metadataDir = path.resolve('dist/metadata');

if (!fs.existsSync(metadataDir)) {
  throw new Error('dist/metadata does not exist. Run Vite build before finalizing metadata.');
}

for (let i = 1; i <= 12; i += 1) {
  const file = path.join(metadataDir, `${i}.json`);
  const metadata = JSON.parse(fs.readFileSync(file, 'utf8'));
  metadata.image = new URL(`nft/${i}.png`, base).href;
  metadata.external_url = base;
  fs.writeFileSync(file, `${JSON.stringify(metadata, null, 2)}\n`);
}

console.log(`Finalized 12 metadata files for ${base}`);
