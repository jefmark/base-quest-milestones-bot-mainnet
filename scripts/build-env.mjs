import fs from 'node:fs';
import path from 'node:path';
import { loadEnv } from 'vite';

// Use the very same parser, expansion and precedence rules as the bundled app.
// Only public keys are copied into the post-build process environment.
export function loadPublicBuildEnv(directory = process.cwd(), mode = 'production') {
  const values = loadEnv(mode, directory, ['VITE_', 'PUBLIC_APP_URL']);
  const file = path.join(directory, 'site-settings.json');
  if (fs.existsSync(file)) {
    const settings = JSON.parse(fs.readFileSync(file, 'utf8'));
    const mapping = {network:'VITE_NETWORK', mainnetContractAddress:'VITE_BOT_MAINNET_CONTRACT_ADDRESS',
      testnetContractAddress:'VITE_BOT_TESTNET_CONTRACT_ADDRESS', walletConnectProjectId:'VITE_WALLETCONNECT_PROJECT_ID', publicAppUrl:'VITE_PUBLIC_APP_URL'};
    for (const [key, env] of Object.entries(mapping)) {
      if (typeof settings[key] !== 'string') throw new Error(`site-settings.json: ${key} must be a string`);
      if (values[env] === undefined && process.env[env] === undefined) values[env] = settings[key].trim();
    }
    const selected = process.env.VITE_NETWORK ?? values.VITE_NETWORK;
    if (!['botMainnet','botTestnet'].includes(selected)) throw new Error('Invalid network in site-settings.json');
    for (const key of ['VITE_BOT_MAINNET_CONTRACT_ADDRESS','VITE_BOT_TESTNET_CONTRACT_ADDRESS']) {
      const address = process.env[key] ?? values[key] ?? '';
      if (address && (!/^0x[0-9a-fA-F]{40}$/.test(address) || /^0x0{40}$/i.test(address))) throw new Error(`Invalid ${key}`);
    }
    const addressKey = selected === 'botMainnet' ? 'VITE_BOT_MAINNET_CONTRACT_ADDRESS' : 'VITE_BOT_TESTNET_CONTRACT_ADDRESS';
    values.VITE_SETUP_ONLY = (process.env[addressKey] ?? values[addressKey]) ? 'false' : 'true';
    values.VITE_CONFIRM_MAINNET_BUILD = selected === 'botMainnet' ? 'BOT_MAINNET_677' : '';
    if (!(process.env.VITE_PUBLIC_APP_URL || values.VITE_PUBLIC_APP_URL) && process.env.GITHUB_REPOSITORY) {
      const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
      values.VITE_PUBLIC_APP_URL = `https://${owner}.github.io/${repo.toLowerCase() === `${owner.toLowerCase()}.github.io` ? '' : repo + '/'}`;
    }
  }
  for (const [key, value] of Object.entries(values)) {
    if ((key.startsWith('VITE_') || key === 'PUBLIC_APP_URL') && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
