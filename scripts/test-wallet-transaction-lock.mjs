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
  capturePendingTransactionMetadata: async () => {},
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
      ensureCorrectNetwork:async options=>{assert.equal(options.interactive,true);if(networkError)throw Error('RPC offline');state.chainOk=true;},
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

// Exercise production network switching, including nested MetaMask errors.
{
  const networkSource = source.slice(source.indexOf('function walletChainErrorCode('),
    source.indexOf('export async function requestBotNetwork(')).replaceAll('export async', 'async');
  async function scenario({ missing=false, reject=false, passive=false, correct=false, change=false, wc=false }={}) {
    let chain=correct?'0x2a5':'0x1', added=false;
    const calls=[];
    const account='0x1111111111111111111111111111111111111111';
    const state={account,chainOk:true,connectionType:wc?'walletconnect':'injected'};
    const provider={request:async request=>{
      calls.push(request);
      if(request.method==='eth_chainId')return chain;
      if(request.method==='wallet_addEthereumChain'){added=true;return null;}
      if(request.method==='wallet_switchEthereumChain'){
        if(change){state.account='0x2222222222222222222222222222222222222222';return null;}
        if(reject)throw {code:4001,message:'User rejected'};
        if(missing&&!added)throw {code:-32603,data:{originalError:{code:4902}}};
        chain=request.params[0].chainId;return null;
      }
      throw Error(`Unexpected request ${request.method}`);
    }};
    state.eip1193Provider=provider;
    const ctx=vm.createContext({walletState:state,walletConnectionRevision:0,
      TARGET_CHAIN_ID:677,TARGET_CAIP_CHAIN_ID:'eip155:677',
      CONFIG:{chainName:'BOT Mainnet',nativeCurrencyName:'BOT',nativeCurrencySymbol:'BOT',
        nativeCurrencyDecimals:18,rpcUrl:'https://rpc.botchain.ai',explorerUrl:'https://explorer.botchain.ai'},
      normalize:v=>String(v||'').toLowerCase(),toHexChainId:n=>`0x${Number(n).toString(16)}`,
      isAddress:v=>/^0x[0-9a-f]{40}$/i.test(v),normalizeRpcError:e=>e,
      BrowserProvider:class {async getSigner(a){return {getAddress:async()=>a};}},
      createContractIfReady:()=>{},window:{setTimeout:fn=>fn()}});
    vm.runInContext(networkSource,ctx);
    const run=()=>vm.runInContext(`ensureCorrectNetwork({interactive:${!passive}})`,ctx);
    if(reject||change||wc) await assert.rejects(run);
    else assert.equal(await run(),!passive||correct);
    return {calls,state};
  }
  for(const missing of [false,true]) {
    const {calls,state}=await scenario({missing});
    assert.equal(state.chainOk,true);
    assert.equal(calls.filter(c=>c.method==='wallet_addEthereumChain').length,Number(missing));
    if(missing){
      const params=calls.find(c=>c.method==='wallet_addEthereumChain').params[0];
      assert.equal(params.chainId,'0x2a5'); assert.equal(params.nativeCurrency.symbol,'BOT');
      assert.equal(calls.filter(c=>c.method==='wallet_switchEthereumChain').length,2);
    }
  }
  for(const options of [{reject:true},{passive:true},{correct:true},{wc:true},{change:true}]) {
    const {calls,state}=await scenario(options);
    if(!options.correct) assert.equal(state.chainOk,false,'Failed setup must clear stale network readiness');
    assert.equal(calls.some(c=>c.method==='wallet_addEthereumChain'),false);
    if(options.passive||options.correct||options.wc)
      assert.equal(calls.some(c=>c.method==='wallet_switchEthereumChain'),false);
  }
  console.log('Network regressions passed: switch, nested 4902, add-then-switch, rejection, passive checks, correct chain, WalletConnect approval and account changes.');
}

