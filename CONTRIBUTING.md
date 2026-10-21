# Contributing

This repository is the BOT Chain Mainnet deployment (677). The separate testnet repository targets chain 968. Preserve the configured mainnet contract, public WalletConnect project ID and publication URL unless a change explicitly requires otherwise.

## Required verification

Use Node.js 22 and the committed lockfile. Run:

```sh
npm ci
npm run check
npm run check:imports
npm run compile
npm test
npm run build
npm audit --audit-level=high
python3 scripts/check-upload.py
```

Inspect complete logs and test totals. An exit status alone is insufficient if the test runner ends before its final summary. Describe the environment, actual checks, results and any untested real-wallet flow.

## Source integrity

- Keep all eight independent pages, Play navigation and NFT assets unless a requested change requires otherwise.
- Keep imported and standalone Remix contracts equivalent; run their ABI/runtime comparison after contract edits. A direct contract's bytecode cannot be upgraded in place.
- Preserve gameplay, milestone requirements, retries and fees when synchronizing wallet or presentation fixes.
- Recalculate SHA-256 for every changed file listed in `PRESERVATION.json`. Validation checks exact source bytes before building. `previous_sha256` records the preceding file hash for this revision; `unchanged` refers to that comparison, not to whether Git has local edits.
- The preservation manifest is a selected source list, while `UPLOAD-FILES.json` checks required file presence. Neither is a security signature.
- Keep filenames, UI text, comments and documentation in English. Do not include wallet secrets or credentials in source or reports.

## Wallet and publication changes

Require explicit target-chain WalletConnect session authorization. Optional add/switch methods must not become a universal pairing requirement. Never equate adding a wallet network with extending session authorization.

Read-only RPC routing must retain chain verification, bounded timeouts, response validation and identity-change rejection. Signing, authorization and transaction requests stay on the wallet provider. Exercise both success and failure cases; do not blindly retry an uncertain transaction.

Test generated network labels, favicon paths, public metadata URLs and progress-storage isolation. Source changes do not publish Pages automatically. Preserve the manual default-branch deployment workflow.

## Accurate claims

Browser scores are forgeable client input. Do not describe NFTs as cryptographic proof of human gameplay or unique identity. Non-upgradeable contract code does not make owner-managed parameters immutable. The owner can pause and change permitted settings or metadata; ownership transfer has two steps and renunciation is disabled.

Separate source comparison, mocked regression tests, local-EVM integration, public-chain reads and real-wallet transactions. Do not describe a local build as a complete security audit or claim untested mobile behavior has been verified.
