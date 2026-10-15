const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const hre = require('hardhat');
const { ethers } = hre;
const readProjectFile = name => fs.readFileSync(require('node:path').join(process.env.BQM_RECOVERY_SOURCE_ROOT || '.', name), 'utf8');

async function harness() {
  const [owner, player, other] = await ethers.getSigners();
  const quest = await (await ethers.getContractFactory('BaseQuestMilestones')).deploy(owner.address, 'https://example.org/metadata/', owner.address);
  await quest.waitForDeployment();
  const abiSource = readProjectFile('src/config.js');
  const abi = vm.runInNewContext(abiSource.slice(abiSource.indexOf('export const CONTRACT_ABI = ')).replace('export const CONTRACT_ABI = ', '').trim());
  const stages = vm.runInNewContext(readProjectFile('src/game.js').match(/export const STAGE_CONFIG = (\[[\s\S]*?\]);/)[1]);
  const storage = new Map();
  const control = { timeout: false, account: player.address, chain: '0x7a69', sends: 0, hook: null };
  const provider = { isMetaMask: true, rdns: 'io.metamask', on() {}, removeListener() {}, request: async r => {
    if (control.hook) await control.hook(r);
    if (r.method === 'eth_accounts' || r.method === 'eth_requestAccounts') return [control.account];
    if (r.method === 'eth_chainId') return control.chain;
    if (r.method === 'eth_sendTransaction') {
      control.sends++;
      assert.equal(r.params[0].from.toLowerCase(), control.account.toLowerCase());
      assert.equal(r.params[0].value, '0x0');
      const gas = await hre.network.provider.request({ method: 'eth_estimateGas', params: r.params });
      return hre.network.provider.request({ method: r.method, params: [{ ...r.params[0], gas }] });
    }
    return hre.network.provider.request(r);
  } };
  const ctx = vm.createContext({ ...ethers, console, URL, CONFIG: { chainId: 31337, chainName: 'Local EVM',
    contractAddress: await quest.getAddress(), maxMilestone: 12, walletStorageKey: 'recovery', explorerUrl: 'https://example.org' },
    CONTRACT_ABI: abi, STAGE_CONFIG: stages, provider, control,
    BrowserProvider: class extends ethers.BrowserProvider {
      constructor(p) { super(p, undefined, { cacheTimeout: -1 }); this.pollingInterval = 10; }
      waitForTransaction(...args) { return control.timeout ? Promise.reject(new Error('Simulated 180-second confirmation timeout')) : super.waitForTransaction(...args); }
    },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    document: {}, window: { __bqm_auto_wallet_restore__: true, setTimeout, clearTimeout, dispatchEvent() {}, navigator: { userAgent: 'test' },
      localStorage: { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) } }
  });
  for (const n of ['metamaskSvg','trustSvg','coinbaseSvg','rabbySvg','rainbowSvg','okxSvg','zerionSvg','walletConnectSvg']) ctx[n] = '';
  const code = readProjectFile('src/wallet.js').replace(/^import .*;\n/gm, '').replace(/\bexport /g, '').replaceAll('import.meta.env', '({})');
  vm.runInContext(code, ctx);
  const run = s => vm.runInContext(s, ctx);
  await run("connectWithProvider(provider, 'Local Wallet', 'injected')");
  return { ctx, run, quest, player, other, control, storage };
}
async function elapse(seconds = 45) { await hre.network.provider.send('evm_increaseTime', [seconds]); await hre.network.provider.send('evm_mine'); }
async function openPending(h, action = 'mint') {
  if (action === 'mint') { await h.run('startVerifiedRun(1)'); await elapse(); }
  await hre.network.provider.send('evm_setAutomine', [false]);
  h.control.timeout = true;
  await assert.rejects(h.run(action === 'mint' ? 'mintMilestone(1,1200,20,1)' : 'startVerifiedRun(1)'), /timeout/);
  const saved = h.run('getPendingWalletTransaction()');
  return { saved, tx: await ethers.provider.getTransaction(saved.hash) };
}
async function replace(h, original, cancel = false) {
  const tx = await h.player.sendTransaction({ to: cancel ? h.player.address : original.to,
    data: cancel ? '0x' : original.data, value: 0, nonce: original.nonce,
    gasLimit: cancel ? 21000 : original.gasLimit,
    maxFeePerGas: (original.maxFeePerGas || original.gasPrice) * 3n,
    maxPriorityFeePerGas: (original.maxPriorityFeePerGas || 1000000000n) * 3n });
  await hre.network.provider.send('evm_mine');
  return tx;
}

