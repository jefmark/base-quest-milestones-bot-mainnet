const assert = require('node:assert/strict');
const fs = require('node:fs');
const solc = require('solc');
const { ethers, artifacts } = require('hardhat');
describe('Standalone Remix source (no imports, no private key configuration)', function () {
  it('compiles with 0.8.24/paris/200, matches the original runtime and mints through a wallet signer', async function () {
    this.timeout(60000);
    const source = fs.readFileSync('remix/BaseQuestMilestones.sol','utf8');
    assert.ok(source.length > 10000); assert.doesNotMatch(source,/^\s*import\s/m);
    const input = {language:'Solidity',sources:{'BaseQuestMilestones.sol':{content:source}},settings:{evmVersion:'paris',optimizer:{enabled:true,runs:200},outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object']}}}};
    const output = JSON.parse(solc.compile(JSON.stringify(input)));
    assert.deepEqual((output.errors||[]).filter(x=>x.severity==='error'),[]);
    const compiled=output.contracts['BaseQuestMilestones.sol'].BaseQuestMilestones;
    const original=await artifacts.readArtifact('BaseQuestMilestones');
    const strip = value => {const hex=value.replace(/^0x/,'');return hex.slice(0,-(parseInt(hex.slice(-4),16)+2)*2);};
    assert.equal(strip(compiled.evm.deployedBytecode.object),strip(original.deployedBytecode),'Runtime must match except Solidity source metadata');
    assert.deepEqual(compiled.abi,original.abi);
    const [owner,player]=await ethers.getSigners();
    const quest=await new ethers.ContractFactory(compiled.abi,compiled.evm.bytecode.object,owner).deploy(owner.address,'https://example.org/metadata/',owner.address);
    await quest.waitForDeployment();
    assert.equal(await quest.owner(),owner.address);assert.equal(await quest.deploymentKind(),'BASEQUEST_FIXED_V1');
    await(await quest.connect(player).startRun(1)).wait();
    await ethers.provider.send('evm_increaseTime',[25]);await ethers.provider.send('evm_mine',[]);
    await(await quest.connect(player).mintMilestone(1,1200,20,1)).wait();
    assert.equal(await quest.ownerOf(1),player.address);
    assert.equal(await quest.tokenURI(1),'https://example.org/metadata/1.json');
  });
});
