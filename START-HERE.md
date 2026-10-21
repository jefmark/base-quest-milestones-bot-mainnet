# Update the existing BOT Mainnet website

This guide applies to mainnet baseline `7eacbda6ea252ec65b6e76bea8ed559b56f38d3c` and the 2026-10-20 synchronization. The existing configuration already selects BOT Chain Mainnet 677 and contract `0x3f00E384Cf3CcF7f431535efA8830f0FE5dF6Fd5`.

## 1. Apply all final replacement files

Use the final replacement set together. The runner icon is supplied separately as a real `.png` file; replace it directly at `public/favicon-runner-v2.png`. The other 13 replacements are TXT files. Each TXT contains the complete replacement file, not a snippet. Replace the contents of its exact destination path, preserving the original extension (`.js`, `.mjs`, `.html`, `.json`, `.webmanifest` or `.md`). Do not leave a `.txt` suffix in the repository and do not paste Markdown code fences into source files.

Preserve the existing folder structure and all unrelated repository files. There is no need to delete or recreate the repository. The update changes the wallet/frontend, validation scripts and documentation; it does not replace the contract, game rules, NFT artwork, dependency lockfile or `site-settings.json`.

The updated preservation manifest must be committed with the matching sources. A partially applied set should fail the new hash check. Files added later to the manifest must use SHA-256 of the exact raw source bytes, including line endings.

## 2. Confirm mainnet settings

Keep the current `site-settings.json`:

```json
{
  "network": "botMainnet",
  "mainnetContractAddress": "0x3f00E384Cf3CcF7f431535efA8830f0FE5dF6Fd5",
  "testnetContractAddress": "",
  "walletConnectProjectId": "5e254f5a94b33125ae771c32e1efb0ed",
  "publicAppUrl": ""
}
```

| Network field | Mainnet value |
| --- | --- |
| Chain ID | 677 / `0x2a5` |
| RPC | https://rpc.botchain.ai |
| Explorer | https://scan.botchain.ai |
| Currency | BOT / 18 decimals |

Do not copy the testnet contract address, testnet Reown project ID or testnet site URL. Explicit process/Vite environment values can override JSON configuration; inspect any overrides before building. The existing Pages workflow does not explicitly import old repository `VITE_*` variables. A blank selected contract address would enable setup/practice mode instead of the configured NFT flow.

## 3. Run checks and publish

If using a local terminal, use Node.js 22 and run the commands in README.md. Otherwise GitHub Actions performs the checks.

1. Commit every replacement to the existing mainnet repository.
2. Check the CI and Security results. Inspect actual test summaries; a partial test log is not evidence that the complete suite ran.
3. Set **Settings > Pages > Source** to **GitHub Actions** if needed.
4. Run **Actions > Deploy Base Quest to GitHub Pages > Run workflow** on the default branch.
5. Wait for both build and deploy jobs to succeed.
6. Open https://jefmark.github.io/base-quest-milestones-bot-mainnet/ and refresh fully.
7. Inspect `metadata/1.json`, `metadata/12.json` and their image URLs. They must use the mainnet site's public URL, not localhost or the testnet site.

A push does not automatically publish Pages. Editing repository Markdown also does not update the deployed game without the relevant frontend files and a successful deployment.

## 4. Wallet checks after publication

Use a compatible wallet with BOT for gas. Verify chain 677 and the configured contract address before approving start/mint. The application does not require token spending approvals or wallet secrets.

Check injected/in-app and WalletConnect routes separately: connect, reject, retry, refresh, account switch, network switch, disconnect and mobile return-to-game. WalletConnect needs explicit target-chain session approval. A wallet that does not support the chain cannot be made compatible by changing a favicon or public project ID. Add/select the network in the wallet and pair again, or use a supported injected/in-app wallet.

The PNG runner icon should appear in desktop tabs and wallet metadata. Browsers can retain previously installed bookmark/PWA icons; existing installed icons may need to be refreshed or re-added.

## 5. Gameplay and interrupted transactions

One start opens a verified run; each milestone is a separate mint transaction. Closing the successful preview continues to the next verified stage. Keep the game visible while playing; hiding the tab or a long frame gap can invalidate the local attempt. Three lost lives trigger the existing 59-second retry lock.

Use **Check pending transaction** or **Sync confirmed NFT** when offered. A timeout or missing receipt does not prove failure. Do not clear storage or send another mint while the original outcome is uncertain. Recovery depends on responsive RPC and sufficient transaction history.

An expired, unsubmitted frozen checkpoint has no in-page discard control in this release. After establishing that no transaction is pending or confirmed, reload to discard the local attempt and start a new session when the old on-chain run is expired. This loses the unminted local score. This synchronization does not change the 24-hour contract lifetime or game thresholds.

## 6. Contract reference

No contract deployment is needed for this frontend update. The two repositories contain byte-identical imported and standalone contract sources. The configured mainnet executable runtime was compared with the compiled source during the dated read-only check in TEST-RESULTS.md.

For an intentional future deployment, preserve the exact source and settings: Solidity 0.8.24, optimizer enabled with 200 runs, EVM `paris`, viaIR disabled, and constructor arguments `initialOwner`, `initialBaseURI`, `initialTreasury`. Use the correct contract `BaseQuestMilestones`, zero deployment value and a complete public `/metadata/` URI. A new deployment is a different contract with independent NFT state; it does not migrate existing progression.
