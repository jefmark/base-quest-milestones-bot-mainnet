# Mainnet pre-deployment review - 2026-10-14

Baseline: 266d1a1f968b07df3013be9a8ac7b72ed7736e72, fetched from the public repository.

## Outcome and scope

The revised source passes the local release gates described below. This is a code review with regression and integration tests, not an independent professional security audit or a promise of zero bugs. No public-network contract was deployed and no mainnet/testnet transaction was sent. Final approval of a live launch remains conditional on testing this exact final source and frontend with the intended real wallet/network.

Reviewed: the complete application contract and its standalone equivalent; owner privileges, ERC-721 mint/transfer behavior, nonces, expiry, cooldowns, receiver callbacks, metadata, wallet discovery/restoration, network selection, transaction preflight/submission/recovery, game checkpoint/retry integration, public settings and release/build workflow. Dependency audit and artifact preservation checks were also performed. Bundled OpenZeppelin dependencies were compiled and tested; they were not independently re-audited line by line. Browser tests used an injected mock provider, not a real MetaMask extension or live WalletConnect account.

## Confirmed defects and changes

1. Network addition depended on recognized missing-chain errors. Explicit connection, refresh restoration and Add/Switch now request wallet_addEthereumChain first when an injected wallet is on the wrong chain, then switch if necessary. A wallet-specific unrecognized error no longer prevents the initial add request. The precise error from the user's physical wallet was not provided, so that exact device-specific cause is not claimed as reproduced.
2. Concurrent interactive network checks share one pending operation. Passive background checks remain read-only. Polling allows up to three seconds of normal chain-change propagation instead of 600ms. Reject/pending responses stop rather than create extra prompts. Unsupported add-method wallets may still switch to an already-installed chain.
3. Browser testing reproduced a null pickerRoot querySelector error after rejected network setup closed the wallet picker during click propagation. The event now captures its own overlay.
4. A late eth_requestAccounts response could restore a wallet after cancellation or overwrite a newer connection. Connection revision checks now discard stale authorizations without clearing a replacement wallet.
5. Transaction requests explicitly include the selected chainId in addition to existing preflight chain/account checks, with value zero.
6. An omitted trailing slash in the metadata constructor/setter input produced malformed NFT URLs. A shared internal setter now normalizes it; update events emit the actual normalized URI. Empty values still revert. No ABI, gameplay rules, fees or owner model changed.

## Validation actually run

- Node 22.23.3, lockfile-pinned dependencies, npm ci --ignore-scripts.
- npm run build passed: syntax, source integrity, client gameplay, wallet lock/network/restore tests, static release, build-env, release-content and site-settings tests. The normal Vite large-bundle warning remains.
- npm run check:imports passed for all 12 checked imports.
- npm test: 23 passing. Includes ABI compatibility, actual runtime contract preflight, all 12 sequential mints, per-player isolation, nonce replay/cancel/expiry, pause/ownership, nonpayable behavior, receiver reentrancy, full rollback on rejected NFT reception, zero-address deployment rejection and metadata normalization.
- Full production wallet source was executed against Hardhat's real local EVM with ethers. One start plus all twelve mint transactions succeeded, exactly thirteen submissions, same nonce, zero transferred value and no personal/typed-data signatures. This tests the wallet/contract path, not a human playing every stage in a real wallet.
- Standalone Remix source compiled with Solidity 0.8.24, optimizer enabled/200 runs, EVM paris. ABI matches the imported source; executable runtime matches after stripping compiler source metadata. Standalone deployment/start/mint succeeded locally. Runtime size: 13,477 bytes.
- Headless Chromium against the built site: missing network, rejected addition, already-correct network and refresh restoration. Add/switch calls were checked; connection itself sent no transaction. Rejection originally reproduced the picker error; final tests pass with no page errors. Refresh on the correct network requests no new account approval or add-network prompt.
- Existing gameplay tests passed including all 12 stage retry-speed checks, three lives, 59-second lock, persisted cooldown, input lockout and hidden-tab/frame-gap checks.
- Live read-only BOT RPC queries returned chainId 0x2a5 (677) and a block number. Public metadata for milestones 1 and 12 loaded and their image URLs returned HTTP 200. No contract address was configured in the fetched site-settings.json.
- npm audit --omit=dev: zero reported vulnerabilities. Full npm audit: 13 development-tool dependency advisories (9 low, 4 moderate; zero high/critical). These are not claimed fixed; npm's proposed fixes include breaking Hardhat/plugin major upgrades. No blanket dependency upgrade was applied to this release.
- git diff --check, upload manifest and source-preservation checks pass.