describe('Wallet recovery on a real local EVM (no public-chain writes)', function () {
  this.timeout(60000);
  beforeEach(async () => { await hre.network.provider.send('hardhat_reset'); });
  afterEach(async () => { await hre.network.provider.send('evm_setAutomine', [true]); });
  it('recovers a mint mined AFTER the confirmation timeout with no second send', async () => {
    const h = await harness(); const { saved } = await openPending(h);
    assert.equal(await h.quest.totalMinted(), 0n);
    await hre.network.provider.send('evm_mine');
    h.control.timeout = false;
    const sends = h.control.sends;
    const recovered = await h.run('mintMilestone(1,1200,20,1)');
    assert.equal(recovered.hash, saved.hash); assert.equal(recovered.outcome, 'confirmed');
    assert.equal(h.control.sends, sends); assert.equal(await h.quest.totalMinted(), 1n);
    h.ctx.result = recovered;
    h.run('acknowledgeConfirmedMint(result.hash,result.from,result.originalHash)');
    assert.equal(h.run('getPendingWalletTransaction()'), null);
  });
  it('finds a sped-up mint by sender/nonce and preserves it until checkpoint acknowledgement', async () => {
    const h = await harness(); const { saved, tx } = await openPending(h);
    const replacement = await replace(h, tx);
    // Recovery remains available after R8's 320-block search window.
    for (let block = 0; block < 330; block++) await hre.network.provider.send('evm_mine');
    assert.equal(await ethers.provider.getTransactionReceipt(saved.hash), null);
    const sends = h.control.sends;
    const recovered = await h.run('reconcilePendingWalletTransaction()');
    assert.equal(recovered.hash, replacement.hash); assert.equal(recovered.outcome, 'confirmed');
    assert.equal(recovered.runNonce, 1); assert.equal(h.control.sends, sends);
    assert.equal(h.run('getPendingWalletTransaction().hash'), saved.hash);
    h.ctx.result = recovered; h.run('acknowledgeConfirmedMint(result.hash,result.from,result.originalHash)');
    assert.equal(h.run('getPendingWalletTransaction()'), null);
    assert.equal(await h.quest.totalMinted(), 1n);
  });
  it('resolves a confirmed wallet cancellation and permits one deliberate retry', async () => {
    const h = await harness(); const { tx } = await openPending(h);
    const canceled = await replace(h, tx, true);
    const result = await h.run('reconcilePendingWalletTransaction()');
    assert.equal(result.outcome, 'replaced'); assert.equal(result.hash, canceled.hash);
    assert.equal(h.run('getPendingWalletTransaction()'), null);
    assert.equal(await h.quest.totalMinted(), 0n);
    await hre.network.provider.send('evm_setAutomine', [true]); h.control.timeout = false;
    const sends = h.control.sends; await h.run('mintMilestone(1,1200,20,1)');
    assert.equal(h.control.sends, sends + 1); assert.equal(await h.quest.totalMinted(), 1n);
  });
  it('resolves a sped-up start without issuing another start', async () => {
    const h = await harness(); const { tx } = await openPending(h, 'start');
    const replacement = await replace(h, tx);
    const sends = h.control.sends;
    const result = await h.run('reconcilePendingWalletTransaction()');
    assert.equal(result.hash, replacement.hash); assert.equal(result.outcome, 'confirmed');
    assert.equal(h.control.sends, sends); assert.equal(h.run('getPendingWalletTransaction()'), null);
    assert.equal((await h.quest.getActiveRun(h.player.address)).active, true);
  });
  it('retains an unmined transaction despite an old timestamp; pending nonce is not confirmation', async () => {
    const h = await harness(); const { saved } = await openPending(h);
    for (const [key,value] of h.storage) if (value.includes(saved.hash)) h.storage.set(key, JSON.stringify({ ...JSON.parse(value), submittedAt: 1 }));
    const sends = h.control.sends;
    assert.equal((await h.run('reconcilePendingWalletTransaction()')).outcome, 'pending');
    assert.equal(h.run('getPendingWalletTransaction().hash'), saved.hash);
    assert.equal(h.control.sends, sends);
    await hre.network.provider.send('evm_mine');
  });
  it('migrates a legacy hash-only record while its original transaction is still available', async () => {
    const h = await harness(); const { saved } = await openPending(h);
    for (const [key,value] of h.storage) if (value.includes(saved.hash)) {
      const old=JSON.parse(value);delete old.data;delete old.transactionNonce;delete old.runNonce;h.storage.set(key,JSON.stringify(old));
    }
    assert.equal((await h.run('reconcilePendingWalletTransaction()')).outcome, 'pending');
    assert.equal(Number.isSafeInteger(h.run('getPendingWalletTransaction().transactionNonce')), true);
    await hre.network.provider.send('evm_mine');
    assert.equal((await h.run('reconcilePendingWalletTransaction()')).outcome, 'confirmed');
  });
  it('recovers a replacement recorded with the earlier R8 nonce field', async () => {
    const h=await harness();const {saved,tx}=await openPending(h);const replacement=await replace(h,tx);
    for(const [key,value] of h.storage) if(value.includes(saved.hash)) {
      const old=JSON.parse(value);old.nonce=old.transactionNonce;delete old.transactionNonce;delete old.data;delete old.runNonce;h.storage.set(key,JSON.stringify(old));
    }
    const sends=h.control.sends;const recovered=await h.run('reconcilePendingWalletTransaction()');
    assert.equal(recovered.outcome,'confirmed');assert.equal(recovered.hash,replacement.hash);assert.equal(h.control.sends,sends);
  });
  it('retains an old hash-only record when the original was already replaced and nonce proof is unavailable', async () => {
    const h=await harness();const {saved,tx}=await openPending(h);await replace(h,tx,true);
    for(const [key,value] of h.storage) if(value.includes(saved.hash)) {
      const old=JSON.parse(value);delete old.transactionNonce;delete old.data;delete old.runNonce;h.storage.set(key,JSON.stringify(old));
    }
    const sends=h.control.sends;
    assert.equal((await h.run('reconcilePendingWalletTransaction()')).outcome,'pending');
    assert.equal(h.run('getPendingWalletTransaction().hash'),saved.hash);
    assert.equal(h.control.sends,sends);
  });
  it('keeps the original record when RPC fails or account/network changes during recovery', async () => {
    const h=await harness();const {saved,tx}=await openPending(h);await replace(h,tx,true);
    h.control.hook=async r=>{if(r.method==='eth_getTransactionCount')throw new Error('RPC unavailable');};
    await assert.rejects(h.run('reconcilePendingWalletTransaction()'),/RPC unavailable/);
    assert.equal(h.run('getPendingWalletTransaction().hash'),saved.hash);
    h.control.hook=null;h.control.chain='0x1';
    await assert.rejects(h.run('reconcilePendingWalletTransaction()'),/original wallet and target network/);
    h.control.chain='0x7a69';
    h.control.hook=async r=>{if(r.method==='eth_getBlockByNumber')h.run(`walletState.account='${h.other.address}'`);};
    await assert.rejects(h.run('reconcilePendingWalletTransaction()'),/Wallet changed/);
    h.run(`walletState.account='${h.player.address}'`);h.control.hook=null;
    assert.equal(h.run('getPendingWalletTransaction().hash'),saved.hash);
  });
});

