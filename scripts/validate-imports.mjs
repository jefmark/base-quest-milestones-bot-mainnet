import assert from 'node:assert/strict';

// This check runs only AFTER npm install. It catches Vite-breaking package
// export changes before the contract compilation or website publication steps.
const imports = [
  'vite',
  'ethers',
  '@walletconnect/ethereum-provider',
  '@web3icons/core/svgs/wallets/branded/metamask.svg.js',
  '@web3icons/core/svgs/wallets/branded/trust.svg.js',
  '@web3icons/core/svgs/wallets/branded/coinbase.svg.js',
  '@web3icons/core/svgs/wallets/branded/rabby.svg.js',
  '@web3icons/core/svgs/wallets/branded/rainbow.svg.js',
  '@web3icons/core/svgs/wallets/branded/okx.svg.js',
  '@web3icons/core/svgs/wallets/branded/zerion.svg.js',
  '@web3icons/core/svgs/wallets/branded/wallet-connect.svg.js',
  'hardhat',
];
for (const specifier of imports) {
  let resolved;
  try { resolved = import.meta.resolve(specifier); }
  catch (error) {
    throw new Error(`Dependency import cannot be resolved: ${specifier}. Fix the package/version/export before publishing.`, { cause: error });
  }
  assert.match(resolved, /^(file|node):/, `Unexpected dependency URL for ${specifier}`);
  console.log(`RESOLVED ${specifier}`);
}
console.log(`All ${imports.length} runtime/deployment import paths resolved.`);
