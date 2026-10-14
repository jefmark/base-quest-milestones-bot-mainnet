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
