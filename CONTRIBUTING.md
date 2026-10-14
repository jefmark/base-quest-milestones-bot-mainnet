# Contributing

This is a separate new repository for BOT Chain Testnet (968) acceptance, followed by an independent BOT Chain Mainnet (677) deployment. All existing runner gameplay and UI are preserved. Do not remove pages, navigation or NFT assets for a contract-level change. Don't import original deployed contracts or NFT ownership to either target network.

All PRs should run `npm run check`, `npm run compile`, `npm test`, `npm run build` and document the affected UI/game wallet flow. This direct contract cannot be upgraded after deployment; changes require a new deployment. Never disclose deployer private keys or wallet secrets.
