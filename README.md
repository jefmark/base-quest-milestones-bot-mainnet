# Base Quest Milestones - BOT Chain Mainnet

A browser runner with 12 sequential ERC-721 achievement NFTs. This repository targets BOT Chain Mainnet, not Coinbase Base. The contract is a direct, non-upgradeable deployment with two-step ownership transfer and no proxy or multisig implementation.

## Current configuration

Source baseline: mainnet commit `7eacbda6ea252ec65b6e76bea8ed559b56f38d3c`. Synchronization reference: testnet commit `26b7db8c68ec6fb18ad9536fdc4ac0ef7289a4bf`. Six proposed TXT replacements were reviewed alongside both repositories on 2026-10-20.

| Setting | Value in the existing mainnet configuration |
| --- | --- |
| Repository | https://github.com/jefmark/base-quest-milestones-bot-mainnet |
| Website | https://jefmark.github.io/base-quest-milestones-bot-mainnet/ |
| Selected network | `botMainnet` |
| Chain ID | `677` (`0x2a5`) |
| RPC | `https://rpc.botchain.ai` |
| Explorer | `https://scan.botchain.ai` |
| Contract | `0x3f00E384Cf3CcF7f431535efA8830f0FE5dF6Fd5` |
| Native gas currency | BOT, 18 decimals |
| WalletConnect project ID | `5e254f5a94b33125ae771c32e1efb0ed` |
| Testnet contract setting | Empty; no fallback from mainnet |
| Public app URL setting | Empty; GitHub Actions derives the Pages URL |
| Package version | `1.1.0` |

`site-settings.json` already configures a contract. This is not an unconfigured practice-only release. This synchronization preserves that file byte-for-byte and does not require a new contract deployment. See [START-HERE.md](START-HERE.md) for replacement and publication instructions and [TEST-RESULTS.md](TEST-RESULTS.md) for dated verification.

## Gameplay and transactions

Practice runs are available without connecting a wallet and cannot mint. A verified run requires a start transaction. Each of the 12 milestone mints requires its own transaction, with normal continuation retaining the same run nonce. An active, unexpired on-chain session may be resumed after refresh; unminted local score and position are not restored.

The browser starts with three lives and applies a 59-second local retry lock after all lives are lost. At a verified milestone checkpoint, gameplay freezes for minting. Close the successful NFT preview to continue after the next on-chain session has been verified. The contract charges no protocol mint fee; start, mint and explicit on-chain cancellation still require gas. NFT transfers do not transfer protocol progression.

## Wallet behavior

- Browser/in-app wallets use the injected provider and retain the existing add/switch flow.
- WalletConnect requests the selected chain as required, and a usable session must approve an account on that exact chain plus `eth_sendTransaction`.
- Add/switch methods remain optional. A session already on the correct chain does not need these optional permissions. An unsupported wallet may require manual network selection or a new pairing.
- Selected read-only methods use the configured RPC directly, with chain checks, a timeout and response validation, instead of being sent through the mobile wallet transport. Signing and transactions remain wallet operations.
- Changes to the wallet account, connection revision, session authorization or chain during those reads invalidate the result. RPC failures do not fall back to wallet polling.
- Browser tabs, mobile bookmarks and WalletConnect metadata use the existing PNG runner icon. Desktop favicon URLs include a cache version.

A populated Reown project ID does not prove origin approval or compatibility with every mobile wallet. Real-device validation remains necessary.

## Development

Use Node.js 22 (`>=22 <23`) and the committed lockfile:

```sh
npm ci
npm run check
npm run check:imports
npm run compile
npm test
npm run build
```

`npm run check` now verifies every entry in `PRESERVATION.json` against its actual SHA-256 hash. Update affected manifest hashes whenever listed source files change. The manifest covers selected files; it is not a cryptographic signature or a complete inventory.

`npm run build` runs client/static checks, Vite and finalizers. Contract tests and the dependency audit are separate workflow gates. Set `VITE_PUBLIC_APP_URL` explicitly for a publishable local build, or build under the repository's GitHub Actions environment. Without a public URL or GitHub repository context, generated metadata uses localhost and must not be published.

## Publication and limitations

Publish manually with **Deploy Base Quest to GitHub Pages** from the default branch. Pushes run checks; they do not publish the site automatically.

Browser scores are self-reported; the contract does not prove human gameplay. The owner can pause, change permitted settings and metadata, and transfer ownership. Renunciation is disabled. The owner intends to retain existing milestone requirements; this release preserves them. Fixed browser thresholds versus future owner changes, and expired local checkpoints without an in-page discard action, are not redesigned by this synchronization.

The eight standalone pages display local progress snapshots rather than independently querying the chain. See [CONTRIBUTING.md](CONTRIBUTING.md) for maintenance requirements. License: [MIT](LICENSE).
