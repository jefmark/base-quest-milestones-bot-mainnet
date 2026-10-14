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