## Preserved behavior and limitations

- src/game.js, src/main.js, CSS, NFT art/metadata and site-settings.json remain byte-for-byte unchanged from the reviewed baseline.
- One wallet per player. No multisig, proxy, initializer or upgrade entry point. Start/mint still need normal wallet transaction approvals and BOT gas; the contract charges no mint fee.
- WalletConnect still needs an approved target chain and a configured project ID. A dapp cannot force unsupported wallets to accept custom chains or bypass a user's rejection. Use the injected/in-app-browser route if WalletConnect does not support BOT.
- Non-upgradeable bytecode does NOT mean every setting is frozen. The single owner can pause, change permitted milestone settings/cooldown, change metadata URI and transfer ownership using Ownable2Step. Loss/compromise of that owner key remains an operational risk. The treasury field is compatibility-only; there is no fee collection in this version.
- Browser scores remain self-reported entertainment badge data, as already documented by the project; no new anti-cheat architecture was introduced.
- Before deployment, use the exact delivered standalone source and compiler settings, check the owner address and metadata endpoint, and test with the intended wallet. After deployment, enter only the newly deployed address into mainnetContractAddress and manually run the Pages deployment workflow. A GitHub edit alone does not publish the new build.

## Primary references

- https://dev-docs.botchain.ai/docs/Developers/quick-guide/
- https://eips.ethereum.org/EIPS/eip-3085
- https://docs.metamask.io/metamask-connect/evm/guides/manage-networks/
- https://remix-ide.readthedocs.io/en/latest/run.html
- https://docs.openzeppelin.com/contracts/5.x/access-control

---

Earlier reports below are historical and are not additional tests performed for this review.

# BOT mainnet UI, wallet network and retry patch - 2026-10-14

Reviewed baseline: 8c53c52d87d1efef37d4becdc626e86aff22fdc8.

Changes:
- Community GitHub links point to jefmark/base-quest-milestones-bot-mainnet in both the game and standalone community page.
- Connection/restoration requests the configured network. Injected wallets handle nested 4902 errors, add the target network and switch again if addition did not activate it. Rejections do not trigger an add-network prompt. Wrong-chain setup clears stale signer/contract readiness; provider/account changes abort setup.
- WalletConnect still requires the target chain to be approved in the session. Unsupported wallets cannot be forced to support BOT. Network approval is a wallet action; there is no new multi-signature requirement.
- Same-checkpoint retries retain prior stage difficulty and accumulated speed. Score and timing reset according to the original checkpoint rules. New nonce/account/checkpoint starts from its own baseline. The 59-second retry lock is unchanged.
- CSS-only visual refinements retain game canvas geometry and controls; improve card presentation, headings and focus indicators. Hero-card labels no longer overlap.
- ERC-721 remains correct for BOT, an EVM-compatible L1. The hero uses Layer 1 NFT Runner wording. No contract migration or redeployment is needed for these frontend edits.

Validation performed for this patch:
- npm ci completed. Checks/build/tests ran with Node 22.23.3.
- npm run build passed, including syntax, project validation, gameplay, wallet, static release, build environment, release-content and site-settings checks. Vite's existing large-chunk warning remains.
- npm test: all 17 Hardhat contract tests passed, including standalone Remix equivalence, all 12 milestones, same nonce continuation, reentrancy and ownership restrictions.
- Real game module with simulated clocks: all 12 stages lose three lives, wait the cooldown, auto-resume with three lives and no reduction in speed; subsequent score recalculation retains difficulty. A new nonce resets speed to its stage baseline.
- Existing tests retain coverage for per-life score/time preservation, refresh-persisted cooldown, locked input, checkpoint recovery and hidden-tab/frame-gap anti-cheat.
- Production wallet functions tested with mock providers: existing network, nested unknown-chain error, add-then-switch, user rejection, passive checks, correct chain, unapproved WalletConnect chain and account change during setup. Refresh/account restoration and transaction-race regressions also passed.
- Headless Chromium: desktop 1440x1000 and mobile 390x844 render without page runtime errors or horizontal page overflow. Canvas and GitHub link are present. Screenshots inspected. This was setup/practice mode because the repository site-settings.json has no contract address.
- git diff --check passed. Contract, Remix source, NFT art/metadata and site-settings.json were not modified.

