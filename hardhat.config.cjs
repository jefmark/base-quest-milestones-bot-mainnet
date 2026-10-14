require('@nomicfoundation/hardhat-ethers');
require('@nomicfoundation/hardhat-verify');

// Use the lockfile-pinned compiler; no remote compiler download during CI.
const { subtask } = require('hardhat/config');
const { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } = require('hardhat/builtin-tasks/task-names');
subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD).setAction(async ({ solcVersion }, hre, runSuper) => {
  if (solcVersion !== '0.8.24') return runSuper();
  const solc = require('solc');
  if (!solc.version().startsWith('0.8.24+')) throw new Error('Unexpected local compiler');
  return { compilerPath: require.resolve('solc/soljson.js'), isSolcJs: true,
    version: solcVersion, longVersion: solc.version() };
});

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: '0.8.24',
    settings: { evmVersion: 'paris', optimizer: { enabled: true, runs: 200 } }
  },
  networks: {
    hardhat: { chainId: 31337 },
    botTestnet: {
      chainId: 968,
      url: process.env.BOT_TESTNET_RPC_URL || 'https://rpc.bohr.life',
      accounts: []
    },
    botMainnet: {
      chainId: 677,
      url: process.env.BOT_MAINNET_RPC_URL || 'https://rpc.botchain.ai',
      accounts: []
    }
  },
  etherscan: {
    apiKey: { botMainnet: process.env.BOTSCAN_API_KEY || '', botTestnet: process.env.BOHRSCAN_API_KEY || '' },
    customChains: [{
      network: 'botTestnet', chainId: 968,
      urls: { apiURL: 'https://scan.bohr.life/api', browserURL: 'https://scan.bohr.life' }
    }, {
      network: 'botMainnet', chainId: 677,
      urls: { apiURL: 'https://scan.botchain.ai/api', browserURL: 'https://scan.botchain.ai' }
    }]
  }
};