// Add-first connection path must not rely on wallet-specific unknown-chain errors.
{
  const networkSource = source.slice(source.indexOf('function walletChainErrorCode('),
    source.indexOf('export async function requestBotNetwork(')).replaceAll('export async', 'async');
  for (const mode of ['normal','auto-switch','slow','reject','pending','unsupported-add','concurrent','passive','correct']) {
    const account='0x1111111111111111111111111111111111111111';
    let chain=mode==='correct'?'0x2a5':'0x1', added=false, polls=0, switched=false;
    const calls=[];
    const provider={request:async r=>{
      calls.push(r.method);
      if(r.method==='eth_chainId') {
        if(mode==='slow'&&switched&&++polls===8)chain='0x2a5';
        return chain;
      }
      if(r.method==='wallet_addEthereumChain') {
        assert.equal(r.params[0].chainId,'0x2a5');
        assert.equal(r.params[0].rpcUrls[0],'https://rpc.botchain.ai');
        assert.equal(r.params[0].blockExplorerUrls[0],'https://scan.botchain.ai');
        if(mode==='reject')throw {code:4001,message:'User rejected'};
        if(mode==='pending')throw {code:-32002,message:'Already pending'};
        if(mode==='unsupported-add')throw {code:4200,message:'Unsupported method'};
        added=true;if(mode==='auto-switch')chain='0x2a5';return null;
      }
      if(r.method==='wallet_switchEthereumChain') {
        if(!added&&mode!=='unsupported-add')throw {code:5001,message:'Custom network not configured'};
        switched=true;if(mode!=='slow')chain='0x2a5';return null;
      }
      throw Error(r.method);
    }};
    const state={account,chainOk:false,connectionType:'injected',eip1193Provider:provider};
    const ctx=vm.createContext({walletState:state,walletConnectionRevision:0,
      TARGET_CHAIN_ID:677,TARGET_CAIP_CHAIN_ID:'eip155:677',
      CONFIG:{chainName:'BOT Chain Mainnet',nativeCurrencyName:'BOT',nativeCurrencySymbol:'BOT',nativeCurrencyDecimals:18,
        rpcUrl:'https://rpc.botchain.ai',explorerUrl:'https://scan.botchain.ai'},
      normalize:v=>String(v||'').toLowerCase(),toHexChainId:n=>`0x${Number(n).toString(16)}`,
      isAddress:v=>/^0x[0-9a-f]{40}$/i.test(v),normalizeRpcError:e=>e,
      BrowserProvider:class {async getSigner(a){return {getAddress:async()=>a};}},
      createContractIfReady:()=>{},window:{setTimeout:fn=>fn()}});
    vm.runInContext(networkSource,ctx);
    const run=()=>vm.runInContext(`ensureCorrectNetwork({interactive:${mode!=='passive'},addFirst:true})`,ctx);
    if(mode==='reject'||mode==='pending')await assert.rejects(run);
    else if(mode==='concurrent')await Promise.all([run(),run(),run()]);
    else assert.equal(await run(),mode!=='passive');
    const count=m=>calls.filter(c=>c===m).length;
    assert.equal(count('wallet_addEthereumChain'),['passive','correct'].includes(mode)?0:1,mode);
    assert.equal(count('wallet_switchEthereumChain'),['reject','pending','passive','correct','auto-switch'].includes(mode)?0:1,mode);
    assert.equal(state.chainOk,!['reject','pending','passive'].includes(mode),mode);
  }
  console.log('Add-first network regressions passed: generic missing-network errors, auto-switch, delayed switch, rejection, pending request, unsupported add, concurrent requests, passive reads and already-correct chain.');
}

// A close/rejection may remove the picker before its click bubbles to the overlay.
{
 const begin=source.indexOf("  const overlay = pickerRoot.querySelector('.bqm-wallet-overlay');");
 const end=source.indexOf('\n  for (const button',begin);
 assert.ok(begin>=0&&end>begin);
 let handler,closed=0;
 const overlay={addEventListener:(_name,fn)=>{handler=fn;}};
 const ctx=vm.createContext({pickerRoot:{querySelector:()=>overlay},closeWalletPicker:()=>closed++});
 vm.runInContext(source.slice(begin,end),ctx);
 ctx.pickerRoot=null;
 assert.doesNotThrow(()=>handler({target:{}}));assert.equal(closed,0);
 handler({target:overlay});assert.equal(closed,1);
 console.log('Wallet picker close/rejection bubbling regression passed.');
}

