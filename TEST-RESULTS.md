# Verification — 2026-10-14

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

Use START-HERE-FA.md. Do not deploy from old instructions asking for DEPLOYER_PRIVATE_KEY. Do not mix stale deployment workflows with this release. Source publication, website publication, and a MetaMask-confirmed contract deployment are distinct steps.
