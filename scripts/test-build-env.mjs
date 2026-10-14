import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadPublicBuildEnv } from './build-env.mjs';

const keys = ['VITE_SUFFIX', 'VITE_LITERAL', 'VITE_MULTILINE', 'VITE_NETWORK', 'VITE_PUBLIC_APP_URL', 'PUBLIC_APP_URL', 'DEPLOYER_PRIVATE_KEY'];
const saved = new Map(keys.map((key) => [key, process.env[key]]));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bqm-build-env-'));
try {
  for (const key of keys) delete process.env[key];
  fs.writeFileSync(path.join(tmp, '.env'),
    'VITE_NETWORK=botTestnet\nVITE_PUBLIC_APP_URL=https://example.org/default/\nDEPLOYER_PRIVATE_KEY=DO_NOT_IMPORT_SECRET\n');
  fs.writeFileSync(path.join(tmp, '.env.production'),
    'VITE_NETWORK=botMainnet\nVITE_PUBLIC_APP_URL=https://example.org/production/\n');
  loadPublicBuildEnv(tmp);
  assert.equal(process.env.VITE_NETWORK, 'botMainnet');
  assert.equal(process.env.VITE_PUBLIC_APP_URL, 'https://example.org/production/');
  assert.equal(process.env.DEPLOYER_PRIVATE_KEY, undefined);

  process.env.VITE_NETWORK = 'botTestnet';
  process.env.VITE_PUBLIC_APP_URL = 'https://example.org/actions/';
  loadPublicBuildEnv(tmp);
  assert.equal(process.env.VITE_NETWORK, 'botTestnet', 'GitHub Actions variables must override .env');
  assert.equal(process.env.VITE_PUBLIC_APP_URL, 'https://example.org/actions/');
  for (const key of keys) delete process.env[key];
  fs.writeFileSync(path.join(tmp, '.env.production.local'), [
    'VITE_NETWORK=botTestnet#inline comment',
    'VITE_SUFFIX=expanded',
    'VITE_PUBLIC_APP_URL=https://example.org/${VITE_SUFFIX}/',
    'VITE_LITERAL="literal # in quotes" # trailing comment',
    'VITE_MULTILINE="first\\nsecond"',
  ].join('\n'));
  loadPublicBuildEnv(tmp);
  assert.equal(process.env.VITE_NETWORK, 'botTestnet', 'Inline comments must match Vite');
  assert.equal(process.env.VITE_PUBLIC_APP_URL, 'https://example.org/expanded/', 'Expansion must match Vite');
  assert.equal(process.env.VITE_LITERAL, 'literal # in quotes');
  assert.equal(process.env.VITE_MULTILINE, 'first\nsecond');
  assert.equal(process.env.DEPLOYER_PRIVATE_KEY, undefined);
  console.log('Build environment precedence and secret exclusion passed.');
} finally {
  for (const [key, value] of saved) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  fs.rmSync(tmp, { recursive: true, force: true });
}