// A late account authorization must not resurrect a disconnected wallet or
// overwrite another wallet selected while the first request was pending.
{
 const begin=source.indexOf('async function connectWithProvider('),end=source.indexOf('async function connectWalletConnect(',begin);
 for(const superseded of [false,true]){
  let release;const p={request:()=>new Promise(r=>{release=r;})};
  const state={};const replacement={request:async()=>[]};
  const ctx=vm.createContext({walletState:state,p,normalizeRpcError:e=>e,
   clearProviderListeners:()=>{},resetWalletState:()=>Object.assign(state,{account:'',eip1193Provider:null}),
   BrowserProvider:class{},persistWalletSession:()=>{throw Error('Stale session must not persist');}});
  vm.runInContext(`let walletConnectionRevision=0;${source.slice(begin,end)}`,ctx);
  const pending=vm.runInContext('connectWithProvider(p)',ctx);
  vm.runInContext('walletConnectionRevision++',ctx);
  if(superseded)Object.assign(state,{account:'replacement',eip1193Provider:replacement});
  release(['0x1111111111111111111111111111111111111111']);
  await assert.rejects(pending,/cancelled or superseded/);
  assert.equal(state.account,superseded?'replacement':'');
 }
 console.log('Late wallet authorization cancellation/supersession regressions passed.');
}

// Exercise the production WalletConnect read wrapper without opening a wallet.
{
  const quietSource = source.slice(source.indexOf('const quietWalletConnectProviders ='),
    source.indexOf('async function getWalletConnectProvider('));
  const account = '0x1111111111111111111111111111111111111111';
  const fixture = ({ mode = 'normal' } = {}) => {
    const walletCalls = [], rpcCalls = [];
    let chain = '0x2a5';
    const state = { account };
    const provider = {
      session: { namespaces: { eip155: { accounts: [`eip155:677:${account}`], methods: ['eth_sendTransaction'] } } },
      request: async args => { walletCalls.push(args.method); return args.method === 'eth_chainId' ? chain : 'wallet-result'; },
    };
    if (mode === 'unapproved') provider.session.namespaces.eip155.accounts = [`eip155:1:${account}`];
    if (mode === 'wrong-wallet-chain') chain = '0x1';
    const context = vm.createContext({
      walletConnectionRevision: 0, walletState: state,
      normalize: value => String(value || '').toLowerCase(),
      TARGET_CHAIN_ID: 677, TARGET_CAIP_CHAIN_ID: 'eip155:677',
      CONFIG: { rpcUrl: 'https://rpc.example.invalid', chainName: 'BOT Chain Mainnet' },
      AbortController, window: { setTimeout, clearTimeout },
      fetch: async (_url, options) => {
        const request = JSON.parse(options.body); rpcCalls.push(request.method);
        if (mode === 'http-error') return { ok: false, status: 503 };
        if (request.method !== 'eth_chainId') {
          if (mode === 'account-change') state.account = '0x2222222222222222222222222222222222222222';
          if (mode === 'revision-change') context.walletConnectionRevision++;
          if (mode === 'session-change') provider.session = { ...provider.session };
          if (mode === 'approval-revoked') provider.session.namespaces.eip155.accounts = [];
          if (mode === 'chain-change') chain = '0x1';
        }
        const body = { jsonrpc: '2.0', id: mode === 'wrong-id' ? request.id + 1 : request.id };
        if (mode === 'rpc-error') body.error = { code: -32000, message: 'RPC unavailable' };
        else if (mode !== 'missing-result') body.result = request.method === 'eth_chainId' ? (mode === 'wrong-rpc-chain' ? '0x1' : '0x2a5') : '0x123';
        return { ok: true, json: async () => body };
      },
    });
    vm.runInContext(quietSource, context);
    context.provider = provider;
    vm.runInContext('installQuietWalletConnectReads(provider)', context);
    const wrapped = provider.request;
    vm.runInContext('installQuietWalletConnectReads(provider)', context);
    assert.equal(provider.request, wrapped, 'Read wrapper must be installed only once');
    return { provider, walletCalls, rpcCalls };
  };
  const normal = fixture();
  for (const method of ['eth_call', 'eth_getBalance', 'eth_getTransactionReceipt']) {
    assert.equal(await normal.provider.request({ method, params: [] }), '0x123');
    assert.ok(!normal.walletCalls.includes(method), `${method} must bypass wallet transport`);
  }
  assert.equal(normal.rpcCalls.filter(method => method === 'eth_chainId').length, 1);
  for (const method of ['eth_sendTransaction', 'personal_sign', 'wallet_switchEthereumChain', 'eth_accounts']) {
    assert.equal(await normal.provider.request({ method, params: [] }), 'wallet-result');
    assert.ok(!normal.rpcCalls.includes(method), `${method} must remain a wallet operation`);
  }
  for (const mode of ['unapproved', 'wrong-wallet-chain', 'wrong-rpc-chain', 'http-error', 'wrong-id',
    'rpc-error', 'missing-result', 'account-change', 'revision-change', 'session-change', 'approval-revoked', 'chain-change']) {
    const test = fixture({ mode });
    await assert.rejects(() => test.provider.request({ method: 'eth_call', params: [] }), mode);
    assert.ok(!test.walletCalls.includes('eth_call'), 'RPC failure must not fall back to wallet polling');
    if (['unapproved', 'wrong-wallet-chain'].includes(mode)) assert.equal(test.rpcCalls.length, 0);
  }
  console.log('WalletConnect quiet-read regressions passed: transport isolation, chain approval, RPC errors and account/session races.');
}

