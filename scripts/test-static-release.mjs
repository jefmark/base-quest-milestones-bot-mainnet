import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const iconBytes = fs.readFileSync(path.join(root, 'public/favicon-runner-v2.png'));
assert.equal(iconBytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'Runner icon must contain real PNG bytes');
assert.equal(iconBytes.readUInt32BE(16), 1254);
assert.equal(iconBytes.readUInt32BE(20), 1254);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bqm-static-'));
const output = path.join(tmp, 'dist');
fs.mkdirSync(path.join(output, 'pages'), { recursive: true });
fs.cpSync(path.join(root, 'public/pages'), path.join(output, 'pages'), { recursive: true });
fs.cpSync(path.join(root, 'public/metadata'), path.join(output, 'metadata'), { recursive: true });
fs.copyFileSync(path.join(root, 'public/pages.js'), path.join(output, 'pages.js'));
fs.copyFileSync(path.join(root, 'index.html'), path.join(output, 'index.html'));
fs.copyFileSync(path.join(root, 'public/site.webmanifest'), path.join(output, 'site.webmanifest'));

const env = {
  ...process.env,
  VITE_NETWORK: 'botTestnet',
  VITE_PUBLIC_APP_URL: 'https://example.org/bqm-fresh/',
  VITE_BOT_TESTNET_CONTRACT_ADDRESS: '0x' + '1'.repeat(40),
  VITE_BOT_MAINNET_CONTRACT_ADDRESS: '',
  VITE_CONFIRM_MAINNET_BUILD: '',
};
const run = (script, customEnv = env, shouldFail = false) => {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts', script)],
    { cwd: tmp, env: customEnv, encoding: 'utf8', timeout: 12000 });
  if (result.error) throw result.error;
  assert.equal(result.signal, null, `${script} was terminated instead of completing`);
  if (shouldFail) {
    assert.ok(Number.isInteger(result.status) && result.status > 0,
      `${script} unexpectedly passed`);
  } else {
    assert.equal(result.status, 0, `${script} failed: ${result.stderr}`);
  }
};

try {
  // Testnet can publish automatically; mainnet cannot publish via Git push.
  run('assert-release-approval.mjs', { ...env, GITHUB_EVENT_NAME: 'push' });
  run('assert-release-approval.mjs', { ...env, VITE_NETWORK: 'botMainnet',
    VITE_CONFIRM_MAINNET_BUILD: 'BOT_MAINNET_677', VITE_BOT_MAINNET_CONTRACT_ADDRESS: '0x' + '2'.repeat(40),
    GITHUB_EVENT_NAME: 'push' }, true);
  run('assert-release-approval.mjs', { ...env, VITE_NETWORK: 'botMainnet',
    VITE_CONFIRM_MAINNET_BUILD: 'BOT_MAINNET_677', VITE_BOT_MAINNET_CONTRACT_ADDRESS: '0x' + '1'.repeat(40),
    GITHUB_EVENT_NAME: 'workflow_dispatch' }, true);
  run('assert-release-approval.mjs', { ...env, VITE_NETWORK: 'botMainnet',
    VITE_CONFIRM_MAINNET_BUILD: 'BOT_MAINNET_677', VITE_BOT_MAINNET_CONTRACT_ADDRESS: '0x' + '2'.repeat(40),
    GITHUB_EVENT_NAME: 'workflow_dispatch' });
  run('finalize-site.mjs');
  assert.match(fs.readFileSync(path.join(output, 'index.html'), 'utf8'), /BOT Chain Testnet/);
  assert.match(JSON.parse(fs.readFileSync(path.join(output, 'site.webmanifest'))).description, /BOT Chain Testnet/);
  run('finalize-metadata.mjs');
  // CI must never publish token metadata that references localhost.
  run('finalize-metadata.mjs', { ...env, CI: 'true',
    VITE_PUBLIC_APP_URL: 'http://localhost:4173/' }, true);
  let js = fs.readFileSync(path.join(output, 'pages.js'), 'utf8');
  assert.ok(js.includes(`bqmFixed968_${env.VITE_BOT_TESTNET_CONTRACT_ADDRESS.toLowerCase()}_ProgressV1`));
  assert.ok(!js.includes('__BQM_PROGRESS_KEY__'));
  for (let i = 1; i <= 12; i++) {
    const m = JSON.parse(fs.readFileSync(path.join(output, `metadata/${i}.json`)));
    assert.equal(m.image, `https://example.org/bqm-fresh/nft/${i}.png`);
    assert.equal(m.external_url, 'https://example.org/bqm-fresh/');
  }
  for (const page of fs.readdirSync(path.join(output, 'pages'))) {
    const html = fs.readFileSync(path.join(output, 'pages', page), 'utf8');
    assert.ok(html.includes('page-menu') && html.includes('page-drawer'));
  }
  run('finalize-site.mjs', { ...env, VITE_NETWORK: 'botMainnet' }, true);
  run('finalize-site.mjs', { ...env, VITE_NETWORK: 'botMainnet', VITE_CONFIRM_MAINNET_BUILD: 'BOT_MAINNET_677' }, true);
  run('finalize-site.mjs', { ...env, VITE_NETWORK: 'botMainnet',
    VITE_CONFIRM_MAINNET_BUILD: 'BOT_MAINNET_677', VITE_BOT_MAINNET_CONTRACT_ADDRESS: '0x' + '2'.repeat(40) });
  js = fs.readFileSync(path.join(output, 'pages.js'), 'utf8');
  assert.ok(js.includes(`bqmFixed677_${'0x' + '2'.repeat(40)}_ProgressV1`));
  assert.ok(fs.readFileSync(path.join(output, 'pages/home.html'), 'utf8').includes('BOT Chain Mainnet'));
  const entry = fs.readFileSync(path.join(output, 'index.html'), 'utf8');
  assert.match(entry, /BOT Chain Mainnet/);
  assert.doesNotMatch(entry, /Testnet|Mainnet-first/);
  assert.match(entry, /favicon-runner-v2\.png\?v=20261019/);
  assert.match(entry, /rel="shortcut icon"/);
  assert.match(JSON.parse(fs.readFileSync(path.join(output, 'site.webmanifest'))).description, /BOT Chain Mainnet/);
  console.log('Static release tests passed: 8 pages, 12 NFTs, metadata HTTPS, isolated networks and manual-only mainnet release.');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