Limits:
- No deployment or on-chain transaction was made. Real MetaMask/mobile/WalletConnect sessions and mainnet minting must still be checked with the user's configured site.
- Difficulty is retained within the same loaded game instance. A page reload restores the confirmed checkpoint baseline, not an authenticated history of prior in-memory speed.
- Browser-reported scores are not cryptographic proof of gameplay. Existing contract tests explicitly demonstrate that plausible fabricated scores can mint. This targeted patch fixes the retry difficulty defect; it does not replace the trust model or constitute a complete independent security audit.
- Historical statements below describe earlier releases; they are not additional tests newly repeated for this patch.

---

# Wallet refresh and English documentation patch - 2026-10-14

Reviewed GitHub baseline: ebc6b85ab204f74566d6a8832732aa8efa262e05.

- Reproduced failed injected-wallet restoration with the original restoreWalletSession function. The savedRdns identifier was undeclared in that scope.
- Defined the normalized saved provider identity locally. Existing account authorization and provider identity checks remain in place; no new wallet prompts or transactions were added.
- Added restore regression cases to the existing wallet test script, which is already run by npm run check and CI. Authorized/changed accounts, delayed injection, network errors, locked wallets, wrong extensions, cancellation, absent sessions, WalletConnect and concurrent restoration pass.
- Clean npm ci and npm run build succeeded with Node 22.23.3. The build runs the source, gameplay, wallet, static, build-env and settings checks. The existing bundle-size warning remains.
- Upload validation succeeds with both setup guides absent and still fails if src/wallet.js is missing.
- English START-HERE.md replaces the Persian guide in README and the upload manifest. Guides are optional to the upload validator; production files remain required.
- Contract, Remix source, main.js, game.js, styles, site-settings.json and all public assets are unchanged from the reviewed GitHub commit. PRESERVATION.json now records the changed wallet hash explicitly.
- This patch did not deploy, send live transactions or test the user's real Chrome extension, mobile wallet or Ledger. The original release's hardware/browser testing statements below are historical, not newly repeated tests.

# Original release verification record — 2026-10-14

Source baseline: BaseQuestMilestones-Mainnet-v1.0.6-REVIEWED.zip.
Release: 1.1.0 Remix + MetaMask. Upgradeable project is outside this revision.

- Clean npm ci from the pinned lockfile using Node 22.23.3.
- 17 local EVM tests pass, including the standalone Remix source compiled with solc 0.8.24, optimizer 200, EVM paris. Its executable deployed bytecode and ABI match the original fixed contract (Solidity source metadata excluded from the bytecode comparison). A signer deploys it, starts a run and mints stage 1 on the local EVM.
- Source checks, gameplay smoke, wallet transaction/account race tests, static release checks, dotenv precedence, public JSON configuration and package import checks pass.
- Mainnet production builds pass both without a contract (practice-only) and with a demonstration nonzero address. The demonstration address is NOT stored in site-settings.json and is not a live deployment.
- Chromium headless smoke checks the actual built website under /base-quest-milestones-bot-mainnet/: game canvas, NFT page, token metadata, no uncaught page errors during normal loading, and an explanatory fallback when the main JavaScript chunk is deliberately blocked. This is not hardware-wallet or complete visual/device testing.
- PRESERVATION.json records the unchanged fixed contract, gameplay, wallet, main UI, stylesheet and all public files. No NFT artwork or milestone logic changed.
- Browser upload completeness is checked before installing dependencies in Pages. The release contains fewer than 100 files and no single file exceeds the browser's 25 MiB upload limit.

Confirmed log failure: scripts/validate-project.mjs attempted to read missing scripts/deploy-network.cjs. All key-based deploy/verify CLI scripts and their package commands were removed; validation now checks the shipped Remix source. Automated Hardhat tests remain and require no user key.

Other changes: public site-settings.json replaces user .env instructions; repository Pages URL is inferred during Actions; initial publication is explicitly practice-only until an address is entered; imports have a startup-error fallback; publishing is manual-only (no failing deployment on every push); Persian documentation is no longer incorrectly rejected by the English UI validator.

Limitations: no live BOT transaction, actual MetaMask extension signature, Ledger test, complete mobile-wallet test or independent audit. GitHub repository could not be cloned at review time; no claim is made about its current visibility or complete live contents. The submitted Actions log does not prove the precise JavaScript exception in the previous white page. Browser-reported scores remain forgeable. Dependency versions are unchanged; prior low/moderate development-tool advisories are not claimed fixed, and the high-severity audit gate remains in Actions.

Use START-HERE.md. Do not deploy from old instructions asking for DEPLOYER_PRIVATE_KEY. Do not mix stale deployment workflows with this release. Source publication, website publication, and a MetaMask-confirmed contract deployment are distinct steps.
