# Mainnet 1.1.0 - Browser, GitHub, Remix and MetaMask

This package replaces the incomplete repository release. You do not need to expose a private key or seed phrase, create a local .env, install Node, or use a terminal on your computer. GitHub Actions runs the tests and build. The contract and gameplay rules remain fixed, with no multisig or proxy. The separate Upgradeable project is unchanged.

## 1. Upload the complete project

Extract the ZIP on your computer. Open its project folder and upload its contents to the root of a new public repository, or a repository whose old files you have deliberately removed. You do not need to delete the previous repository. Do not upload the ZIP itself: GitHub does not turn an uploaded archive into a working project.

The original package contains fewer than 100 files, each below the 25 MB browser-upload limit. Old reports and deployment scripts requiring private keys were removed. UPLOAD-FILES.json lists the release files. The repository root should contain package.json, site-settings.json, index.html, and the src, scripts, public, contracts, remix and .github folders.

If your operating system hides .github, enable hidden files or create the three workflows using Add file > Create new file, using these exact paths and the corresponding source contents:

- .github/workflows/ci.yml
- .github/workflows/deploy-pages.yml
- .github/workflows/security.yml

Folder structure matters: public/nft belongs inside public, not at the repository root. package.json must not be nested in an extra project folder. Before publication, the Check complete browser upload step must succeed; it names any missing required files.

START-HERE.md and START-HERE-FA.md are optional documentation. The updated upload check does not require either guide to build the game. For an English-only current source tree, keep README.md and START-HERE.md and remove START-HERE-FA.md after applying the accompanying manifest and upload-check changes. Removing documentation from the current tree does not erase previous Git history.

## 2. Publish the initial website before deploying a contract

Initially leave site-settings.json unchanged. Its default network is botMainnet and the contract address is blank. The website therefore opens in practice mode and cannot submit mint transactions.

Choose Settings > Pages > Source > GitHub Actions. Then select Actions > Deploy Base Quest to GitHub Pages > Run workflow. Publication is manual; pushing changes runs CI rather than an unnecessary failing deployment.

This release does not require the old VITE_* Repository Variables. Public settings come from site-settings.json, and the new workflow does not import the old repository variables. During Actions, the website URL is derived from the repository name. Leave publicAppUrl blank unless you use a custom domain.

For the repository base-quest-milestones-bot-mainnet under jefmark, the website URL is:

https://jefmark.github.io/base-quest-milestones-bot-mainnet/

Open the website, metadata/1.json and nft/1.png. A working practice website before contract deployment is expected; minting is disabled until the real contract address is configured. For Reown, enter your public walletConnectProjectId in the JSON and publish again. Leaving it blank disables the QR connection option; it must not make the whole website blank. Configure the Reown allowed origin for https://jefmark.github.io.

## 3. Deploy with Remix and MetaMask

Use the final reviewed source delivered with the 2026-10-14 pre-deployment patch. Open https://remix.ethereum.org and upload only remix/BaseQuestMilestones.sol. This standalone file includes its OpenZeppelin 5.0.2 dependencies and requires no network imports.

In Solidity Compiler select:

- Compiler: 0.8.24
- Optimization: enabled
- Runs: 200
- EVM version: paris
- viaIR: disabled

Compile. In Deploy & Run choose BaseQuestMilestones, not an embedded dependency contract.

Select Browser Extension / MetaMask as the environment; some interfaces call this Injected Provider. Verify the account and network in the wallet. First test this same fixed contract on BOT testnet, chain ID 968. For final deployment select BOT mainnet, chain ID 677. This project is not on Coinbase Base.

Network configuration:

| Network | Chain ID | RPC | Explorer | Gas token |
| --- | --- | --- | --- | --- |
| BOT testnet | 968 | https://rpc.bohr.life | https://scan.bohr.life | Test BOT |
| BOT mainnet | 677 | https://rpc.botchain.ai | https://scan.botchain.ai | BOT |

The constructor takes three arguments:

1. initialOwner: the public admin wallet address; it may be the deploying wallet.
2. initialBaseURI: the published website URL ending in /metadata/, for example https://jefmark.github.io/base-quest-milestones-bot-mainnet/metadata/.
3. initialTreasury: the public treasury wallet address; it may be the owner. This implementation does not charge a protocol mint fee.

Keep Value at zero. Click Deploy and review/approve the network fee inside MetaMask. Never paste your seed phrase or private key into Remix or the website. Save the deployed address and transaction hash. No initializer, proxy or Safe is required.

Check the deployed contract:

