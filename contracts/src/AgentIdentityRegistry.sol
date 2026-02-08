// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AgentIdentityRegistry
 * @notice ERC-8004 Identity Registry for Hivemind Protocol agents on Base
 * @dev Implements agent registration as ERC-721 NFTs with URI-based metadata
 *      and on-chain metadata storage per the ERC-8004 specification.
 */
contract AgentIdentityRegistry is ERC721URIStorage, Ownable {
    uint256 private _nextAgentId = 1;

    // On-chain metadata: agentId => key => value
    mapping(uint256 => mapping(string => bytes)) private _metadata;

    // Agent wallet: agentId => verified wallet address
    mapping(uint256 => address) private _agentWallets;

    // EIP-712 domain separator for wallet verification
    bytes32 public constant WALLET_TYPEHASH =
        keccak256("SetAgentWallet(uint256 agentId,address newWallet,uint256 deadline)");
    bytes32 public immutable DOMAIN_SEPARATOR;

    struct MetadataEntry {
        string metadataKey;
        bytes metadataValue;
    }

    // Events
    event Registered(uint256 indexed agentId, string agentURI, address indexed owner);
    event URIUpdated(uint256 indexed agentId, string newURI, address indexed updatedBy);
    event MetadataSet(
        uint256 indexed agentId,
        string indexed indexedMetadataKey,
        string metadataKey,
        bytes metadataValue
    );
    event AgentWalletSet(uint256 indexed agentId, address indexed newWallet);
    event AgentWalletUnset(uint256 indexed agentId);

    constructor() ERC721("Hivemind Agent", "HAGENT") Ownable(msg.sender) {
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("AgentIdentityRegistry")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    // ─── Registration ───────────────────────────────────────────────

    /**
     * @notice Register a new agent with URI and optional metadata
     */
    function register(string calldata agentURI, MetadataEntry[] calldata metadata)
        external
        returns (uint256 agentId)
    {
        agentId = _nextAgentId++;
        _safeMint(msg.sender, agentId);
        _setTokenURI(agentId, agentURI);

        // Set default agent wallet to owner
        _agentWallets[agentId] = msg.sender;
        emit MetadataSet(agentId, "agentWallet", "agentWallet", abi.encode(msg.sender));

        // Set additional metadata
        for (uint256 i = 0; i < metadata.length; i++) {
            require(
                keccak256(bytes(metadata[i].metadataKey)) != keccak256(bytes("agentWallet")),
                "agentWallet is reserved"
            );
            _metadata[agentId][metadata[i].metadataKey] = metadata[i].metadataValue;
            emit MetadataSet(agentId, metadata[i].metadataKey, metadata[i].metadataKey, metadata[i].metadataValue);
        }

        emit Registered(agentId, agentURI, msg.sender);
    }

    /**
     * @notice Register a new agent with URI only
     */
    function register(string calldata agentURI) external returns (uint256 agentId) {
        agentId = _nextAgentId++;
        _safeMint(msg.sender, agentId);
        _setTokenURI(agentId, agentURI);
        _agentWallets[agentId] = msg.sender;
        emit MetadataSet(agentId, "agentWallet", "agentWallet", abi.encode(msg.sender));
        emit Registered(agentId, agentURI, msg.sender);
    }

    /**
     * @notice Register a new agent without URI (set later)
     */
    function register() external returns (uint256 agentId) {
        agentId = _nextAgentId++;
        _safeMint(msg.sender, agentId);
        _agentWallets[agentId] = msg.sender;
        emit MetadataSet(agentId, "agentWallet", "agentWallet", abi.encode(msg.sender));
        emit Registered(agentId, "", msg.sender);
    }

    // ─── URI Management ─────────────────────────────────────────────

    function setAgentURI(uint256 agentId, string calldata newURI) external {
        require(_isAuthorized(ownerOf(agentId), msg.sender, agentId), "Not authorized");
        _setTokenURI(agentId, newURI);
        emit URIUpdated(agentId, newURI, msg.sender);
    }

    // ─── Metadata ───────────────────────────────────────────────────

    function getMetadata(uint256 agentId, string memory metadataKey)
        external
        view
        returns (bytes memory)
    {
        return _metadata[agentId][metadataKey];
    }

    function setMetadata(uint256 agentId, string memory metadataKey, bytes memory metadataValue)
        external
    {
        require(_isAuthorized(ownerOf(agentId), msg.sender, agentId), "Not authorized");
        require(
            keccak256(bytes(metadataKey)) != keccak256(bytes("agentWallet")),
            "Use setAgentWallet()"
        );
        _metadata[agentId][metadataKey] = metadataValue;
        emit MetadataSet(agentId, metadataKey, metadataKey, metadataValue);
    }

    // ─── Agent Wallet ───────────────────────────────────────────────

    function getAgentWallet(uint256 agentId) external view returns (address) {
        return _agentWallets[agentId];
    }

    function setAgentWallet(
        uint256 agentId,
        address newWallet,
        uint256 deadline,
        bytes calldata signature
    ) external {
        require(_isAuthorized(ownerOf(agentId), msg.sender, agentId), "Not authorized");
        require(block.timestamp <= deadline, "Signature expired");
        require(newWallet != address(0), "Zero address");

        // Verify EIP-712 signature from new wallet
        bytes32 structHash = keccak256(abi.encode(WALLET_TYPEHASH, agentId, newWallet, deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));

        (bytes32 r, bytes32 s, uint8 v) = _splitSignature(signature);
        address signer = ecrecover(digest, v, r, s);
        require(signer == newWallet, "Invalid wallet signature");

        _agentWallets[agentId] = newWallet;
        emit AgentWalletSet(agentId, newWallet);
    }

    function unsetAgentWallet(uint256 agentId) external {
        require(_isAuthorized(ownerOf(agentId), msg.sender, agentId), "Not authorized");
        delete _agentWallets[agentId];
        emit AgentWalletUnset(agentId);
    }

    // ─── Query helpers ──────────────────────────────────────────────

    function totalAgents() external view returns (uint256) {
        return _nextAgentId - 1;
    }

    // ─── Overrides ──────────────────────────────────────────────────

    /**
     * @dev Clear agent wallet on transfer (ERC-8004 requirement)
     */
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = super._update(to, tokenId, auth);
        if (from != address(0) && to != address(0)) {
            // Transfer — clear agent wallet
            delete _agentWallets[tokenId];
            emit AgentWalletUnset(tokenId);
        }
        return from;
    }

    // ─── Internal ───────────────────────────────────────────────────

    function _splitSignature(bytes memory sig)
        internal
        pure
        returns (bytes32 r, bytes32 s, uint8 v)
    {
        require(sig.length == 65, "Invalid signature length");
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
    }
}
