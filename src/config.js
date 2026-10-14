// Separate deployments. A testnet proxy is never a fallback for mainnet.
const viteEnv = import.meta.env || {};
const selected = String(viteEnv.VITE_NETWORK || 'botMainnet').trim();
if (!['botTestnet', 'botMainnet'].includes(selected)) {
  throw new Error('VITE_NETWORK must be botTestnet or botMainnet');
}
const isMainnet = selected === 'botMainnet';
const network = isMainnet ? {
  chainId: 677,
  chainName: 'BOT Chain Mainnet',
  rpcUrl: viteEnv.VITE_BOT_MAINNET_RPC_URL || 'https://rpc.botchain.ai',
  explorerUrl: 'https://scan.botchain.ai',
  contractAddress: viteEnv.VITE_BOT_MAINNET_CONTRACT_ADDRESS || '',
} : {
  chainId: 968,
  chainName: 'BOT Chain Testnet (Bohr)',
  rpcUrl: viteEnv.VITE_BOT_TESTNET_RPC_URL || 'https://rpc.bohr.life',
  explorerUrl: 'https://scan.bohr.life',
  contractAddress: viteEnv.VITE_BOT_TESTNET_CONTRACT_ADDRESS || '',
};
if (isMainnet && viteEnv.VITE_CONFIRM_MAINNET_BUILD !== 'BOT_MAINNET_677') {
  throw new Error('Mainnet build blocked: VITE_CONFIRM_MAINNET_BUILD must equal BOT_MAINNET_677');
}
if (isMainnet && !network.contractAddress && viteEnv.VITE_SETUP_ONLY !== 'true') {
  throw new Error('Mainnet build blocked: set VITE_BOT_MAINNET_CONTRACT_ADDRESS (a new, directly deployed contract).');
}
if (network.contractAddress && (!/^0x[0-9a-fA-F]{40}$/.test(network.contractAddress)
    || /^0x0{40}$/i.test(network.contractAddress))) {
  throw new Error('Configured contract address must be a nonzero EVM address');
}
export const CONFIG = Object.freeze({
  ...network,
  networkKey: selected,
  isMainnet,
  walletStorageKey: `bqm_fixed_${network.chainId}_wallet_v1`,
  progressStorageKey: `bqmFixed${network.chainId}_${network.contractAddress.toLowerCase() || 'practice'}_ProgressV1`,
  bestStorageKey: `bqmFixed${network.chainId}_Best`,
  soundStorageKey: `bqmFixed${network.chainId}_Sound`,
  retryStorageKey: `bqmFixed${network.chainId}_RetryLock`,
  nativeCurrencyName: 'BOT',
  nativeCurrencySymbol: 'BOT',
  nativeCurrencyDecimals: 18,
  walletConnectProjectId: viteEnv.VITE_WALLETCONNECT_PROJECT_ID || '',
  publicAppUrl: viteEnv.VITE_PUBLIC_APP_URL || '',
  maxMilestone: 12,
  verifiedRunRequiredForMint: true,
  version: `${selected} Fixed V1`,
});

export const CONTRACT_ABI = [
  'function startRun(uint256 milestone) external returns (uint64 nonce,bytes32 challenge)',
  'function cancelRun() external',
  'function mintMilestone(uint256 milestone,uint256 clientScore,uint256 playSeconds,uint64 expectedRunNonce) external returns (uint256)',
  'function getActiveRun(address player) external view returns (uint64 nonce,uint64 startedAt,uint32 milestone,bytes32 challenge,bool active)',
  'function hasMintedMilestone(address player,uint256 milestone) external view returns (bool)',
  'function mintedByProtocol(address player,uint256 milestone) external view returns (bool)',
  'function highestCompletedMilestone(address player) external view returns (uint256)',
  'function getMilestone(uint256 milestone) external view returns (tuple(uint32 requiredScore,uint32 minPlaySeconds,bool active,string name))',
  'function paused() external view returns (bool)',
  'function deploymentKind() external pure returns (string)',
  'function MAX_MILESTONE() external view returns (uint256)',
  'function owner() external view returns (address)',
  'function lastMintAt(address player) external view returns (uint256)',
  'function mintCooldown() external view returns (uint256)',
  'function MAX_RUN_SECONDS() external view returns (uint256)',
  'function MAX_SCORE_PER_SECOND() external view returns (uint256)',
  'function SCORE_BURST_ALLOWANCE() external view returns (uint256)',
  'event RunStarted(address indexed player,uint256 indexed milestone,uint64 indexed nonce,uint64 startedAt,bytes32 challenge)',
  'event RunCancelled(address indexed player,uint64 indexed nonce)',
  'event RunConsumed(address indexed player,uint64 indexed nonce,uint256 indexed milestone)',
  'event RunAdvanced(address indexed player,uint64 indexed nonce,uint256 indexed nextMilestone,uint64 startedAt,bytes32 challenge)',
  'event MilestoneMinted(address indexed player,uint256 indexed milestone,uint256 indexed tokenId,uint256 clientScore,uint256 playSeconds,uint64 runNonce)',
];