- owner: your chosen admin address
- deploymentKind: BASEQUEST_FIXED_V1
- MAX_MILESTONE: 12
- totalMinted: initially 0
- feeEnabled: false
- mintCooldown: 40
- Milestone 1 required score: 1200
- Milestone 12 required score: 60000

## 4. Connect the website to the deployed contract

Edit only site-settings.json in GitHub.

For testnet, set network to botTestnet and testnetContractAddress to the directly deployed testnet contract. For mainnet, set network to botMainnet and mainnetContractAddress to the directly deployed mainnet contract.

Addresses must start with 0x followed by 40 hexadecimal characters. Do not enter a wallet address or proxy implementation address instead of the fixed contract address.

walletConnectProjectId is your public Reown project ID and can be changed later. Leave publicAppUrl blank for ordinary GitHub Pages hosting. Keep the JSON valid, with no trailing comma after the final value.

Commit changes, then select Actions > Deploy Base Quest to GitHub Pages > Run workflow. After deployment succeeds, perform a full page refresh. Every settings change requires a new build and deployment. Network addresses and existing progress do not automatically migrate between networks.

## 5. Test the real deployment before announcing it

With one wallet, test connection, starting a run, rejecting a request and retrying, minting stage 1, continuing to stage 2, refreshing, switching accounts, and disconnecting/reconnecting. Verify the transaction destination and chain in the explorer. tokenURI(1) must return the stage-1 JSON URL, and the JSON image URL must be publicly accessible.

To verify source in an explorer, retain the same standalone file, compiler 0.8.24, optimizer 200, EVM paris, and all three constructor arguments. Explorer verification support must be checked in practice. No live deployment or transaction on your behalf is implied by the package's automated tests.

For the wallet-refresh patch, connect and authorize your browser wallet once, refresh while it is unlocked, and confirm that the selected wallet account is restored without another permission prompt. Restoration reads eth_accounts; it never requests a fresh signature or transaction. A locked wallet, revoked permission, expired WalletConnect session, or cleared browser storage may require unlocking or connecting again. Do not simulate a connected wallet using only a saved address.

## Previously investigated errors and remaining limitations

The previously supplied log explicitly reported a missing scripts/deploy-network.cjs. This release does not require that script or private-key-based deployment, and its validator no longer references it. Browser upload limits can cause incomplete uploads; the original log alone did not prove why every earlier file was missing.

In an earlier release, missing mainnet address/confirmation could throw during configuration import and leave a blank page. A blank address now selects practice mode, configuration is validated during the build, and startup failures display an error instead of a blank screen. Actions logs alone cannot establish the cause of a previous browser failure when that browser's console was unavailable.

The refresh patch fixes an undeclared savedRdns variable in restoreWalletSession. Previously an authorized injected wallet could fail restoration with ReferenceError. Regression tests now execute the actual restore function, including delayed injection, changed accounts, locked wallets, an unrelated extension, RPC/network errors, cancellation, WalletConnect and concurrent calls.

Fixed contract code does not mean every setting is immutable: the owner can still pause the contract and manage its URI and permitted settings. Browser-reported scores remain forgeable; this patch does not introduce cryptographic anti-cheat. A player needs only one wallet, but normal start/mint transactions still require that wallet's approval and network gas.

Official references:

- https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository
- https://remix-ide.readthedocs.io/en/latest/run.html
- https://dev-docs.botchain.ai/docs/Developers/quick-guide/


## Pre-deployment patch (2026-10-14)

The new wallet connection flow requests BOT network addition directly when the injected wallet is on a different chain, then verifies switching. Approve the request in the wallet; no site can bypass wallet approval. Correct-network restores do not request another addition. Concurrent requests are coalesced. WalletConnect requires an approved BOT session and does not gain custom-chain support merely from this patch.

The standalone contract normalizes a missing trailing slash in the base metadata URI. Continue to supply the complete published /metadata/ directory. Compiler: 0.8.24, optimizer enabled with 200 runs, EVM paris, viaIR disabled. Select the BaseQuestMilestones contract, not one of the bundled dependency contracts. Use Browser Extension (called Injected Provider - MetaMask in older Remix interfaces), select BOT Mainnet 677 in the wallet, and leave Value at zero.

Apply all replacement files, run the existing CI, then manually run Deploy Base Quest to GitHub Pages from Actions. The workflow uses workflow_dispatch; commits do not automatically publish. Preserve the three constructor arguments and exact source/compiler settings for later explorer verification.

See the latest section of TEST-RESULTS.md for actual checks and remaining real-wallet tests. In particular, this review did not deploy to a public chain. Before irreversible mainnet deployment, validate this exact final version with your intended wallet on BOT testnet; prior tests of a different source are not a test of the final artifact.
