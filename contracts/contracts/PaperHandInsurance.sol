// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IRealOracle {
    function getShibPrice() external view returns (uint256);
}

contract PaperHandInsurance is ERC721, Ownable {
    IRealOracle public priceOracle;

    struct InsurancePolicy {
        uint256 loanAmount;
        uint256 triggerPrice;
        uint256 payoutAmount;
        bool claimed;
        string dogMeme;
        address owner;
        uint256 createdAt;
    }

    mapping(uint256 => InsurancePolicy) public policies;
    uint256 public nextTokenId = 1;
    uint256 public totalInsuranceFund;

    event PolicyCreated(uint256 indexed tokenId, address indexed owner, uint256 loanAmount, string dogMeme);
    event PayoutClaimed(uint256 indexed tokenId, address indexed owner, uint256 payoutAmount);
    event VolatilitySpike(uint256 newPrice, uint256 triggerPrice);

    constructor(address _priceOracle) ERC721("Paper-Hand Insurance", "PHI") Ownable(msg.sender) {
        priceOracle = IRealOracle(_priceOracle);
    }

    function mintInsurance(
        address to,
        uint256 loanAmount,
        string memory dogMeme
    ) external payable returns (uint256) {
        require(msg.value >= (loanAmount * 1) / 100, "Insurance fee: 1% of loan");

        uint256 currentPrice = priceOracle.getShibPrice();
        uint256 triggerPrice = (currentPrice * 80) / 100; // 20% drop trigger
        uint256 payoutAmount = (loanAmount * 10) / 100; // 10% of loan amount payout

        uint256 tokenId = nextTokenId++;

        policies[tokenId] = InsurancePolicy({
            loanAmount: loanAmount,
            triggerPrice: triggerPrice,
            payoutAmount: payoutAmount,
            claimed: false,
            dogMeme: dogMeme,
            owner: to,
            createdAt: block.timestamp
        });

        totalInsuranceFund += msg.value;
        _mint(to, tokenId);

        emit PolicyCreated(tokenId, to, loanAmount, dogMeme);

        return tokenId;
    }

    function checkAndTriggerPayout(uint256 tokenId) external {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        InsurancePolicy storage policy = policies[tokenId];
        require(!policy.claimed, "Already claimed");

        uint256 currentPrice = priceOracle.getShibPrice();
        require(currentPrice <= policy.triggerPrice, "Price hasn't dropped enough");

        policy.claimed = true;

        // Pay out the insurance
        payable(policy.owner).transfer(policy.payoutAmount);

        emit PayoutClaimed(tokenId, policy.owner, policy.payoutAmount);
        emit VolatilitySpike(currentPrice, policy.triggerPrice);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        InsurancePolicy memory policy = policies[tokenId];

        // Generate on-chain dog meme NFT metadata
        string memory json = string(abi.encodePacked(
            '{"name": "Paper-Hand Insurance #',
            toString(tokenId),
            '", "description": "Much protection, very wise! ',
            policy.dogMeme,
            '", "image": "https://ipfs.io/ipfs/QmDogMemeBase64EncodedImage", "attributes": [',
            '{"trait_type": "Loan Amount", "value": "',
            toString(policy.loanAmount),
            '"}, {"trait_type": "Dog Meme", "value": "',
            policy.dogMeme,
            '"}, {"trait_type": "Protection Level", "value": "Much Secure"}',
            ']}'
        ));

        return string(abi.encodePacked(
            "data:application/json;base64,",
            base64Encode(bytes(json))
        ));
    }

    function base64Encode(bytes memory data) internal pure returns (string memory) {
        // Simple base64 encoding for demonstration
        // In production, use a proper base64 library
        string memory table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

        if (data.length == 0) return "";

        string memory result = new string(4 * ((data.length + 2) / 3));
        bytes memory resultBytes = bytes(result);

        uint256 tablePtr;
        uint256 resultPtr;

        assembly {
            tablePtr := add(table, 1)
            resultPtr := add(resultBytes, 32)
        }

        for (uint256 i = 0; i < data.length; i += 3) {
            uint256 a = uint256(uint8(data[i]));
            uint256 b = i + 1 < data.length ? uint256(uint8(data[i + 1])) : 0;
            uint256 c = i + 2 < data.length ? uint256(uint8(data[i + 2])) : 0;

            uint256 bitmap = (a << 16) | (b << 8) | c;

            assembly {
                let char1 := byte(0, mload(add(tablePtr, shr(18, bitmap))))
                let char2 := byte(0, mload(add(tablePtr, and(shr(12, bitmap), 0x3F))))
                let char3 := byte(0, mload(add(tablePtr, and(shr(6, bitmap), 0x3F))))
                let char4 := byte(0, mload(add(tablePtr, and(bitmap, 0x3F))))

                mstore8(resultPtr, char1)
                mstore8(add(resultPtr, 1), char2)
                mstore8(add(resultPtr, 2), char3)
                mstore8(add(resultPtr, 3), char4)

                resultPtr := add(resultPtr, 4)
            }
        }

        return result;
    }

    function toString(uint256 value) internal pure returns (string memory) {
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

    function withdrawFunds() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}