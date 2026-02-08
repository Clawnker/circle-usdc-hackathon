// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AgentReputationRegistry
 * @notice ERC-8004 Reputation Registry for Hivemind Protocol on Base
 * @dev Stores on-chain feedback from clients to agents, enabling composable reputation
 */
contract AgentReputationRegistry {
    address public identityRegistry;
    bool private _initialized;

    struct Feedback {
        int128 value;
        uint8 valueDecimals;
        string tag1;
        string tag2;
        bool isRevoked;
        uint64 feedbackIndex;
    }

    // agentId => clientAddress => feedbackIndex => Feedback
    mapping(uint256 => mapping(address => mapping(uint64 => Feedback))) public feedbacks;

    // agentId => clientAddress => feedbackCount
    mapping(uint256 => mapping(address => uint64)) public feedbackCounts;

    // agentId => total feedback count
    mapping(uint256 => uint256) public totalFeedbackCount;

    // agentId => aggregate score (sum of values)
    mapping(uint256 => int256) public aggregateScores;

    // Events
    event NewFeedback(
        uint256 indexed agentId,
        address indexed clientAddress,
        uint64 feedbackIndex,
        int128 value,
        uint8 valueDecimals,
        string indexed indexedTag1,
        string tag1,
        string tag2,
        string endpoint,
        string feedbackURI,
        bytes32 feedbackHash
    );

    event FeedbackRevoked(
        uint256 indexed agentId,
        address indexed clientAddress,
        uint64 feedbackIndex
    );

    modifier onlyInitialized() {
        require(_initialized, "Not initialized");
        _;
    }

    /**
     * @notice Initialize with the Identity Registry address
     */
    function initialize(address identityRegistry_) external {
        require(!_initialized, "Already initialized");
        require(identityRegistry_ != address(0), "Zero address");
        identityRegistry = identityRegistry_;
        _initialized = true;
    }

    function getIdentityRegistry() external view returns (address) {
        return identityRegistry;
    }

    /**
     * @notice Submit feedback for an agent
     * @param agentId The agent's token ID in the Identity Registry
     * @param value Signed fixed-point feedback value
     * @param valueDecimals Decimal places for the value (0-18)
     * @param tag1 Optional classification tag
     * @param tag2 Optional secondary tag
     * @param endpoint Optional endpoint URI being rated
     * @param feedbackURI Optional URI to off-chain feedback file
     * @param feedbackHash Optional KECCAK-256 hash of feedbackURI content
     */
    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external onlyInitialized {
        require(valueDecimals <= 18, "valueDecimals must be 0-18");

        // Prevent self-feedback (agent owner cannot rate own agent)
        // In production, check against Identity Registry ownership
        // For hackathon: we allow any address to give feedback

        uint64 idx = feedbackCounts[agentId][msg.sender] + 1;
        feedbackCounts[agentId][msg.sender] = idx;
        totalFeedbackCount[agentId]++;

        // Store on-chain data
        feedbacks[agentId][msg.sender][idx] = Feedback({
            value: value,
            valueDecimals: valueDecimals,
            tag1: tag1,
            tag2: tag2,
            isRevoked: false,
            feedbackIndex: idx
        });

        // Update aggregate score
        aggregateScores[agentId] += int256(value);

        emit NewFeedback(
            agentId,
            msg.sender,
            idx,
            value,
            valueDecimals,
            tag1,
            tag1,
            tag2,
            endpoint,
            feedbackURI,
            feedbackHash
        );
    }

    /**
     * @notice Revoke previously given feedback
     */
    function revokeFeedback(uint256 agentId, uint64 feedbackIndex) external {
        Feedback storage fb = feedbacks[agentId][msg.sender][feedbackIndex];
        require(fb.feedbackIndex == feedbackIndex, "Feedback not found");
        require(!fb.isRevoked, "Already revoked");

        fb.isRevoked = true;
        aggregateScores[agentId] -= int256(fb.value);

        emit FeedbackRevoked(agentId, msg.sender, feedbackIndex);
    }

    /**
     * @notice Get feedback details
     */
    function getFeedback(uint256 agentId, address client, uint64 feedbackIndex)
        external
        view
        returns (Feedback memory)
    {
        return feedbacks[agentId][client][feedbackIndex];
    }

    /**
     * @notice Get aggregate reputation for an agent
     */
    function getAgentReputation(uint256 agentId)
        external
        view
        returns (int256 score, uint256 totalFeedbacks)
    {
        return (aggregateScores[agentId], totalFeedbackCount[agentId]);
    }
}
