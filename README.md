# Base Quest Fixed Mainnet 1.1.0 — Remix + MetaMask

Read [START-HERE.md](START-HERE.md) first. This release needs only a browser, GitHub, Remix and MetaMask for deployment. No private key, seed phrase, local .env or local terminal is required.

- Contract for Remix: remix/BaseQuestMilestones.sol (standalone, no imports).
- Compiler: Solidity 0.8.24, optimizer enabled / 200 runs, EVM paris, viaIR off.
- Contract name: BaseQuestMilestones. Constructor: initialOwner, initialBaseURI, initialTreasury. Value: 0.
- Public website configuration: site-settings.json. Blank contract address enables practice only, never minting.
- GitHub Pages source: GitHub Actions. Publish manually using Deploy Base Quest to GitHub Pages.
- Website URL is derived from the repository name during Actions unless publicAppUrl is explicitly set (custom domains).
- The entire project is fewer than 100 files; upload extracted contents, not the ZIP. Preserve .github. See UPLOAD-FILES.json.
- Ordinary player transactions still need the player's wallet approval and gas. No multisig or proxy exists.

Hardhat is retained only for automated compile/tests on GitHub Actions; its live networks have no configured signers. Key-based deployment commands have been removed. The root contracts/ source is preserved byte-for-byte from the previous reviewed fixed contract. The standalone Remix runtime is checked against that source, excluding compiler source metadata.

Browser scores remain self-reported, not cryptographic proof of gameplay. NFT progression and transfer rules are unchanged. See TEST-RESULTS.md for actual verification scope.
