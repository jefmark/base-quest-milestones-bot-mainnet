import assert from 'node:assert/strict';
import { loadPublicBuildEnv } from './build-env.mjs';
loadPublicBuildEnv();

const network = String(process.env.VITE_NETWORK || 'botMainnet').trim();
assert.ok(['botTestnet', 'botMainnet'].includes(network), 'Invalid VITE_NETWORK');
if (network === 'botMainnet') {
  assert.equal(process.env.VITE_CONFIRM_MAINNET_BUILD, 'BOT_MAINNET_677',
    'Mainnet requires explicit BOT_MAINNET_677 build confirmation.');
  assert.equal(process.env.GITHUB_EVENT_NAME, 'workflow_dispatch',
    'MAINNET RELEASE BLOCKED: use Actions > Deploy BOT Fixed Contract Website > Run workflow; pushes must never auto-release mainnet.');
  const address = String(process.env.VITE_BOT_MAINNET_CONTRACT_ADDRESS || '').trim();
  if (!address && process.env.VITE_SETUP_ONLY === 'true') {
    console.log('Setup-only publication: contract minting disabled.');
    process.exit(0);
  }
  assert.match(address, /^0x[0-9a-fA-F]{40}$/, 'A separately deployed mainnet contract address is required.');
  assert.doesNotMatch(address, /^0x0{40}$/i, 'Mainnet contract cannot be the zero address.');
  const testnet = String(process.env.VITE_BOT_TESTNET_CONTRACT_ADDRESS || '').trim();
  assert.notEqual(address.toLowerCase(), testnet.toLowerCase(),
    'Mainnet contract address must be different from the configured testnet contract address.');
}
console.log(`Release approval gate passed for ${network}.`);
