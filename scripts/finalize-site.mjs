import fs from 'node:fs';
import path from 'node:path';
import { loadPublicBuildEnv } from './build-env.mjs';
loadPublicBuildEnv();
const network = process.env.VITE_NETWORK || 'botMainnet';
if (!['botTestnet', 'botMainnet'].includes(network)) throw new Error('Invalid VITE_NETWORK');
const mainnet = network === 'botMainnet';
if (mainnet && process.env.VITE_CONFIRM_MAINNET_BUILD !== 'BOT_MAINNET_677') {
  throw new Error('Mainnet static site build blocked without confirmation');
}
const address = String(mainnet ? process.env.VITE_BOT_MAINNET_CONTRACT_ADDRESS || '' : process.env.VITE_BOT_TESTNET_CONTRACT_ADDRESS || '').toLowerCase();
if (address && (!/^0x[0-9a-f]{40}$/.test(address) || /^0x0{40}$/.test(address))) throw new Error('Bad or zero contract address');
if (mainnet && !address && process.env.VITE_SETUP_ONLY !== 'true') throw new Error('Mainnet pages must not be published without the mainnet contract address');
const chain = mainnet ? 677 : 968;
const progressKey = `bqmFixed${chain}_${address || 'practice'}_ProgressV1`;
// Keep the Play-page title and manifest consistent when a separate
// mainnet website is explicitly approved for publication.
if (mainnet) {
  for (const name of ['index.html', 'site.webmanifest']) {
    const file = path.resolve('dist', name);
    if (!fs.existsSync(file)) continue;
    const original = fs.readFileSync(file, 'utf8');
    fs.writeFileSync(file, original
      .replaceAll('BOT Chain Testnet', 'BOT Chain Mainnet')
      .replaceAll('BOT Testnet first', 'BOT Mainnet'));
  }
}
const folder = path.resolve('dist/pages');
for (const name of fs.readdirSync(folder).filter(s => s.endsWith('.html'))) {
  const f = path.join(folder, name);
  let html = fs.readFileSync(f, 'utf8');
  if (mainnet) {
    html = html.replaceAll('BOT Chain Testnet', 'BOT Chain Mainnet')
      .replaceAll('Testnet Fixed V1', 'Mainnet Fixed V1')
      .replaceAll('Chain ID 968', 'Chain ID 677');
  }
  if (!html.includes('page-drawer') || !html.includes('page-menu-toggle')) {
    throw new Error(`Left navigation was removed from ${name}`);
  }
  fs.writeFileSync(f, html);
}
const jsPath = path.resolve('dist/pages.js');
// Idempotent: a repeated release step cannot accidentally leave a previous
// network's progress key in the copied static pages.
const js = fs.readFileSync(jsPath, 'utf8')
  .replaceAll('__BQM_PROGRESS_KEY__', progressKey)
  .replace(/bqmFixed(?:968|677)_(?:0x[0-9a-f]{40}|practice)_ProgressV1/g, progressKey);
if (!js.includes(progressKey)) throw new Error('Failed to configure progress key');
fs.writeFileSync(jsPath, js);
console.log(`Prepared all static pages for ${mainnet ? 'BOT Mainnet (677)' : 'BOT Testnet (968)'}.`);
