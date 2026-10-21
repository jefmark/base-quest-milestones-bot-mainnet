# Mainnet synchronization verification - 2026-10-20

## Inputs and scope

- Mainnet source: `7eacbda6ea252ec65b6e76bea8ed559b56f38d3c`, repository `jefmark/base-quest-milestones-bot-mainnet`.
- Testnet reference: `26b7db8c68ec6fb18ad9536fdc4ac0ef7289a4bf`, repository `jefmark/base-quest-milestones-bot-final-testnet`.
- Six supplied proposals: `MAINNET-PRESERVATION.json-4.txt`, `MAINNET-scripts-validate-project.mjs-1.txt`, `MAINNET-public-site.webmanifest-1.txt`, `MAINNET-index.html-1.txt`, `MAINNET-src-main.js-1.txt`, `MAINNET-src-wallet.js-1.txt`.

The repositories differed in eight tracked files: preservation manifest, HTML entry, contact page, webmanifest, project validator, public settings, main UI and wallet. Contract sources, game code, dependency files and existing tests were identical. The contact-page differences were network/repository labels; the existing mainnet contact page was retained.

The proposals were not applied blindly. Their main UI and HTML entry lacked the final versioned favicon/shortcut-icon changes. The proposed wallet retained exact target-chain approval more strictly than the testnet implementation, so that permission model was used with the shared quiet-read feature and additional race/permission checks. Proposed hashes were not reused for different final bytes.

## Changes delivered

| File | Change |
| --- | --- |
| `src/main.js` | Final PNG favicon logic from testnet, normalized base path, versioned URL, shortcut icon synchronization and unversioned Apple icon |
| `src/wallet.js` | Required target chain, explicit target approval, PNG metadata, direct read-only RPC routing, rejection of stale account/session results and optional switch-method guard |
| `public/favicon-runner-v2.png` | Convert incorrectly named JPEG bytes to actual PNG; all decoded RGB pixels remain identical |
| `index.html` | Mainnet title/description, versioned PNG favicon and shortcut icon; no oversized desktop favicon declaration |
| `public/site.webmanifest` | Existing PNG runner asset and accurate mainnet description |
| `scripts/validate-project.mjs` | Required-chain assertion, mainnet entry assertion, SHA-256 verification and duplicate manifest entry detection |
| `scripts/finalize-site.mjs` | Normalize selected network labels in entry, manifest and static pages for mainnet or testnet builds |
| `scripts/test-wallet-transaction-lock.mjs` | Production-function regressions for quiet reads, RPC failures, authorization, identity races and optional network methods |
| `scripts/test-static-release.mjs` | Verify generated entry/manifest network labels and final desktop favicon declarations |
| `PRESERVATION.json` | Recalculate changed hashes from final bytes and add coverage for entry/validation/finalization/regression files; 61 entries total |
| `README.md`, `START-HERE.md`, `CONTRIBUTING.md`, `TEST-RESULTS.md` | Replace outdated deployment guidance with the configured mainnet state, actual change scope and current evidence |

No changes were made to `site-settings.json`, contracts, game rules, CSS, NFT art/metadata, the contact page, package files or workflow files. Only the separate browser runner icon was re-encoded; its decoded image is unchanged. The update contains 14 replacement files. New checks are reached by existing package scripts; no package or workflow change is needed.

## Checks actually executed

| Check | Result |
| --- | --- |
| Dependency installation | `npm ci --ignore-scripts --no-audit --no-fund` succeeded; installation used Node 24.19.0 and emitted the expected package engine warning |
| Verification runtime | Subsequent check/build/Hardhat commands used Node 22.23.3, matching the declared Node 22 range |
| `npm run check` | Passed, including new WalletConnect regressions, preservation hashes and static network/favicon checks |
| `npm test` | Complete rerun: 41 passing; imported and standalone contracts, frontend/local-EVM integration and recovery suites |
| `npm run build` | Passed with `GITHUB_REPOSITORY=jefmark/base-quest-milestones-bot-mainnet`; generated all 12 metadata files for the mainnet Pages URL |
| `npm run check:imports` | All 12 declared imports resolved |
| `node scripts/check-release-content.mjs dist` | Passed for generated mainnet output |
| `python3 scripts/check-upload.py` | Passed; all required listed source files present |
| Full dependency audit | 13 advisory entries: 9 low, 4 moderate, 0 high and 0 critical |
| Production dependency audit | 0 reported advisory entries |
| Browser icon encoding | Genuine PNG signature, 1254 x 1254 dimensions and pixel-for-pixel decoded RGB equality with the original JPEG verified |
| Preservation | All 61 listed hashes matched the final source bytes |
| Formatting | `git diff --check` passed |
| Language and scope | Final tracked text files and deliverable TXT contents scanned for Arabic/Persian script; protected settings, contracts, gameplay and assets compared with baseline |

The first complete-suite invocation exited with status zero after a partial recovery log and without a final test total. That run was not accepted as full verification. A targeted baseline pending-transaction test passed, and the complete rerun finished with the explicit 41-passing summary. The initial runner behavior was not reproduced in the rerun or claimed to have been fixed.

Vite emitted the existing large-chunk warning and third-party PURE annotation warnings. Runtime proxy configuration also emitted environment warnings. These were not build failures. No dependency upgrade was applied.

## Mainnet read-only observations

RPC: `https://rpc.botchain.ai`. Contract reads were pinned to block `0x1a16e04`, with observation timestamp `2026-10-20T13:12:14.109Z` (16:12:14 Europe/Istanbul).

| Field | Observation |
| --- | --- |
| Chain ID | `0x2a5` = 677 |
| Contract | `0x3f00E384Cf3CcF7f431535efA8830f0FE5dF6Fd5` |
| Runtime bytecode | 13,477 bytes |
| Runtime comparison | Equal to locally compiled source after removing trailing compiler CBOR metadata |
| Deployment kind | `BASEQUEST_FIXED_V1` |
| Owner | `0xe5D5718Eb7b3920d2BcCB1fB674500b203F8D34c` |
| Paused | `false` |
| Total minted | 22 |
| Mint cooldown | 40 seconds |
| Fee enabled | `false` |
| Milestones 1-12 | Active; names, required scores and minimum times match the shipped defaults |

These are dated observations from one RPC, not permanent values or independent explorer source verification. No deployment, mint, cancellation, transfer, signature or administrative transaction was submitted to a public chain.

## Remaining limits

This is a scoped synchronization and source review, not an independent formal audit or a guarantee of zero bugs. Real MetaMask/mobile/WalletConnect pairing, device-specific icon caching and the final GitHub-hosted workflow were not exercised during this update. Mock-provider tests do not prove real-wallet interoperability.

Existing gameplay limitations were preserved as requested: scores are client-reported, browser thresholds are fixed while owner permissions remain, and an expired frozen checkpoint has no direct in-page discard button. The owner intends not to change those requirements. No guarantee of future RPC availability, custom-chain wallet support or unchanged contract state is implied.

Historical evidence files were not relabeled as new test results. This replacement records this review; older documentation remains in Git history.