// A supported target-chain session works without optional add/switch permissions.
{
  const networkSource = source.slice(source.indexOf('function walletChainErrorCode('),
    source.indexOf('export async function requestBotNetwork(')).replaceAll('export async', 'async');
  for (const mode of ['approved-correct', 'other-chain-only', 'switch-not-approved', 'switch-approved']) {
    const account = '0x1111111111111111111111111111111111111111';
    const calls = [];
    let chain = ['switch-not-approved', 'switch-approved'].includes(mode) ? '0x1' : '0x2a5';
    const provider = {
      session: { namespaces: { eip155: {
        accounts: [`eip155:${mode === 'other-chain-only' ? 1 : 677}:${account}`],
        methods: ['eth_sendTransaction', ...(mode === 'switch-approved' ? ['wallet_switchEthereumChain'] : [])],
      } } },
      request: async args => {
        calls.push(args.method);
        if (args.method === 'eth_chainId') return chain;
        if (args.method === 'wallet_switchEthereumChain') { chain = args.params[0].chainId; return null; }
        throw Error(`Unexpected wallet method: ${args.method}`);
      },
    };
    const state = { account, chainOk: true, connectionType: 'walletconnect', eip1193Provider: provider };
    const context = vm.createContext({ walletState: state, walletConnectionRevision: 0,
      TARGET_CHAIN_ID: 677, TARGET_CAIP_CHAIN_ID: 'eip155:677', CONFIG: { chainName: 'BOT Chain Mainnet' },
      normalize: value => String(value || '').toLowerCase(), toHexChainId: n => `0x${n.toString(16)}`,
      isAddress: value => /^0x[0-9a-f]{40}$/i.test(value), normalizeRpcError: error => error,
      BrowserProvider: class { async getSigner(a) { return { getAddress: async () => a }; } },
      createContractIfReady() {}, window: { setTimeout },
    });
    vm.runInContext(networkSource, context);
    const run = () => vm.runInContext('ensureCorrectNetwork({interactive: true, addFirst: true})', context);
    if (['other-chain-only', 'switch-not-approved'].includes(mode)) {
      await assert.rejects(run);
      assert.equal(state.chainOk, false);
      assert.ok(!calls.includes('wallet_switchEthereumChain'));
    } else assert.equal(await run(), true);
    assert.ok(!calls.includes('wallet_addEthereumChain'));
  }
  console.log('WalletConnect permission regressions passed: exact target approval and optional network methods.');
}
