import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = file => fs.readFileSync(file, 'utf8');
const root = process.cwd();
const source = file => path.join(root, file);
const requireText = (file, pattern, label) =>
  assert.match(read(source(file)), pattern, `${file}: missing ${label}`);
const rejectText = (file, pattern, label) =>
  assert.doesNotMatch(read(source(file)), pattern, `${file}: forbidden ${label}`);

const pages = fs.readdirSync(source('public/pages')).filter(n => n.endsWith('.html')).sort();
const expectedPages = ['about.html','community.html','contact.html','dashboard.html','home.html','nfts.html','rules.html','xp.html'];
assert.deepEqual(pages, expectedPages, 'All eight original independent pages must remain');
const menuTargets = ['home.html','../index.html','dashboard.html','nfts.html','xp.html','rules.html','about.html','contact.html','community.html'];
for (const name of pages) {
  const file = `public/pages/${name}`;
  const html = read(source(file));
  assert.match(html, /<aside class="page-menu">/);
  assert.match(html, /<meta name="referrer" content="strict-origin-when-cross-origin">/);
  assert.match(html, /<nav class="page-drawer"/);
  assert.match(html, /<script src="\.\.\/pages\.js" defer><\/script>/);
  for (const link of menuTargets) assert.ok(html.includes(`href="${link}"`), `${name}: lost drawer link ${link}`);
}
const main = read(source('src/main.js'));
assert.match(main, /v244-drawer/);
for (const page of expectedPages) assert.ok(main.includes(`./pages/${page}`), `Game page lost ${page} link`);
assert.match(read(source('src/style.css')), /\.v244-drawer/);
assert.match(read(source('public/pages.css')), /\.page-drawer/);
assert.match(read(source('public/pages.js')), /page-menu-toggle/);
assert.match(main, /v244-side-lives/);
assert.match(main, /#gameCanvas/);
assert.match(read(source('src/game.js')), /function createGame|export function createGame/);

const channels = ['https://t.me/BaseQuestMilestones','https://discord.gg/vPUxmRA7C4','https://x.com/BaseQuestGame'];
for (const file of ['src/main.js','public/pages/community.html','public/pages/contact.html']) {
  for (const url of channels) assert.ok(read(source(file)).includes(url), `${file}: missing ${url}`);
}
for (const url of channels) assert.ok(read(source('public/pages/community.html')).includes(`href="${url}" target="_blank" rel="noopener noreferrer"`));

const config = read(source('src/config.js'));
assert.match(config, /VITE_NETWORK/);
assert.match(config, /botTestnet/);
assert.match(config, /botMainnet/);
assert.match(config, /chainId: 968/);
assert.match(config, /chainId: 677/);
assert.match(config, /https:\/\/rpc\.bohr\.life/);
assert.match(config, /https:\/\/rpc\.botchain\.ai/);
assert.match(config, /VITE_BOT_TESTNET_CONTRACT_ADDRESS/);
assert.match(config, /VITE_BOT_MAINNET_CONTRACT_ADDRESS/);
assert.match(config, /VITE_CONFIRM_MAINNET_BUILD/);
assert.match(config, /walletStorageKey/);
assert.match(config, /progressStorageKey/);
assert.match(config, /function SCORE_BURST_ALLOWANCE\(\)/, 'Mint preflight ABI must include the score burst getter');
rejectText('src/config.js', /VITE_CONTRACT_ADDRESS|legacyProtocol|oldContract/i, 'legacy or ambiguous contract address');
const hardhat = read(source('hardhat.config.cjs'));
assert.match(hardhat, /botTestnet\s*:\s*\{\s*chainId:\s*968/);
assert.match(hardhat, /botMainnet\s*:\s*\{\s*chainId:\s*677/);
assert.ok(fs.existsSync(source('remix/BaseQuestMilestones.sol')), 'Standalone Remix source must be included');
assert.doesNotMatch(hardhat, /PRIVATE_KEY|privateKey/);
assert.match(read(source('scripts/finalize-site.mjs')), /page-drawer/);
const contract = read(source('contracts/BaseQuestMilestones.sol'));
for(const term of ['ERC721','Ownable2Step','ReentrancyGuard','Pausable','RunStarted','RunAdvanced','_mintedHere','runNonce','mintCooldown']) assert.ok(contract.includes(term));
assert.doesNotMatch(contract,/UUPS|delegatecall|function initialize|_authorizeUpgrade/);
for (const bad of [/legacyProtocol/,/ILegacyQuest/,/importLegacy/]) {
  assert.doesNotMatch(contract, bad, `legacy contract dependency ${bad}`);
}
const game = read(source('src/game.js'));
const stages = [...game.matchAll(/\{ milestone:\s*(\d+), name: '([^']+)', score:\s*(\d+), minPlaySeconds:\s*(\d+)/g)];
const m = [...contract.matchAll(/_setMilestone\((\d+),\s*(\d+),\s*(\d+),\s*true,\s*"([^"]+)"\)/g)];
assert.equal(stages.length,12,'12 original game milestones');
assert.equal(m.length,12,'12 contract milestones');
for (let i = 0; i < 12; i++) {
  const gameRow = stages[i]; const chainRow = m[i];
  assert.deepEqual([Number(gameRow[1]),Number(gameRow[3]),Number(gameRow[4]),gameRow[2]],
    [Number(chainRow[1]),Number(chainRow[2]),Number(chainRow[3]),chainRow[4]],
    `Milestone #${i+1}: mismatch between frontend and contract`);
  const meta = JSON.parse(read(source(`public/metadata/${i+1}.json`)));
  assert.match(meta.name, new RegExp(gameRow[2]));
  assert.ok(meta.attributes.some(a => a.trait_type === 'Milestone' && Number(a.value) === i+1));
  const full = source(`public/nft/${i+1}.png`);
  const thumb = source(`public/nft/thumbs/${i+1}.webp`);
  assert.ok(fs.statSync(full).size > 100_000 && fs.statSync(thumb).size > 5_000,
    `Missing or damaged original NFT artwork ${i+1}`);
}
const rules = JSON.parse(read(source('public/progression-rules.json')));
assert.equal(rules.stages.length,12);
assert.equal(rules.verifiedRunRequiredForMint,true);
assert.match(read(source('src/wallet.js')), /restoreWalletSession/);
assert.match(read(source('src/wallet.js')), /optionalChains:\s*\[TARGET_CHAIN_ID\]/);
assert.match(read(source('src/wallet.js')), /eth_accounts/);
assert.match(main, /getActiveRun\(\)/);
assert.match(main, /resumable/);
assert.match(main, /resolveNextSessionAfterMint/);
assert.match(main, /beforeStart\.antiCheat\?\.clean/, 'invalidated verified runs must be resumable');
assert.match(main, /getVerifiedNextRun\(recovered, pending\)/, 'confirmed mint recovery must validate nonce');
assert.match(main, /nextRunCooldownRevision/, 'stale wallet cooldown reads must not leak between accounts');
assert.match(game, /CHECKPOINT_REJECTED/, 'invalid checkpoints cannot leave the game frozen');
assert.match(game, /FRAME_GAP[\s\S]*?endGame\(\)/, 'frame-integrity failures must stop gameplay');
const walletSource = read(source('src/wallet.js'));
// Read-only contract status refreshes must not trigger wallet-switch prompts.
for (const method of ['getHighestCompletedMilestone', 'hasMintedMilestone', 'getActiveRun']) {
  const start = walletSource.indexOf(`export async function ${method}(`);
  const end = walletSource.indexOf('\nexport ', start + 10);
  assert.ok(start >= 0, `${method}: missing`);
  const body = walletSource.slice(start, end < 0 ? undefined : end);
  assert.match(body, /ensureCorrectNetwork\(\{ interactive: false \}\)/,
    `${method} must NEVER open a chain-switch approval during background state reads`);
}
assert.match(walletSource, /if \(functionName === 'cancelRun'\) clearPendingTransaction/,
  'confirmed start and mint receipts must remain pending until verified');
assert.match(walletSource, /clearPendingTransaction\(startAccount, result.hash\)/,
  'verified start transaction must be acknowledged only after on-chain run proof');
assert.match(read(source('scripts/assert-release-approval.mjs')), /workflow_dispatch/,
  'production must not auto-publish from a branch push');
assert.match(read(source('scripts/finalize-metadata.mjs')), /CI metadata publication must use a public HTTPS URL/,
  'CI metadata cannot point NFTs to localhost');

assert.match(walletSource, /walletTransactionInFlight/, 'parallel wallet transactions must be serialized');
assert.match(walletSource, /unresolvedWalletSubmission/, 'pending wallet approvals must block duplicate submissions');
assert.match(walletSource, /getBlock\('latest'\)/, 'mint preflight must use confirmed chain time instead of the browser clock');
assert.match(walletSource, /getMilestone\(safeMilestone\)/, 'mint preflight must check administrator-updated stage requirements');
assert.match(contract, /MAX_CLIENT_MINT_SECONDS = 900/, 'contract owner must not set browser-impossible stage durations');
assert.match(contract, /RUN_ALREADY_ACTIVE/, 'a second Start Run must not replace an active run');
assert.match(contract, /SCORE_UNREACHABLE/, 'owner cannot configure an unreachable score target');
assert.match(walletSource, /maximumPermittedScore/, 'mint must check the live score-rate cap before wallet approval');
assert.match(walletSource, /safeWalletIconSrc/, 'untrusted wallet provider icons must be sanitized');

assert.match(read(source('.github/workflows/ci.yml')), /npm run check:imports/, 'CI must verify runtime dependency resolution');
assert.match(read(source('.github/workflows/deploy-pages.yml')), /npm run check:imports/, 'Pages must verify runtime dependency resolution');
assert.match(walletSource, /originalAccount/, 'wallet identity must remain fixed across transaction submission');
assert.match(walletSource, /currentWalletChain\(provider\)/, 're-check chain before sending transaction');
assert.match(read(source('scripts/finalize-site.mjs')), /Mainnet pages must not be published without/, 'guard production against missing contract');
for (const file of ['src/config.js','src/wallet.js','src/main.js','src/game.js','public/pages.js']) {
  rejectText(file, /bqmBotMainnet677|bqm_bot_mainnet_677_wallet_session/i, 'shared old chain 677 localStorage');
}
assert.match(read(source('index.html')), /BOT Chain Testnet/, 'default network must be testnet');
console.log(`Project integrity passed: 8 separate pages, 9 drawer links per page, ${channels.length} community links, 12 NFT image+metadata pairs, stage/ABI logic, both isolated networks.`);
