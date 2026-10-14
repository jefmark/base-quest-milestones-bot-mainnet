const assert=require('node:assert/strict');
const {ethers,network}=require('hardhat');
describe('Additional protocol regressions',function(){
 let quest,owner,player;
 beforeEach(async()=>{[owner,player]=await ethers.getSigners();const F=await ethers.getContractFactory('BaseQuestMilestones');quest=await F.deploy(owner.address,'https://example.org/metadata/',owner.address);});
 it('prevents permanent accidental renunciation and excessive cooldown',async()=>{
  await assert.rejects(quest.renounceOwnership(),/RENOUNCE_DISABLED/);
  assert.equal(await quest.owner(),owner.address);
  await assert.rejects(quest.setMintCooldown(901),/TOO_LONG/);
  await(await quest.setMintCooldown(900)).wait();
 });
 it('blocks receiver callback reentrancy and preserves exactly one mint',async()=>{
  const R=await ethers.getContractFactory('ReentrantReceiver');const r=await R.deploy(await quest.getAddress());
  await(await r.start()).wait();await network.provider.send('evm_increaseTime',[25]);await network.provider.send('evm_mine');
  await(await r.mint()).wait();
  assert.equal(await r.cancelSucceeded(),false);assert.equal(await r.mintSucceeded(),false);
  assert.equal(await quest.totalMinted(),1n);assert.equal((await quest.getActiveRun(await r.getAddress())).active,true);
 });
 it('documents that plausible fabricated browser scores still mint (NOT cryptographic anti-cheat)',async()=>{
  await(await quest.connect(player).startRun(1)).wait();
  await network.provider.send('evm_increaseTime',[25]);await network.provider.send('evm_mine');
  // No game was played. This test must remain a visible specification limitation.
  await(await quest.connect(player).mintMilestone(1,1200,20,1)).wait();
  assert.equal(await quest.ownerOf(1),player.address);
 });
});
