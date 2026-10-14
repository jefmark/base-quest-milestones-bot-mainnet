const assert = require('node:assert/strict');
const { ethers, network } = require('hardhat');

const increase = async (seconds) => {
  await network.provider.send('evm_increaseTime', [seconds]);
  await network.provider.send('evm_mine');
};

async function reverts(promise, expected) {
  let actualError;
  try { await promise; } catch (error) { actualError = error; }
  assert.ok(actualError, `Expected a revert containing ${expected}, but the call succeeded`);
  assert.ok(String(actualError).includes(expected),
    `Expected ${expected}, got ${String(actualError).slice(0, 500)}`);
}

describe('Direct fixed contract: single-wallet gameplay and admin', function () {
  let owner, alice, bob, treasury, quest, proxyAddress;
  beforeEach(async () => {
    [owner, alice, bob, treasury] = await ethers.getSigners();
    const Quest = await ethers.getContractFactory('BaseQuestMilestones');
    quest = await Quest.deploy(owner.address, 'https://example.org/fresh-deployment/metadata/', treasury.address);
    await quest.waitForDeployment();
    proxyAddress = await quest.getAddress();
  });

  it('has no initializer, upgrade entry point or ERC1967 implementation',async()=>{
    assert.equal(quest.interface.getFunction('upgradeToAndCall'),null);
    assert.equal(quest.interface.getFunction('initialize'),null);
    assert.equal(await ethers.provider.getStorage(proxyAddress,'0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc'),ethers.ZeroHash);
    await assert.rejects(owner.sendTransaction({to:proxyAddress,data:new ethers.Interface(['function upgradeToAndCall(address,bytes)']).encodeFunctionData('upgradeToAndCall',[owner.address,'0x'])}));
    assert.equal(await quest.owner(),owner.address);
  });

  it('rejects an accidental second start without replacing the active run', async () => {
    await (await quest.connect(alice).startRun(1)).wait();
    const initial = await quest.getActiveRun(alice.address);
    await reverts(quest.connect(alice).startRun(1), 'RUN_ALREADY_ACTIVE');
    assert.equal(await quest.runNonce(alice.address), 1n);
    assert.equal((await quest.getActiveRun(alice.address)).challenge, initial.challenge);
    await (await quest.connect(alice).cancelRun()).wait();
    await (await quest.connect(alice).startRun(1)).wait();
    assert.equal(await quest.runNonce(alice.address), 2n);
    await reverts(quest.connect(alice).startRun(1), 'RUN_ALREADY_ACTIVE');
    await increase(86401);
    await (await quest.connect(alice).startRun(1)).wait();
    assert.equal(await quest.runNonce(alice.address), 3n);
  });

  it('rejects mint before start, wrong order, stale nonce, replay, time or score cheats', async () => {
    await reverts(quest.connect(alice).mintMilestone(1, 1200, 20, 1), 'NO_ACTIVE_RUN');
    await reverts(quest.connect(alice).startRun(2), 'WRONG_NEXT_MILESTONE');
    await (await quest.connect(alice).startRun(1)).wait();
    await reverts(quest.connect(alice).mintMilestone(1, 1200, 20, 1), 'RUN_TOO_FAST');
    await increase(21);
    await reverts(quest.connect(alice).mintMilestone(1, 1200, 20, 8), 'BAD_RUN_NONCE');
    await reverts(quest.connect(alice).mintMilestone(1, 100, 20, 1), 'SCORE_TOO_LOW');
    await reverts(quest.connect(alice).mintMilestone(1, 99999999, 20, 1), 'SCORE_RATE_TOO_HIGH');
    await (await quest.connect(alice).mintMilestone(1, 1200, 20, 1)).wait();
    assert.equal(await quest.ownerOf(1), alice.address);
    assert.equal(await quest.highestCompletedMilestone(alice.address), 1n);
    assert.equal(await quest.mintedByProtocol(alice.address, 1), true);
    await reverts(quest.connect(alice).mintMilestone(1, 1200, 20, 1), 'WRONG_NEXT_MILESTONE');
    const run = await quest.getActiveRun(alice.address);
    assert.equal(run.milestone, 2n);
    assert.equal(run.nonce, 1n);
    assert.equal(run.active, true);
  });

  it('rejects admin configurations that break sequential score/time requirements', async () => {
    await reverts(quest.setMilestone(2, 1199, 35, true, 'Bad score order'), 'SCORE_ORDER');
    await reverts(quest.setMilestone(2, 2600, 19, true, 'Bad time order'), 'TIME_ORDER');
    await reverts(quest.setMilestone(2, 30000, 35, true, 'Above next stage'), 'SCORE_ORDER');
    await reverts(quest.setMilestone(12, 60000, 86400, true, 'Impossible duration'), 'MILESTONE_TIME_TOO_LONG');
    await reverts(quest.setMilestone(12, 60000, 901, true, 'Exceeds browser runtime'), 'MILESTONE_TIME_TOO_LONG');
    await reverts(quest.setMilestone(12, 600000, 400, true, 'Unreachable score'), 'SCORE_UNREACHABLE');
    assert.equal(await quest.MAX_CLIENT_MINT_SECONDS(), 900n);
    await reverts(quest.connect(alice).setMilestone(2, 2650, 36, true, 'Not owner'), 'OwnableUnauthorizedAccount');
    await (await quest.setMilestone(2, 2700, 36, true, 'Chain Jumper')).wait();
    const updated = await quest.getMilestone(2);
    assert.equal(updated.requiredScore, 2700n);
    assert.equal(updated.minPlaySeconds, 36n);
  });

  it('keeps the SAME nonce through successive mints, preserves metadata per milestone', async () => {
    await (await quest.connect(alice).startRun(1)).wait();
    await increase(21);
    await (await quest.connect(alice).mintMilestone(1, 1200, 20, 1)).wait();
    await reverts(quest.connect(alice).mintMilestone(2, 2600, 35, 1), 'RUN_TOO_FAST');
    await increase(41);
    await (await quest.connect(alice).mintMilestone(2, 2600, 35, 1)).wait();
    assert.equal(await quest.highestCompletedMilestone(alice.address), 2n);
    assert.equal(await quest.runNonce(alice.address), 1n);
    assert.equal(await quest.tokenURI(1), 'https://example.org/fresh-deployment/metadata/1.json');
    assert.equal(await quest.tokenURI(2), 'https://example.org/fresh-deployment/metadata/2.json');
    await (await quest.connect(alice).transferFrom(alice.address, bob.address, 1)).wait();
    assert.equal(await quest.highestCompletedMilestone(bob.address), 0n);
    assert.equal(await quest.highestCompletedMilestone(alice.address), 2n);
  });

  it('protects pause, ownership transfer, cooldown config, with one owner', async () => {
    await reverts(quest.connect(alice).pause(), 'OwnableUnauthorizedAccount');
    await (await quest.pause()).wait();
    await reverts(quest.connect(alice).startRun(1), 'EnforcedPause');
    await (await quest.unpause()).wait();
    await (await quest.connect(alice).startRun(1)).wait();
    await (await quest.transferOwnership(bob.address)).wait();
    assert.equal(await quest.owner(), owner.address);
    await (await quest.connect(bob).acceptOwnership()).wait();
    assert.equal(await quest.owner(), bob.address);
    await reverts(quest.connect(owner).setMintCooldown(0), 'OwnableUnauthorizedAccount');
  });

  it('independent direct contracts retain isolated NFT state for the future mainnet deployment', async () => {
    await (await quest.connect(alice).startRun(1)).wait();
    await increase(22);
    await (await quest.connect(alice).mintMilestone(1, 1200, 20, 1)).wait();

    const Quest = await ethers.getContractFactory('BaseQuestMilestones');
    const freshMainnet = await Quest.deploy(owner.address, 'https://example.org/future-mainnet/metadata/', treasury.address);
    await freshMainnet.waitForDeployment();
    assert.notEqual((await freshMainnet.getAddress()).toLowerCase(), proxyAddress.toLowerCase());
    assert.equal(await quest.highestCompletedMilestone(alice.address), 1n);
    assert.equal(await freshMainnet.highestCompletedMilestone(alice.address), 0n);
    assert.equal(await freshMainnet.totalMinted(), 0n);
    assert.equal((await freshMainnet.getActiveRun(alice.address)).active, false);
    assert.equal(await quest.tokenURI(1), 'https://example.org/fresh-deployment/metadata/1.json');
    await reverts(freshMainnet.ownerOf(1), 'ERC721NonexistentToken');
  });

  it('blocks minting while paused, then allows the same valid run to continue', async () => {
    await (await quest.connect(alice).startRun(1)).wait();
    await increase(25);
    await (await quest.pause()).wait();
    await reverts(quest.connect(alice).mintMilestone(1, 1200, 20, 1), 'EnforcedPause');
    assert.equal(await quest.totalMinted(), 0n);
    await (await quest.unpause()).wait();
    await (await quest.connect(alice).mintMilestone(1, 1200, 20, 1)).wait();
    assert.equal(await quest.highestCompletedMilestone(alice.address), 1n);
  });

  it('does not accept payment and never counts external or legacy NFTs', async () => {
    assert.equal(await quest.totalMinted(), 0n);
    assert.equal(await quest.highestCompletedMilestone(alice.address), 0n);
    await reverts(owner.sendTransaction({ to: proxyAddress, value: 1n }), 'NO_NATIVE_TOKEN_ACCEPTED');
    await reverts(quest.connect(alice).startRun(0), 'BAD_MILESTONE');
    await reverts(quest.connect(alice).startRun(13), 'BAD_MILESTONE');
  });
  it('completes all 12 milestones with one run, then consumes the nonce', async () => {
    const thresholds = [1200, 2600, 4500, 7000, 10000, 13500, 18000, 23000, 30000, 38000, 48000, 60000];
    await (await quest.connect(alice).startRun(1)).wait();
    for (let milestone = 1; milestone <= 12; milestone += 1) {
      await increase(401);
      await (await quest.connect(alice).mintMilestone(milestone, thresholds[milestone - 1], 400, 1)).wait();
      assert.equal(await quest.highestCompletedMilestone(alice.address), BigInt(milestone));
    }
    assert.equal(await quest.totalMinted(), 12n);
    const session = await quest.getActiveRun(alice.address);
    assert.equal(session.active, false);
    assert.equal(session.nonce, 1n);
    await reverts(quest.connect(alice).mintMilestone(12, 60000, 400, 1), 'WRONG_NEXT_MILESTONE');
  });

  it('expires an abandoned run and invalidates canceled run and old nonce', async () => {
    await (await quest.connect(alice).startRun(1)).wait();
    await (await quest.connect(alice).cancelRun()).wait();
    await reverts(quest.connect(alice).mintMilestone(1, 1200, 20, 1), 'NO_ACTIVE_RUN');
    await (await quest.connect(alice).startRun(1)).wait();
    await increase(20);
    await reverts(quest.connect(alice).mintMilestone(1, 1200, 20, 1), 'BAD_RUN_NONCE');
    await increase(86401);
    await reverts(quest.connect(alice).mintMilestone(1, 1200, 20, 2), 'RUN_EXPIRED');
    await (await quest.connect(alice).startRun(1)).wait();
    assert.equal(await quest.runNonce(alice.address), 3n);
  });

});
