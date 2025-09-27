// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PythVolReader
 * @dev Read volatility and price data from Pyth Oracle for risk assessment
 */
contract PythVolReader is Ownable {
    IPyth public immutable pyth;

    // Price feed IDs (these need to be updated with actual Pyth feed IDs)
    bytes32 public constant SHIB_USD_FEED = 0xfedc35b66b7e28bf33c88f5bfea1b6c0a34b5b85568fff3067bfce9b4e073c16;
    bytes32 public constant ETH_USD_FEED = 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace;
    bytes32 public constant BTC_USD_FEED = 0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43;

    struct PriceData {
        int64 price;
        uint64 conf;
        int32 expo;
        uint256 publishTime;
    }

    struct VolatilityData {
        uint256 shortTermVol;  // 1-hour volatility
        uint256 mediumTermVol; // 24-hour volatility
        uint256 longTermVol;   // 7-day volatility
        uint256 lastUpdate;
    }

    mapping(bytes32 => VolatilityData) public feedVolatility;
    mapping(bytes32 => PriceData[]) public priceHistory;
    mapping(bytes32 => uint256) public lastPriceIndex;

    uint256 public constant MAX_PRICE_HISTORY = 168; // 1 week of hourly data
    uint256 public constant VOLATILITY_PRECISION = 1e6;

    event PriceUpdated(bytes32 indexed feedId, int64 price, uint256 timestamp);
    event VolatilityCalculated(
        bytes32 indexed feedId,
        uint256 shortTerm,
        uint256 mediumTerm,
        uint256 longTerm
    );

    constructor(address _pyth) Ownable(msg.sender) {
        pyth = IPyth(_pyth);
    }

    /**
     * @dev Update price feeds and calculate volatility
     * @param priceUpdateData Pyth price update data
     * @param feedIds Feed IDs to update
     */
    function updatePricesAndVolatility(
        bytes[] calldata priceUpdateData,
        bytes32[] calldata feedIds
    ) external payable {
        // Update Pyth prices
        uint fee = pyth.getUpdateFee(priceUpdateData);
        pyth.updatePriceFeeds{value: fee}(priceUpdateData);

        // Process each feed
        for (uint i = 0; i < feedIds.length; i++) {
            _updateFeedData(feedIds[i]);
        }
    }

    /**
     * @dev Get current price for a feed
     * @param feedId Price feed identifier
     * @return price Current price data
     */
    function getCurrentPrice(bytes32 feedId)
        external
        view
        returns (PriceData memory price)
    {
        PythStructs.Price memory pythPrice = pyth.getPrice(feedId);
        return PriceData({
            price: pythPrice.price,
            conf: pythPrice.conf,
            expo: pythPrice.expo,
            publishTime: pythPrice.publishTime
        });
    }

    /**
     * @dev Get volatility data for a feed
     * @param feedId Price feed identifier
     * @return vol Volatility data
     */
    function getVolatility(bytes32 feedId)
        external
        view
        returns (VolatilityData memory vol)
    {
        return feedVolatility[feedId];
    }

    /**
     * @dev Get normalized volatility score (0-1000)
     * @param feedId Price feed identifier
     * @return score Volatility score where 1000 = extremely high volatility
     */
    function getVolatilityScore(bytes32 feedId) external view returns (uint256 score) {
        VolatilityData memory vol = feedVolatility[feedId];

        // Weight different time periods
        uint256 weightedVol = (vol.shortTermVol * 50 + vol.mediumTermVol * 30 + vol.longTermVol * 20) / 100;

        // Normalize to 0-1000 scale (capped at 100% volatility = 1000)
        score = (weightedVol * 1000) / VOLATILITY_PRECISION;
        if (score > 1000) score = 1000;

        return score;
    }

    /**
     * @dev Get risk multiplier based on volatility (lambda value)
     * @param feedId Price feed identifier
     * @return lambda Risk multiplier scaled by 1000 (1000 = 1.0x)
     */
    function getRiskMultiplier(bytes32 feedId) external view returns (uint256 lambda) {
        uint256 volScore = this.getVolatilityScore(feedId);

        // Inverse relationship: higher volatility = lower lambda
        // Max lambda = 1.8 (1800), Min lambda = 0.3 (300)
        if (volScore == 0) {
            lambda = 1800; // Low volatility = high lambda
        } else if (volScore >= 1000) {
            lambda = 300;  // Extreme volatility = min lambda
        } else {
            // Linear interpolation: lambda = 1.8 - (volatility * 1.5 / 1000)
            lambda = 1800 - (volScore * 1500) / 1000;
        }

        return lambda;
    }

    /**
     * @dev Calculate Returns-based volatility from price history
     * @param feedId Price feed identifier
     * @param periods Number of periods to analyze
     * @return volatility Annualized volatility
     */
    function calculateVolatility(bytes32 feedId, uint256 periods)
        public
        view
        returns (uint256 volatility)
    {
        PriceData[] memory history = priceHistory[feedId];
        uint256 historyLength = history.length;

        if (historyLength < periods + 1) {
            return 0; // Not enough data
        }

        // Calculate log returns
        int256[] memory priceReturns = new int256[](periods);
        int256 sumReturns = 0;

        for (uint i = 0; i < periods; i++) {
            uint256 currentIdx = historyLength - 1 - i;
            uint256 prevIdx = currentIdx - 1;

            // Log return = ln(P_t / P_{t-1}) * precision
            int64 currentPrice = history[currentIdx].price;
            int64 prevPrice = history[prevIdx].price;

            if (prevPrice > 0 && currentPrice > 0) {
                // Simplified log return calculation (ln approximation)
                priceReturns[i] = (int256(currentPrice - prevPrice) * int256(VOLATILITY_PRECISION)) / int256(prevPrice);
                sumReturns += priceReturns[i];
            }
        }

        // Calculate mean return
        int256 meanReturn = sumReturns / int256(periods);

        // Calculate variance
        uint256 sumSquaredDeviations = 0;
        for (uint i = 0; i < periods; i++) {
            int256 deviation = priceReturns[i] - meanReturn;
            sumSquaredDeviations += uint256(deviation * deviation);
        }

        // Standard deviation (volatility)
        volatility = sqrt(sumSquaredDeviations / periods);

        // Annualize volatility (assuming hourly data)
        volatility = volatility * sqrt(8760); // 24 * 365 hours per year

        return volatility;
    }

    /**
     * @dev Internal function to update feed data
     * @param feedId Price feed identifier
     */
    function _updateFeedData(bytes32 feedId) internal {
        PythStructs.Price memory pythPrice = pyth.getPrice(feedId);

        // Store price data
        PriceData memory newPrice = PriceData({
            price: pythPrice.price,
            conf: pythPrice.conf,
            expo: pythPrice.expo,
            publishTime: pythPrice.publishTime
        });

        // Add to price history
        PriceData[] storage history = priceHistory[feedId];
        if (history.length >= MAX_PRICE_HISTORY) {
            // Remove oldest entry
            for (uint i = 0; i < history.length - 1; i++) {
                history[i] = history[i + 1];
            }
            history[history.length - 1] = newPrice;
        } else {
            history.push(newPrice);
        }

        // Calculate volatilities
        VolatilityData storage vol = feedVolatility[feedId];
        vol.shortTermVol = calculateVolatility(feedId, 24);   // 24 hours
        vol.mediumTermVol = calculateVolatility(feedId, 168); // 7 days
        vol.longTermVol = calculateVolatility(feedId, 720);   // 30 days
        vol.lastUpdate = block.timestamp;

        emit PriceUpdated(feedId, pythPrice.price, pythPrice.publishTime);
        emit VolatilityCalculated(
            feedId,
            vol.shortTermVol,
            vol.mediumTermVol,
            vol.longTermVol
        );
    }

    /**
     * @dev Square root function for volatility calculations
     */
    function sqrt(uint256 x) public pure returns (uint256) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        return y;
    }

    /**
     * @dev Get SHIB/USD specific data
     */
    function getShibData() external view returns (PriceData memory price, VolatilityData memory vol, uint256 lambda) {
        price = this.getCurrentPrice(SHIB_USD_FEED);
        vol = feedVolatility[SHIB_USD_FEED];
        lambda = this.getRiskMultiplier(SHIB_USD_FEED);
    }

    /**
     * @dev Emergency function to update feed IDs
     */
    function updateFeedId(string calldata feedName, bytes32 newFeedId) external onlyOwner {
        // Implementation depends on requirements
        // This allows updating feed IDs if Pyth changes them
    }
}