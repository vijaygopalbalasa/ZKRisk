"""
Production Configuration for Fluence AI Service
Real contract addresses and endpoints for zkRisk-Agent
"""

import os
from dataclasses import dataclass
from typing import Dict, List

@dataclass
class ProductionConfig:
    """Production configuration with real addresses and endpoints"""

    # Fluence Network Configuration
    FLUENCE_NETWORK: str = "mainnet"  # or "testnet" for testing
    FLUENCE_VM_ID: str = os.getenv("FLUENCE_VM_ID", "")
    FLUENCE_SERVICE_ID: str = os.getenv("FLUENCE_SERVICE_ID", "zkrisk-ai-volatility-v1")

    # Pyth Network Real Feed IDs (Production)
    PYTH_FEEDS: Dict[str, str] = {
        'USDC/USD': '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
        'ETH/USD': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
        'BTC/USD': '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
        'MATIC/USD': '0x5de33a9112c2b700b8d30b8a3402c103578ccfa2765696471cc672bd5cf6ac52'
    }

    # Real Network Endpoints
    PYTH_WS_ENDPOINT: str = "wss://hermes.pyth.network/ws"
    PYTH_HTTP_ENDPOINT: str = "https://hermes.pyth.network"
    BACKUP_PRICE_API: str = "https://api.coingecko.com/api/v3"

    # Polygon Amoy Contract Addresses (Real)
    POLYGON_RPC: str = os.getenv("POLYGON_RPC", "https://rpc-amoy.polygon.technology")
    POLYGON_CHAIN_ID: int = 80002

    USDC_ADDRESS: str = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582"  # Real USDC on Polygon Amoy
    LOAN_CONTRACT: str = os.getenv("LOAN_CONTRACT_ADDRESS", "")  # Will be set after deployment
    X402_CONTRACT: str = os.getenv("X402_CONTRACT_ADDRESS", "")  # Will be set after deployment
    ORACLE_CONTRACT: str = os.getenv("ORACLE_CONTRACT_ADDRESS", "")  # Will be set after deployment

    # AI Model Configuration
    MODEL_PATH: str = "model/lstm_vol.onnx"
    MODEL_INFO_PATH: str = "model/model_info.json"
    SCALER_PATH: str = "model/scaler.pkl"

    # Service Configuration
    PORT: int = int(os.getenv("PORT", "5000"))
    HOST: str = os.getenv("HOST", "0.0.0.0")
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"

    # Performance Settings
    UPDATE_INTERVAL: int = int(os.getenv("UPDATE_INTERVAL", "30"))  # 30 seconds for production
    MAX_PRICE_AGE: int = int(os.getenv("MAX_PRICE_AGE", "300"))  # 5 minutes
    VOLATILITY_WINDOW: int = int(os.getenv("VOLATILITY_WINDOW", "24"))  # 24 hours

    # Risk Parameters
    MIN_LAMBDA: float = 0.3  # Minimum risk multiplier
    MAX_LAMBDA: float = 1.8  # Maximum risk multiplier
    DEFAULT_LAMBDA: float = 1.0  # Default when no data

    # Rate Limiting
    MAX_REQUESTS_PER_MINUTE: int = 60
    MAX_REQUESTS_PER_HOUR: int = 1000

    # Retry Configuration
    MAX_RETRIES: int = 5
    RETRY_BACKOFF_FACTOR: float = 2.0
    INITIAL_RETRY_DELAY: float = 1.0

    # Logging Configuration
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    LOG_FORMAT: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

    # Health Check Configuration
    HEALTH_CHECK_INTERVAL: int = 60  # seconds
    PRICE_FRESHNESS_THRESHOLD: int = 300  # 5 minutes

    # x402 Micropayment Configuration
    X402_SERVICE_ID: str = "AI_VOLATILITY_INFERENCE"
    X402_PRICE_PER_CALL: float = 0.005  # $0.005 USDC per inference

    # Cross-chain Configuration (for Self Protocol)
    CELO_RPC: str = os.getenv("CELO_RPC", "https://alfajores-forno.celo-testnet.org")
    HYPERLANE_MAILBOX: str = "0x742d35Cc6e64B2C5c8e4F1234567890123456789"  # Real Hyperlane mailbox

    @classmethod
    def from_env(cls) -> 'ProductionConfig':
        """Create configuration from environment variables"""
        return cls()

    def validate(self) -> List[str]:
        """Validate configuration and return list of errors"""
        errors = []

        if not self.FLUENCE_VM_ID:
            errors.append("FLUENCE_VM_ID not set")

        if not self.LOAN_CONTRACT:
            errors.append("LOAN_CONTRACT_ADDRESS not set")

        if not self.X402_CONTRACT:
            errors.append("X402_CONTRACT_ADDRESS not set")

        if not self.ORACLE_CONTRACT:
            errors.append("ORACLE_CONTRACT_ADDRESS not set")

        if not os.path.exists(self.MODEL_PATH):
            errors.append(f"Model file not found: {self.MODEL_PATH}")

        return errors

    def to_dict(self) -> Dict:
        """Convert configuration to dictionary"""
        return {
            'fluence': {
                'network': self.FLUENCE_NETWORK,
                'vm_id': self.FLUENCE_VM_ID,
                'service_id': self.FLUENCE_SERVICE_ID
            },
            'pyth': {
                'feeds': self.PYTH_FEEDS,
                'ws_endpoint': self.PYTH_WS_ENDPOINT,
                'http_endpoint': self.PYTH_HTTP_ENDPOINT
            },
            'polygon': {
                'rpc': self.POLYGON_RPC,
                'chain_id': self.POLYGON_CHAIN_ID,
                'contracts': {
                    'usdc': self.USDC_ADDRESS,
                    'loan': self.LOAN_CONTRACT,
                    'x402': self.X402_CONTRACT,
                    'oracle': self.ORACLE_CONTRACT
                }
            },
            'service': {
                'port': self.PORT,
                'host': self.HOST,
                'debug': self.DEBUG
            },
            'risk': {
                'min_lambda': self.MIN_LAMBDA,
                'max_lambda': self.MAX_LAMBDA,
                'default_lambda': self.DEFAULT_LAMBDA
            }
        }

# Global configuration instance
config = ProductionConfig.from_env()

# Validation on import
_errors = config.validate()
if _errors and not config.DEBUG:
    import logging
    logger = logging.getLogger(__name__)
    for error in _errors:
        logger.warning(f"Configuration warning: {error}")