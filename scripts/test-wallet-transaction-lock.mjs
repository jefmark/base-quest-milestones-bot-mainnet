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

// Execute the production restore function, not a rewritten implementation.
// No wallet permission, signature, chain switch or transaction may be requested.
{
  const start = source.indexOf('export async function restoreWalletSession()');
  const finish = source.indexOf('\nconst providerIdentity', start);
  assert.ok(start >= 0 && finish > start);
  const restoreSource = source.slice(start, finish).replace('export async', 'async');
  const savedAccount = '0x1111111111111111111111111111111111111111';
  const changedAccount = '0x2222222222222222222222222222222222222222';
  const stored = { type:'injected', account:savedAccount, walletName:'MetaMask', providerRdns:'io.metamask' };
  function fixture({ saved=stored, rdns='io.metamask', accounts=[savedAccount], networkError=false, late=false, cancel=false, wc=false, expired=false }={}) {
    const calls=[], events=[]; let discoveryCount=0, context;
    const provider={session: expired ? null : {}, request:async ({method})=>{
      calls.push(method); assert.equal(method,'eth_accounts','Restore must be read-only');
      if(cancel) vm.runInContext('walletConnectionRevision++',context);
      return accounts;
    }};
    const state={account:'',chainOk:false};
    const item={provider,info:{rdns,name:'MetaMask'}};
    context=vm.createContext({
      readWalletSession:()=>saved, walletState:state, KNOWN_WALLETS:[{id:'metamask',name:'MetaMask'}],
      BROWSER_WALLET_ID:'browser', normalize:v=>String(v||'').toLowerCase(),
      inferProviderRdns:()=>rdns, findInstalledProvider:()=>rdns==='io.metamask'?item:null,
      discoverWalletProviders:async()=>{discoveryCount++;},
      orderedSavedWalletProviders:()=>late&&discoveryCount<2?[]:[item],
      getWalletConnectProvider:async()=>provider,
      BrowserProvider:class {constructor(raw){this.raw=raw;}},
      window:{setTimeout:fn=>{fn();return 1;}}, withTimeout:async p=>p,
      attachProviderListeners:()=>{}, persistWalletSession:()=>{}, emitWalletChanged:()=>events.push(state.account),
      ensureCorrectNetwork:async options=>{assert.equal(options.interactive,false);if(networkError)throw Error('RPC offline');state.chainOk=true;},
      console:{warn:()=>{}},
    });
    vm.runInContext(`let walletRestorePromise=null;let walletConnectionRevision=0;${restoreSource}`,context);
    return {state,calls,events,restore:()=>vm.runInContext('restoreWalletSession()',context)};
  }
  for(const options of [{},{accounts:[changedAccount]},{late:true},{networkError:true},{saved:{...stored,providerRdns:''}}]) {
    const f=fixture(options);assert.equal(await f.restore(),true,'Authorized wallet must restore after refresh');
    assert.equal(f.state.account,options.accounts?.[0]||savedAccount);assert.ok(f.events.length>0);
    assert.equal(f.state.chainOk,!options.networkError);
  }
  for(const options of [{accounts:[]},{rdns:'io.rabby'},{cancel:true},{saved:null}]) {
    const f=fixture(options);assert.equal(await f.restore(),false);assert.equal(f.state.account,'');
  }
  for(const expired of [false,true]) {
    const f=fixture({saved:{...stored,type:'walletconnect'},expired});
    assert.equal(await f.restore(),!expired);
    assert.equal(f.state.account,expired?'':savedAccount);
  }
  const f=fixture();await Promise.all([f.restore(),f.restore()]);assert.equal(f.calls.length,1,'Concurrent restores must share account lookup');
  console.log('Wallet refresh regressions passed: authorized/changed accounts, delayed injection, wrong network, locked wallet, wrong extension, cancellation, no session, WalletConnect and concurrent restore.');
}
