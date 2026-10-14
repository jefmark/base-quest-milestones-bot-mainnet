const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');
const {ethers,artifacts}=require('hardhat');
describe('Shipped frontend/contract integration',function(){
 it('all frontend functions and events match the compiled ABI',async()=>{
  const source=fs.readFileSync('src/config.js','utf8');
  const abi=vm.runInNewContext(source.slice(source.indexOf('export const CONTRACT_ABI = ')).replace('export const CONTRACT_ABI = ','').trim());
  const compiled=new ethers.Interface((await artifacts.readArtifact('BaseQuestMilestones')).abi);
  for(const f of new ethers.Interface(abi).fragments){
   const match=f.type==='function'?compiled.getFunction(f.format('sighash')):compiled.getEvent(f.format('sighash'));
   assert.ok(match,`Missing ABI fragment: ${f.format()}`);
   assert.equal(match.format('minimal'),f.format('minimal'));
  }
 });
 it('production wallet preflight accepts the actual deployment and rejects an empty address',async()=>{
  const [owner]=await ethers.getSigners();const F=await ethers.getContractFactory('BaseQuestMilestones');
  const quest=await F.deploy(owner.address,'https://example.org/metadata/',owner.address);
  await quest.waitForDeployment();
  const source=fs.readFileSync('src/wallet.js','utf8');
  const begin=source.indexOf('async function assertTargetContractReady(');const end=source.indexOf('// A receipt can outlive',begin);
  assert.ok(begin>=0&&end>begin);
  const config={contractAddress:await quest.getAddress(),chainName:'Local EVM'};
  const context=vm.createContext({CONFIG:config,isAddress:ethers.isAddress,walletState:{chainOk:true,provider:ethers.provider,contract:quest},withTimeout:async p=>p,normalizeRpcError:e=>e});
  vm.runInContext(source.slice(begin,end),context);
  await vm.runInContext('assertTargetContractReady()',context);
  config.contractAddress=owner.address;
  await assert.rejects(vm.runInContext('assertTargetContractReady()',context));
 });
});

describe('Production wallet against a real local EVM', function () {
 it('starts once and mints all 12 NFTs through the shipped wallet transaction path', async function () {
  this.timeout(60000);
  const hre=require('hardhat');
  const [owner,player]=await ethers.getSigners();const F=await ethers.getContractFactory('BaseQuestMilestones');
  const quest=await F.deploy(owner.address,'https://example.org/metadata/',owner.address);await quest.waitForDeployment();
  const configSource=fs.readFileSync('src/config.js','utf8');
  const abi=vm.runInNewContext(configSource.slice(configSource.indexOf('export const CONTRACT_ABI = ')).replace('export const CONTRACT_ABI = ','').trim());
  const gameSource=fs.readFileSync('src/game.js','utf8');
  const stages=vm.runInNewContext(gameSource.match(/export const STAGE_CONFIG = (\[[\s\S]*?\]);/)[1]);
  const requests=[];
  const provider={isMetaMask:true,rdns:'io.metamask',on(){},removeListener(){},request:async r=>{
   requests.push(r);
   if(r.method==='eth_accounts'||r.method==='eth_requestAccounts')return [player.address];
   if(r.method==='eth_sendTransaction'){
    assert.equal(r.params[0].chainId,'0x7a69');assert.equal(r.params[0].value,'0x0');
    // Emulate wallet gas estimation/signing using the local funded test account.
    const gas=await hre.network.provider.request({method:'eth_estimateGas',params:r.params});
    return hre.network.provider.request({method:r.method,params:[{...r.params[0],gas}]});
   }
   return hre.network.provider.request(r);
  }};
  const storage=new Map();
  const ctx=vm.createContext({...ethers,console,URL,
   CONFIG:{chainId:31337,chainName:'Local EVM',contractAddress:await quest.getAddress(),maxMilestone:12,walletStorageKey:'test-wallet',explorerUrl:'https://example.org'},
   CONTRACT_ABI:abi,STAGE_CONFIG:stages,provider,
   BrowserProvider:class extends ethers.BrowserProvider {constructor(p){super(p,undefined,{cacheTimeout:-1});this.pollingInterval=10;}},
   CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},
   document:{},window:{__bqm_auto_wallet_restore__:true,setTimeout,clearTimeout,dispatchEvent(){},
     navigator:{userAgent:'test'},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}}
  });
  for(const n of ['metamaskSvg','trustSvg','coinbaseSvg','rabbySvg','rainbowSvg','okxSvg','zerionSvg','walletConnectSvg'])ctx[n]='';
  let code=fs.readFileSync('src/wallet.js','utf8').replace(/^import .*;\n/gm,'').replace(/\bexport /g,'').replaceAll('import.meta.env','({})');
  vm.runInContext(code,ctx);
  const run=s=>vm.runInContext(s,ctx);
  await run("connectWithProvider(provider,'Local Wallet','injected')");
  const started=await run('startVerifiedRun(1)');assert.equal(started.nonce,1);
  for(const stage of stages){
   await hre.network.provider.send('evm_increaseTime',[Math.max(41,stage.minPlaySeconds+2)]);await hre.network.provider.send('evm_mine');
   const result=await run(`mintMilestone(${stage.milestone},${stage.score},${stage.minPlaySeconds},1)`);
   assert.equal(Number(result.receipt.status),1);
   assert.equal(await quest.ownerOf(stage.milestone),player.address);
   assert.equal(await quest.highestCompletedMilestone(player.address),BigInt(stage.milestone));
   ctx.confirmedHash=result.hash;ctx.playerAddress=player.address;
   run('acknowledgeConfirmedMint(confirmedHash,playerAddress)');
  }
  assert.equal((await quest.getActiveRun(player.address)).active,false);
  assert.equal(requests.filter(r=>r.method==='eth_sendTransaction').length,13,'Exactly one start plus twelve free mints');
  assert.equal(requests.some(r=>r.method==='personal_sign'||r.method.startsWith('eth_sign')),false);
 });
});