function mainHarness() {
  const source=readProjectFile('src/main.js');
  const A='0x'+'1'.repeat(40),B='0x'+'2'.repeat(40),challenge='0x'+'a'.repeat(64);
  const local={mintPaused:true,running:true,verifiedRun:{active:true,player:A,milestone:1,nonce:1},retrySeconds:0};
  const next={active:true,player:A,milestone:2,nonce:1,startedAt:123,challenge};
  const pending={milestone:1,runNonce:1,owner:A,hash:'0x'+'b'.repeat(64),receipt:{status:1}};
  let marked=0,cleared=0,acked=0,handler;
  const ctx=vm.createContext({console,window:{addEventListener:(_name,fn)=>{handler=fn;}},document:{hidden:false},
    walletState:{account:A,chainOk:true}, normalizeAccount:v=>String(v||'').toLowerCase(),
    game:{snapshot:()=>local,clearVerifiedRun(){cleared++;local.verifiedRun.active=false;local.mintPaused=false;},
      markMinted(n,s){assert.equal(local.mintPaused,true);assert.equal(local.verifiedRun.active,true);assert.equal(n,1);assert.equal(s.milestone,2);marked++;local.mintPaused=false;local.verifiedRun=s;}},
    mintedReceiptPending:pending,mintedNextSessionProof:null,mintedMilestones:new Set(),mintedSyncAccount:'',
    nextRunCooldownRevision:0,nextRunCooldownPending:false,nextRunAvailableAt:0,
    availableOnchainSession:null,availableSessionAccount:'',
    setProtectedMessage(){},refreshWalletUi:async()=>{},resolveNextSessionAfterMint:async()=>next,getActiveRun:async()=>next,
    getVerifiedNextRun:()=>next,acknowledgeConfirmedMint(){acked++;},loadNextRunCooldown:async()=>{},
    updateStats(){},saveProgressSnapshot(){},syncMintedMilestones:async()=>ctx.mintedMilestones.add(1),
    startBtn:{},mintBtn:{},startInProgress:false,mintInProgress:false,lastSnapshot:local,CONFIG:{contractAddress:A},
    getPendingWalletTransaction:()=>null,STAGE_CONFIG:[{milestone:1},{milestone:2}],nextSequentialMilestone:()=>({milestone:2})});
  const listenerStart=source.indexOf("window.addEventListener('bqm-wallet-changed',");
  vm.runInContext(source.slice(listenerStart,source.indexOf('// V24.4 professional',listenerStart)),ctx);
  for(const [start,end]of [['function updateStartButton()', 'function updateJumpButton('],['function updateMintButton(', 'async function syncMintedMilestones('],['async function syncConfirmedMintWithoutTransaction()', 'async function completeConfirmedMint()']]){
    vm.runInContext(source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start))),ctx);
  }
  return{ctx,A,B,local,pending,change(account){ctx.walletState.account=account;handler({detail:{account}});},run:s=>vm.runInContext(s,ctx),counts:()=>({marked,cleared,acked})};
}
describe('Production UI checkpoint recovery',function(){
 it('retains frozen checkpoint across A -> B -> A and resumes the confirmed NFT exactly once',async()=>{
  const h=mainHarness();h.change(h.B);h.run('updateMintButton(game.snapshot());updateStartButton();');
  assert.equal(h.ctx.mintBtn.disabled,true);assert.equal(h.ctx.startBtn.disabled,true);
  await assert.rejects(h.run('syncConfirmedMintWithoutTransaction()'),/original wallet|wallet that minted/);
  assert.equal(h.counts().acked,0);
  h.change(h.A);await h.run('syncConfirmedMintWithoutTransaction()');
  assert.deepEqual(h.counts(),{marked:1,cleared:0,acked:1});assert.equal(h.local.verifiedRun.milestone,2);
  assert.equal(await h.run('syncConfirmedMintWithoutTransaction()'),false);
 });
 it('recovers a receipt after reload without trying to advance a missing local checkpoint',async()=>{
  const h=mainHarness();h.local.mintPaused=false;h.local.running=false;h.local.verifiedRun=null;
  await h.run('syncConfirmedMintWithoutTransaction()');
  assert.deepEqual(h.counts(),{marked:0,cleared:0,acked:1});
  assert.equal(h.ctx.availableOnchainSession.milestone,2);assert.equal(h.ctx.mintedReceiptPending,null);
 });
});

