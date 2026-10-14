import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Isolate the actual production transaction handler without needing a wallet,
// local chain or NPM modules. This exercises the asynchronous preflight race.
const source = fs.readFileSync('src/wallet.js', 'utf8');
const begin = source.indexOf('async function sendContractTransactionDirect(');
const end = source.indexOf('\nfunction parseRunStartedFromReceipt(', begin);
assert.ok(begin >= 0 && end > begin, 'Transaction handler is missing');
const handler = source.slice(begin, end);
const pending = [];
const context = vm.createContext({
  walletState: {
    eip1193Provider: { request: async () => [] },
    account: '0x1111111111111111111111111111111111111111',
    chainOk: true,
  },
  isAddress: () => true,
  unresolvedWalletSubmission: null,
  assertNoUnresolvedTransaction: () => new Promise((_, reject) => pending.push(reject)),
});
vm.runInContext(`let walletTransactionInFlight = false; ${handler}`, context);
const invoke = () => vm.runInContext('sendContractTransactionDirect("startRun", [1])', context);
const first = invoke();
await Promise.resolve();
assert.equal(pending.length, 1, 'First call must enter asynchronous preflight');
await assert.rejects(invoke(), /Another wallet transaction is being prepared or confirmed/,
  'Concurrent call must be blocked before a second preflight');
assert.equal(pending.length, 1, 'Only one preflight may run at a time');
pending[0](new Error('Simulated RPC failure'));
await assert.rejects(first, /Simulated RPC failure/);
const third = invoke();
await Promise.resolve();
assert.equal(pending.length, 2, 'Lock must release if the first call fails');
pending[1](new Error('Second simulated RPC failure'));
await assert.rejects(third, /Second simulated RPC failure/);
console.log('Wallet transaction race regression passed: exclusive preflight and cleanup.');

// The lock must also remain held AFTER the wallet supplies a hash, while the
// RPC confirmation is still unresolved. A second click must not open another
// approval even if eth_sendTransaction has already returned.
const account = '0x1111111111111111111111111111111111111111';
const proxy = '0x2222222222222222222222222222222222222222';
const hash = `0x${'a'.repeat(64)}`;
let confirmReceipt;
let sendCalls = 0;
const accountProvider = {
  request: async ({ method }) => {
    if (method === 'eth_accounts') return [account];
    if (method === 'eth_sendTransaction') { sendCalls++; return hash; }
    return '0x3c8';
  },
};
const fullContext = vm.createContext({
  walletState: { eip1193Provider: accountProvider, account, chainOk: true },
  CONFIG: { contractAddress: proxy },
  TARGET_CHAIN_ID: 968,
  CONTRACT_ABI: [],
  isAddress: () => true,
  normalize: (v) => String(v || '').toLowerCase(),
  unresolvedWalletSubmission: null,
  assertNoUnresolvedTransaction: async () => {},
  currentWalletChain: async () => '0x3c8',
  toHexChainId: (n) => `0x${n.toString(16)}`,
  Interface: class { encodeFunctionData() { return '0xdeadbeef'; } },
  withTimeout: (p) => p,
  rememberPendingTransaction: () => {},
  BrowserProvider: class { waitForTransaction() { return new Promise((resolve) => { confirmReceipt = resolve; }); } },
});
vm.runInContext(`let walletTransactionInFlight = false; ${handler}`, fullContext);
const call = () => vm.runInContext('sendContractTransactionDirect("startRun", [1])', fullContext);
const confirmed = call();
for (let i = 0; i < 12 && !confirmReceipt; i += 1) await new Promise((resolve) => setImmediate(resolve));
assert.equal(typeof confirmReceipt, 'function', 'First approval must reach the receipt wait');
await assert.rejects(call(), /Another wallet transaction is being prepared or confirmed/);
assert.equal(sendCalls, 1, 'One EIP-1193 approval only while the first receipt is pending');
confirmReceipt({ hash, to: proxy, from: account, status: 1 });
const completed = await confirmed;
assert.equal(completed.hash, hash);
console.log('Wallet receipt race regression passed: no duplicate approval while confirming.');

// A delayed eth_accounts must never switch the transaction to another account.
let approveAccountRead;
let raceSends = 0;
const raceProvider = { request: async ({method}) => {
  if (method === 'eth_accounts') return new Promise(resolve => { approveAccountRead = resolve; });
  if (method === 'eth_sendTransaction') { raceSends++; return hash; }
  return '0x3c8';
}};
const raceState = {eip1193Provider:raceProvider, account, chainOk:true};
const raceContext = vm.createContext({walletState:raceState,CONFIG:{contractAddress:proxy},TARGET_CHAIN_ID:968,
  isAddress:()=>true,normalize:v=>String(v||'').toLowerCase(),unresolvedWalletSubmission:null,
  assertNoUnresolvedTransaction:async()=>{},currentWalletChain:async()=> '0x3c8',toHexChainId:n=>`0x${n.toString(16)}`});
vm.runInContext(`let walletTransactionInFlight=false; ${handler}`,raceContext);
const raced=vm.runInContext('sendContractTransactionDirect("startRun",[1])',raceContext);
for(let i=0;i<10 && !approveAccountRead;i++)await new Promise(resolve=>setImmediate(resolve));
raceState.account=proxy;
approveAccountRead([account]);
await assert.rejects(raced,/Wallet changed during final authorization/);
assert.equal(raceSends,0);
console.log('Account-switch race regression passed: no transaction after identity changes.');
