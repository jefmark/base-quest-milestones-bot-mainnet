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
 it('rolls back every mint effect when an NFT receiver rejects, then permits retry',async()=>{
  const R=await ethers.getContractFactory('ReentrantReceiver');const r=await R.deploy(await quest.getAddress());
  await(await r.start()).wait();await(await r.setRejectNfts(true)).wait();
  await network.provider.send('evm_increaseTime',[41]);await network.provider.send('evm_mine');
  const account=await r.getAddress();const before=await quest.getActiveRun(account);
  await assert.rejects(r.mint(),/ERC721InvalidReceiver/);
  assert.equal(await quest.totalMinted(),0n);assert.equal(await quest.lastMintAt(account),0n);
  assert.equal(await quest.mintedByProtocol(account,1),false);
  assert.deepEqual(Array.from(await quest.getActiveRun(account)),Array.from(before));
  await(await r.setRejectNfts(false)).wait();await(await r.mint()).wait();
  assert.equal(await quest.totalMinted(),1n);assert.equal(await quest.ownerOf(1),account);
 });
 it('documents that plausible fabricated browser scores still mint (NOT cryptographic anti-cheat)',async()=>{
  await(await quest.connect(player).startRun(1)).wait();
  await network.provider.send('evm_increaseTime',[25]);await network.provider.send('evm_mine');
  // No game was played. This test must remain a visible specification limitation.
  await(await quest.connect(player).mintMilestone(1,1200,20,1)).wait();
  assert.equal(await quest.ownerOf(1),player.address);
 });
});

describe('Mainnet deployment and NFT invariants', function () {
 let owner,alice,bob,quest,F;
 beforeEach(async()=>{[owner,alice,bob]=await ethers.getSigners();F=await ethers.getContractFactory('BaseQuestMilestones');quest=await F.deploy(owner.address,'https://example.org/metadata',owner.address);});
 it('normalizes metadata directories in constructor and owner updates',async()=>{
  await(await quest.connect(alice).startRun(1)).wait();await network.provider.send('evm_increaseTime',[41]);await network.provider.send('evm_mine');
  await(await quest.connect(alice).mintMilestone(1,1200,20,1)).wait();
  assert.equal(await quest.tokenURI(1),'https://example.org/metadata/1.json');
  await(await quest.setBaseTokenURI('ipfs://bafyexample/metadata')).wait();
  assert.equal(await quest.tokenURI(1),'ipfs://bafyexample/metadata/1.json');
  await(await quest.setBaseTokenURI('https://example.org/metadata/')).wait();
  assert.equal(await quest.tokenURI(1),'https://example.org/metadata/1.json');
  await assert.rejects(quest.setBaseTokenURI(''),/EMPTY_BASE_URI/);
  await assert.rejects(quest.connect(bob).setBaseTokenURI('https://evil.example/'),/OwnableUnauthorizedAccount/);
 });
 it('rejects invalid deployment parameters and unknown tokens',async()=>{
  await assert.rejects(F.deploy(ethers.ZeroAddress,'https://example.org/',owner.address),/OwnableInvalidOwner/);
  await assert.rejects(F.deploy(owner.address,'',owner.address),/EMPTY_BASE_URI/);
  await assert.rejects(F.deploy(owner.address,'https://example.org/',ethers.ZeroAddress),/ZERO_TREASURY/);
  await assert.rejects(quest.tokenURI(1),/ERC721NonexistentToken/);
  assert.equal(await quest.supportsInterface('0x80ac58cd'),true);
  assert.equal(await quest.supportsInterface('0x5b5e139f'),true);
 });
 it('isolates player nonces, cancellation, NFTs and progression',async()=>{
  await(await quest.connect(alice).startRun(1)).wait();await(await quest.connect(bob).startRun(1)).wait();
  await(await quest.connect(bob).cancelRun()).wait();
  assert.equal((await quest.getActiveRun(alice.address)).active,true);
  await network.provider.send('evm_increaseTime',[41]);await network.provider.send('evm_mine');
  await(await quest.connect(alice).mintMilestone(1,1200,20,1)).wait();
  await assert.rejects(quest.connect(bob).mintMilestone(1,1200,20,1),/NO_ACTIVE_RUN/);
  await assert.rejects(quest.connect(bob).transferFrom(alice.address,bob.address,1),/ERC721InsufficientApproval/);
  await(await quest.connect(alice).transferFrom(alice.address,bob.address,1)).wait();
  assert.equal(await quest.highestCompletedMilestone(bob.address),0n);
  assert.equal(await quest.highestCompletedMilestone(alice.address),1n);
 });
 it('allows cancel while paused without allowing unauthorized administration',async()=>{
  await(await quest.connect(alice).startRun(1)).wait();await(await quest.pause()).wait();
  await(await quest.connect(alice).cancelRun()).wait();
  assert.equal((await quest.getActiveRun(alice.address)).active,false);
  for(const call of [()=>quest.connect(alice).unpause(),()=>quest.connect(alice).setTreasury(alice.address),()=>quest.connect(alice).transferOwnership(alice.address)])
   await assert.rejects(call(),/OwnableUnauthorizedAccount/);
 });
});