describe('Account-bound asynchronous recovery reads', function () {
  for (const [operation,mode] of ['getHighestCompletedMilestone()', 'hasMintedMilestone(1)', 'getActiveRun()'].flatMap(op=>[[op,'setup'],[op,'roundtrip']])) {
    it(`rejects an account change during ${mode} for ${operation}`, async function () {
      const source=readProjectFile('src/wallet.js');
      const start=source.includes('function captureWalletReadIdentity()') ? source.indexOf('function captureWalletReadIdentity()') : source.indexOf('export async function getHighestCompletedMilestone()');
      const A='0x'+'1'.repeat(40),B='0x'+'2'.repeat(40);
      const state={account:A,eip1193Provider:{},chainOk:true,contract:{}};
      let queries=0;
      const resultFor=(account)=>{queries++;state.account=A;if(mode==='roundtrip')ctx.walletConnectionRevision+=2;return account===A?0:7;};
      state.contract={highestCompletedMilestone:async a=>resultFor(a),mintedByProtocol:async a=>Boolean(resultFor(a)),getActiveRun:async a=>{const stage=resultFor(a);return [1,123,stage,'0x'+'a'.repeat(64),true];}};
      const ctx=vm.createContext({walletState:state,walletConnectionRevision:0,CONFIG:{contractAddress:A,chainName:'Test',maxMilestone:12},normalize:v=>String(v||'').toLowerCase(),
        ensureCorrectNetwork:async()=>{if(mode==='setup')state.account=B;return true;},refreshSignerAndContract:async()=>{},withTimeout:p=>p,readContractFunctionDirect:async()=>{throw Error('unexpected fallback');}});
      vm.runInContext(source.slice(start,source.indexOf('export async function startVerifiedRun(',start)).replace(/\bexport /g,''),ctx);
      await assert.rejects(vm.runInContext(operation,ctx),/Wallet changed/);
      assert.equal(queries,mode==='setup'?0:1,'must reject setup changes and discard results after a connection revision changes');
    });
  }
  it('starts a separate progression sync for B while A is still loading',async function(){
    const source=readProjectFile('src/main.js');const A='0x'+'1'.repeat(40),B='0x'+'2'.repeat(40);
    let finishA;const oldRead=new Promise(resolve=>{finishA=resolve;});const calls=[];
    const ctx=vm.createContext({console,walletState:{account:A},mintedSyncGeneration:0,mintedSyncAccount:'',mintedSyncPromise:null,mintedSyncPromiseAccount:'',mintedMilestones:new Set(),STAGE_CONFIG:[{milestone:1},{milestone:2}],
      getHighestCompletedMilestone:async()=>{calls.push(ctx.walletState.account);return ctx.walletState.account===A?oldRead:2;},hasMintedMilestone:async()=>false,
      game:{applyProtocolCheckpoint(){},snapshot(){return{};}},highestSequentialMintedMilestone:()=>0,updateStats(){},saveProgressSnapshot(){}});
    vm.runInContext(source.slice(source.indexOf('async function syncMintedMilestones('),source.indexOf('function isMobileJumpInput(')),ctx);
    const first=vm.runInContext('syncMintedMilestones()',ctx);ctx.walletState.account=B;
    const second=vm.runInContext('syncMintedMilestones()',ctx);await Promise.resolve();finishA(1);
    await Promise.all([first,second]);
    assert.deepEqual(calls,[A,B]);assert.equal(ctx.mintedSyncAccount,B);
    assert.deepEqual(Array.from(ctx.mintedMilestones),[1,2]);
  });
});
