// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @title Base Quest Milestones (independent BOT Chain deployment)
/// @notice 12 free-to-mint achievement NFTs. A single startRun transaction opens
///         a run; each subsequent mint advances the same nonce to the next stage.
/// @dev Direct, non-upgradeable deployment. No proxy and no legacy progression import.
///      Browser-reported gameplay scores are NOT cryptographically proven.
contract BaseQuestMilestones is
    ERC721,
    Ownable2Step,
    Pausable,
    ReentrancyGuard
{
    using Strings for uint256;

    function deploymentKind() external pure returns (string memory) { return "BASEQUEST_FIXED_V1"; }

    struct Milestone {
        uint32 requiredScore;
        uint32 minPlaySeconds;
        bool active;
        string name;
    }

    struct RunSession {
        uint64 nonce;
        uint64 startedAt;
        uint32 milestone;
        bool active;
        bytes32 challenge;
    }

    uint256 public constant MAX_MILESTONE = 12;
    uint256 public constant MAX_RUN_SECONDS = 86400;
    // The shipped browser refuses client runs lasting more than 900 seconds.
    // Owner configuration must never make a milestone impossible to complete.
    uint256 public constant MAX_CLIENT_MINT_SECONDS = 900;
    uint256 public constant MAX_SCORE_PER_SECOND = 540;
    uint256 public constant SCORE_BURST_ALLOWANCE = 1000;
    uint256 public constant CLOCK_AHEAD_TOLERANCE_SECONDS = 10;

    // Independent state for each direct deployment.
    uint256 public totalMinted;
    uint256 public mintCooldown;
    string private baseTokenURI;
    mapping(uint256 => Milestone) public milestones;
    mapping(address => mapping(uint256 => bool)) private _mintedHere;
    mapping(uint256 => uint256) public tokenMilestone;
    mapping(address => uint256) public lastMintAt;
    mapping(address => uint64) public runNonce;
    mapping(address => RunSession) private activeRuns;

    // Compatibility getters remain disabled: this fixed implementation never charges a mint fee.
    // These values do not authorize payment collection in this implementation.
    address public treasury;
    uint256 public futureMintFeeWei;
    bool public feeEnabled;




    event MilestoneConfigured(uint256 indexed milestone, uint32 requiredScore, uint32 minPlaySeconds, bool active, string name);
    event RunStarted(address indexed player, uint256 indexed milestone, uint64 indexed nonce, uint64 startedAt, bytes32 challenge);
    event RunCancelled(address indexed player, uint64 indexed nonce);
    event RunConsumed(address indexed player, uint64 indexed nonce, uint256 indexed milestone);
    event RunAdvanced(address indexed player, uint64 indexed nonce, uint256 indexed nextMilestone, uint64 startedAt, bytes32 challenge);
    event MilestoneMinted(address indexed player, uint256 indexed milestone, uint256 indexed tokenId, uint256 clientScore, uint256 playSeconds, uint64 runNonce);
    event BaseTokenURIUpdated(string newBaseTokenURI);
    event MintCooldownUpdated(uint256 newCooldown);
    event TreasuryUpdated(address indexed newTreasury);

    constructor(address initialOwner, string memory initialBaseURI, address initialTreasury)
        ERC721("Base Quest Milestones", "BQM") Ownable(initialOwner)
    {
        require(initialTreasury != address(0), "ZERO_TREASURY");
        require(bytes(initialBaseURI).length != 0, "EMPTY_BASE_URI");
        _setBaseTokenURI(initialBaseURI);
        mintCooldown = 40;
        treasury = initialTreasury;
        // feeEnabled and futureMintFeeWei default to zero/false.

        _setMilestone(1, 1200, 20, true, "Rookie Runner");
        _setMilestone(2, 2600, 35, true, "Chain Jumper");
        _setMilestone(3, 4500, 50, true, "Base Sprinter");
        _setMilestone(4, 7000, 70, true, "Gasless Ghost");
        _setMilestone(5, 10000, 90, true, "Block Master");
        _setMilestone(6, 13500, 110, true, "Onchain Legend");
        _setMilestone(7, 18000, 140, true, "Quest Hunter");
        _setMilestone(8, 23000, 170, true, "Base Champion");
        _setMilestone(9, 30000, 210, true, "Chain Warrior");
        _setMilestone(10, 38000, 260, true, "Protocol Hero");
        _setMilestone(11, 48000, 320, true, "Elite Player");
        _setMilestone(12, 60000, 400, true, "Genesis Legend");
    }

    function highestCompletedMilestone(address player) public view returns (uint256 highest) {
        while (highest < MAX_MILESTONE && _mintedHere[player][highest + 1]) {
            unchecked { ++highest; }
        }
    }

    function mintedByProtocol(address player, uint256 milestone) public view returns (bool) {
        if (milestone == 0 || milestone > MAX_MILESTONE) return false;
        return _mintedHere[player][milestone];
    }

    function hasMintedMilestone(address player, uint256 milestone) external view returns (bool) {
        return mintedByProtocol(player, milestone);
    }

    function _validateMilestoneProgress(address player, uint256 milestone) internal view {
        require(milestone >= 1 && milestone <= MAX_MILESTONE, "BAD_MILESTONE");
        require(milestones[milestone].active, "MILESTONE_OFF");
        require(milestone == highestCompletedMilestone(player) + 1, "WRONG_NEXT_MILESTONE");
        require(!_mintedHere[player][milestone], "ALREADY_MINTED");
    }

    function startRun(uint256 milestone)
        external nonReentrant whenNotPaused returns (uint64 nonce, bytes32 challenge)
    {
        _validateMilestoneProgress(msg.sender, milestone);
        // A second start would silently replace the existing nonce/challenge,
        // invalidate honest gameplay and charge gas for no useful progress.
        // Retry the gameplay locally with the current run, or explicitly cancel
        // it before starting another run. Expired runs may be replaced.
        RunSession storage previous = activeRuns[msg.sender];
        require(!previous.active || block.timestamp > uint256(previous.startedAt) + MAX_RUN_SECONDS, "RUN_ALREADY_ACTIVE");
        nonce = ++runNonce[msg.sender];
        uint64 startedAt = uint64(block.timestamp);
        // Challenge seeds client visuals; it is not on-chain proof of gameplay.
        challenge = keccak256(abi.encodePacked(
            blockhash(block.number - 1), address(this), block.chainid,
            msg.sender, milestone, nonce, startedAt
        ));
        activeRuns[msg.sender] = RunSession(nonce, startedAt, uint32(milestone), true, challenge);
        emit RunStarted(msg.sender, milestone, nonce, startedAt, challenge);
    }

    function cancelRun() external nonReentrant {
        RunSession storage run = activeRuns[msg.sender];
        require(run.active, "NO_ACTIVE_RUN");
        uint64 nonce = run.nonce;
        run.active = false;
        emit RunCancelled(msg.sender, nonce);
    }

    /// @dev Uses effects before _safeMint and one nonce for the whole 12-stage run.
    ///      NFTs can be transferred; transfer does not grant the receiver progression.
    function mintMilestone(uint256 milestone, uint256 clientScore, uint256 playSeconds, uint64 expectedRunNonce)
        external nonReentrant whenNotPaused returns (uint256 tokenId)
    {
        _validateMilestoneProgress(msg.sender, milestone);
        RunSession storage run = activeRuns[msg.sender];
        require(run.active, "NO_ACTIVE_RUN");
        require(run.nonce == expectedRunNonce, "BAD_RUN_NONCE");
        require(uint256(run.milestone) == milestone, "RUN_MILESTONE_MISMATCH");
        _validateMintEligibility(msg.sender, milestone, clientScore, playSeconds, run);

        _mintedHere[msg.sender][milestone] = true;
        lastMintAt[msg.sender] = block.timestamp;
        tokenId = ++totalMinted;
        tokenMilestone[tokenId] = milestone;

        if (milestone == MAX_MILESTONE) {
            run.active = false;
            emit RunConsumed(msg.sender, run.nonce, milestone);
        } else {
            run.milestone = uint32(milestone + 1);
            run.startedAt = uint64(block.timestamp);
            run.challenge = keccak256(abi.encodePacked(
                run.challenge, msg.sender, run.nonce, tokenId, milestone + 1, block.timestamp
            ));
            emit RunAdvanced(msg.sender, run.nonce, milestone + 1, run.startedAt, run.challenge);
        }

        _safeMint(msg.sender, tokenId);
        emit MilestoneMinted(msg.sender, milestone, tokenId, clientScore, playSeconds, expectedRunNonce);
    }

    function _validateMintEligibility(
        address player, uint256 milestone, uint256 clientScore, uint256 playSeconds, RunSession storage run
    ) internal view {
        uint256 elapsed = block.timestamp - uint256(run.startedAt);
        Milestone storage m = milestones[milestone];
        require(elapsed >= m.minPlaySeconds, "RUN_TOO_FAST");
        require(elapsed <= MAX_RUN_SECONDS, "RUN_EXPIRED");
        require(playSeconds >= m.minPlaySeconds, "PLAY_TIME_TOO_LOW");
        require(playSeconds <= elapsed + CLOCK_AHEAD_TOLERANCE_SECONDS, "CLIENT_TIME_AHEAD");
        require(clientScore >= m.requiredScore, "SCORE_TOO_LOW");
        uint256 scoreBase = milestone == 1 ? 0 : milestones[milestone - 1].requiredScore;
        require(clientScore <= scoreBase + elapsed * MAX_SCORE_PER_SECOND + SCORE_BURST_ALLOWANCE, "SCORE_RATE_TOO_HIGH");
        require(block.timestamp >= lastMintAt[player] + mintCooldown, "COOLDOWN");
    }

    function getActiveRun(address player) external view returns (
        uint64 nonce, uint64 startedAt, uint32 milestone, bytes32 challenge, bool active
    ) {
        RunSession memory run = activeRuns[player];
        return (run.nonce, run.startedAt, run.milestone, run.challenge, run.active);
    }

    function getMilestone(uint256 milestone) external view returns (Milestone memory) {
        require(milestone >= 1 && milestone <= MAX_MILESTONE, "BAD_MILESTONE");
        return milestones[milestone];
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return string.concat(baseTokenURI, tokenMilestone[tokenId].toString(), ".json");
    }

    function setMilestone(uint256 milestone, uint32 requiredScore, uint32 minPlaySeconds, bool active, string calldata name)
        external onlyOwner
    {
        require(milestone >= 1 && milestone <= MAX_MILESTONE, "BAD_MILESTONE");
        _setMilestone(milestone, requiredScore, minPlaySeconds, active, name);
    }

    function _setMilestone(uint256 milestone, uint32 requiredScore, uint32 minPlaySeconds, bool active, string memory name)
        internal
    {
        require(milestone >= 1 && milestone <= MAX_MILESTONE, "BAD_MILESTONE");
        require(requiredScore > 0 && minPlaySeconds > 0 && bytes(name).length > 0, "INVALID_MILESTONE");
        require(minPlaySeconds <= MAX_CLIENT_MINT_SECONDS, "MILESTONE_TIME_TOO_LONG");
        // A stage above the maximum attainable score allowed by the mint rate
        // and the shipped 900-second client window would be permanently unmintable.
        uint256 scoreBudget = MAX_CLIENT_MINT_SECONDS * MAX_SCORE_PER_SECOND + SCORE_BURST_ALLOWANCE;
        uint256 previousScore = milestone == 1 ? 0 : uint256(milestones[milestone - 1].requiredScore);
        require(uint256(requiredScore) <= previousScore + scoreBudget, "SCORE_UNREACHABLE");
        if (milestone < MAX_MILESTONE && milestones[milestone + 1].requiredScore > 0) {
            require(uint256(milestones[milestone + 1].requiredScore) <= uint256(requiredScore) + scoreBudget, "NEXT_SCORE_UNREACHABLE");
        }
        // Do not let later admin changes make the next milestone easier than
        // an earlier one or create an impossible progression schedule.
        if (milestone > 1 && milestones[milestone - 1].requiredScore > 0) {
            require(requiredScore > milestones[milestone - 1].requiredScore, "SCORE_ORDER");
            require(minPlaySeconds > milestones[milestone - 1].minPlaySeconds, "TIME_ORDER");
        }
        if (milestone < MAX_MILESTONE && milestones[milestone + 1].requiredScore > 0) {
            require(requiredScore < milestones[milestone + 1].requiredScore, "SCORE_ORDER");
            require(minPlaySeconds < milestones[milestone + 1].minPlaySeconds, "TIME_ORDER");
        }
        milestones[milestone] = Milestone(requiredScore, minPlaySeconds, active, name);
        emit MilestoneConfigured(milestone, requiredScore, minPlaySeconds, active, name);
    }

    function setBaseTokenURI(string calldata newBaseTokenURI) external onlyOwner {
        _setBaseTokenURI(newBaseTokenURI);
        emit BaseTokenURIUpdated(baseTokenURI);
    }

    // Metadata is addressed by milestone as <base>/<milestone>.json.
    // Normalize a missing slash instead of deploying broken NFT URLs.
    function _setBaseTokenURI(string memory value) internal {
        bytes memory uri = bytes(value);
        require(uri.length > 0, "EMPTY_BASE_URI");
        baseTokenURI = uri[uri.length - 1] == bytes1("/")
            ? value : string.concat(value, "/");
    }

    function setMintCooldown(uint256 newCooldown) external onlyOwner {
        require(newCooldown <= MAX_CLIENT_MINT_SECONDS, "TOO_LONG");
        mintCooldown = newCooldown;
        emit MintCooldownUpdated(newCooldown);
    }

    function setTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "ZERO_TREASURY");
        treasury = newTreasury;
        emit TreasuryUpdated(newTreasury);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    /// @notice Prevent permanently stranding pause administration by accident.
    function renounceOwnership() public override onlyOwner {
        revert("RENOUNCE_DISABLED");
    }


    receive() external payable { revert("NO_NATIVE_TOKEN_ACCEPTED"); }
    fallback() external payable { revert("NO_NATIVE_TOKEN_ACCEPTED"); }
}
