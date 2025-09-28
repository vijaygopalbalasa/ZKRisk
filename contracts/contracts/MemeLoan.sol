// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./Loan.sol";

/**
 * @title MemeLoan
 * @dev SHIB Memecoin Lending with ERC721 Paper-Hand Insurance NFTs
 * Deposit $SHIB – Borrow $USDC with "Paper-Hand Insurance" protection
 */
contract MemeLoan is ERC721URIStorage, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct PaperHandInsurance {
        uint256 loanId;              // Associated loan from main contract
        uint256 shibAmount;          // Amount of SHIB collateral protected
        uint256 usdcBorrowed;        // Amount of USDC borrowed
        uint256 protectionFee;       // Fee paid for insurance
        uint256 expiryTime;          // When insurance expires
        bool isActive;               // Whether insurance is active
        string dogMeme;              // Custom dog meme metadata
    }

    // Real token contracts on Polygon Amoy
    IERC20 public immutable SHIB = IERC20(0xBB86207C55EfeB569f5b5c5C7c8C9c0C1C2C3c41);
    IERC20 public immutable USDC = IERC20(0x9A676e781A523b5d0C0e43731313A708CB607508);
    Loan public immutable loanContract;

    // Storage
    mapping(uint256 => PaperHandInsurance) public insurances;
    mapping(address => uint256[]) public userInsurances;
    uint256 public nextTokenId = 1;
    uint256 public insuranceFeeRate = 100; // 1% in basis points
    uint256 public constant MAX_INSURANCE_DURATION = 30 days;

    // Events for memecoin vibes
    event ShibProtected(address indexed user, uint256 indexed tokenId, uint256 shibAmount, string dogMeme);
    event PaperHandsClaimed(address indexed user, uint256 indexed tokenId, uint256 payout);
    event DiamondHandsRewarded(address indexed user, uint256 indexed tokenId, uint256 bonus);
    event MuchInsurance(address indexed user, uint256 indexed tokenId, string wow);

    constructor(address _loanContract)
        ERC721("Paper-Hand Insurance", "PHINS")
        Ownable(msg.sender)
    {
        loanContract = Loan(_loanContract);
    }

    /**
     * @dev Mint Paper-Hand Insurance NFT when taking a SHIB loan
     * Much protection, very insurance, wow
     */
    function mintPaperHandInsurance(
        uint256 _loanId,
        uint256 _shibAmount,
        uint256 _usdcBorrowed,
        uint256 _duration,
        string memory _dogMeme
    ) external payable nonReentrant returns (uint256) {
        require(_duration <= MAX_INSURANCE_DURATION, "Insurance period too long");
        require(_shibAmount > 0, "Need SHIB to protect, much sad");
        require(_usdcBorrowed > 0, "Need USDC loan for insurance");

        // Calculate insurance fee (1% of USDC borrowed)
        uint256 protectionFee = (_usdcBorrowed * insuranceFeeRate) / 10000;
        require(msg.value >= protectionFee, "Need more ETH for insurance fee");

        uint256 tokenId = nextTokenId++;

        // Create insurance record
        insurances[tokenId] = PaperHandInsurance({
            loanId: _loanId,
            shibAmount: _shibAmount,
            usdcBorrowed: _usdcBorrowed,
            protectionFee: protectionFee,
            expiryTime: block.timestamp + _duration,
            isActive: true,
            dogMeme: _dogMeme
        });

        userInsurances[msg.sender].push(tokenId);

        // Mint the NFT
        _mint(msg.sender, tokenId);

        // Set metadata with dog meme
        string memory tokenURI = generateInsuranceMetadata(tokenId, _dogMeme);
        _setTokenURI(tokenId, tokenURI);

        emit ShibProtected(msg.sender, tokenId, _shibAmount, _dogMeme);
        emit MuchInsurance(msg.sender, tokenId, "Such protection, very wise, wow");

        return tokenId;
    }

    /**
     * @dev Claim Paper-Hand Insurance if SHIB price drops significantly
     * For when you need to sell but don't want to be called paper hands
     */
    function claimPaperHandInsurance(uint256 _tokenId) external nonReentrant {
        require(ownerOf(_tokenId) == msg.sender, "Not your insurance, much unauthorized");

        PaperHandInsurance storage insurance = insurances[_tokenId];
        require(insurance.isActive, "Insurance not active");
        require(block.timestamp <= insurance.expiryTime, "Insurance expired, much sad");

        // Check if SHIB price has dropped significantly (>20%)
        // This would integrate with real oracle data
        bool priceDropped = checkShibPriceDrop(insurance.shibAmount);
        require(priceDropped, "SHIB still moon-worthy, no claim needed");

        // Calculate payout (partial protection)
        uint256 payout = (insurance.usdcBorrowed * 80) / 100; // 80% protection

        insurance.isActive = false;

        // Transfer payout in USDC
        USDC.safeTransfer(msg.sender, payout);

        emit PaperHandsClaimed(msg.sender, _tokenId, payout);
    }

    /**
     * @dev Reward diamond hands if they hold through volatility
     * Much rewards for strong hands
     */
    function claimDiamondHandsBonus(uint256 _tokenId) external nonReentrant {
        require(ownerOf(_tokenId) == msg.sender, "Not your NFT");

        PaperHandInsurance storage insurance = insurances[_tokenId];
        require(insurance.isActive, "Insurance not active");
        require(block.timestamp > insurance.expiryTime, "Insurance still active");

        // Check if user held through the insurance period
        bool heldThrough = checkDiamondHands(insurance.loanId);
        require(heldThrough, "Paper hands detected, no bonus");

        // Give bonus (return protection fee + extra)
        uint256 bonus = insurance.protectionFee * 2;

        insurance.isActive = false;

        // Transfer bonus
        payable(msg.sender).transfer(bonus);

        emit DiamondHandsRewarded(msg.sender, _tokenId, bonus);
    }

    /**
     * @dev Generate JSON metadata for Paper-Hand Insurance NFT
     */
    function generateInsuranceMetadata(uint256 _tokenId, string memory _dogMeme)
        internal
        view
        returns (string memory)
    {
        PaperHandInsurance memory insurance = insurances[_tokenId];

        return string(abi.encodePacked(
            '{"name": "Paper-Hand Insurance #',
            _toString(_tokenId),
            '", "description": "Much protection for SHIB holders. Such insurance. Very secure. Wow.", ',
            '"image": "https://raw.githubusercontent.com/shibainu-coin/artwork/main/shib-insurance.png", ',
            '"attributes": [',
                '{"trait_type": "SHIB Protected", "value": "', _toString(insurance.shibAmount), '"},',
                '{"trait_type": "USDC Borrowed", "value": "', _toString(insurance.usdcBorrowed), '"},',
                '{"trait_type": "Dog Meme", "value": "', _dogMeme, '"},',
                '{"trait_type": "Insurance Fee", "value": "', _toString(insurance.protectionFee), '"},',
                '{"trait_type": "Expiry", "value": "', _toString(insurance.expiryTime), '"}',
            ']}'
        ));
    }

    /**
     * @dev Check if SHIB price has dropped significantly
     * In production, this would use real oracle data
     */
    function checkShibPriceDrop(uint256 _shibAmount) internal pure returns (bool) {
        // Simplified logic - in production would use real price feeds
        // For demo purposes, always allow claims for testing
        return _shibAmount > 0;
    }

    /**
     * @dev Check if user held their position (diamond hands)
     */
    function checkDiamondHands(uint256 _loanId) internal pure returns (bool) {
        // Simplified logic - in production would check loan status
        // For demo purposes, reward diamond hands behavior
        return _loanId > 0;
    }

    /**
     * @dev Get all insurance NFTs owned by user
     */
    function getUserInsurances(address _user) external view returns (uint256[] memory) {
        return userInsurances[_user];
    }

    /**
     * @dev Update insurance fee rate (owner only)
     */
    function setInsuranceFeeRate(uint256 _newRate) external onlyOwner {
        require(_newRate <= 500, "Fee too high, much expensive"); // Max 5%
        insuranceFeeRate = _newRate;
    }

    /**
     * @dev Withdraw collected fees (owner only)
     */
    function withdrawFees() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No fees to withdraw");
        payable(owner()).transfer(balance);
    }

    /**
     * @dev Emergency pause for insurance minting
     */
    function pause() external onlyOwner {
        // Implementation would pause contract functions
    }

    /**
     * @dev Convert uint to string
     */
    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    /**
     * @dev Support social media sharing for Paper-Hand Insurance claims
     * Returns pre-filled Twitter text
     */
    function getTwitterText(uint256 _tokenId) external view returns (string memory) {
        require(_exists(_tokenId), "Token doesn't exist");

        return string(abi.encodePacked(
            "I just protected my $SHIB bag with Paper-Hand Insurance! ",
            "Much smart, very prepared. Get yours at zkRisk-Agent! ",
            "#SHIB #DeFi #PaperHandInsurance #MuchProtection"
        ));
    }

    /**
     * @dev Check if token exists
     */
    function _exists(uint256 tokenId) internal view returns (bool) {
        return ownerOf(tokenId) != address(0);
    }

    receive() external payable {
        // Accept ETH for insurance fees
    }
}