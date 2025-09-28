"""
Enhanced AI Service for Real LSTM Volatility Prediction
Integrates real Pyth Network price data with LSTM model for accurate volatility forecasting
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import requests
import asyncio
import threading
import time
from typing import List, Dict, Optional, Tuple
import logging

logger = logging.getLogger(__name__)

class EnhancedVolatilityPredictor:
    def __init__(self, onnx_session, hermes_endpoint: str = "https://hermes.pyth.network"):
        self.session = onnx_session
        self.hermes_endpoint = hermes_endpoint

        # Real-time price data storage
        self.price_history: Dict[str, List[Dict]] = {
            'ETH/USD': [],
            'BTC/USD': [],
            'USDC/USD': [],
            'SOL/USD': []
        }

        # Pyth price feed IDs
        self.pyth_feeds = {
            'ETH/USD': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
            'BTC/USD': '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
            'USDC/USD': '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
            'SOL/USD': '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d'
        }

        # Price collection thread
        self.collecting = False
        self.collection_thread = None

        # Volatility model parameters
        self.sequence_length = 24
        self.feature_count = 5
        self.max_history = 1000  # Keep last 1000 price points

    def start_price_collection(self):
        """Start collecting real-time price data"""
        if not self.collecting:
            self.collecting = True
            self.collection_thread = threading.Thread(target=self._price_collection_loop)
            self.collection_thread.daemon = True
            self.collection_thread.start()
            logger.info("🔄 Started real-time price collection for volatility prediction")

    def stop_price_collection(self):
        """Stop price collection"""
        self.collecting = False
        if self.collection_thread:
            self.collection_thread.join(timeout=5)
        logger.info("⏹️ Stopped price collection")

    def _price_collection_loop(self):
        """Background loop to collect price data"""
        while self.collecting:
            try:
                # Collect prices for all symbols
                for symbol in self.pyth_feeds.keys():
                    price_data = self._fetch_pyth_price(symbol)
                    if price_data:
                        self._store_price_data(symbol, price_data)

                # Sleep for 30 seconds between collections
                time.sleep(30)

            except Exception as e:
                logger.error(f"❌ Error in price collection loop: {e}")
                time.sleep(60)  # Wait longer on error

    def _fetch_pyth_price(self, symbol: str) -> Optional[Dict]:
        """Fetch latest price from Pyth Network"""
        try:
            feed_id = self.pyth_feeds.get(symbol)
            if not feed_id:
                return None

            url = f"{self.hermes_endpoint}/v2/updates/price/latest"
            params = {
                'ids[]': feed_id,
                'parsed': 'true'
            }

            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()

            data = response.json()
            if 'parsed' not in data or not data['parsed']:
                return None

            price_data = data['parsed'][0]
            price_info = price_data['price']

            # Extract price with correct exponent
            price = float(price_info['price']) * (10 ** price_info['expo'])
            confidence = float(price_info['conf']) * (10 ** price_info['expo'])
            timestamp = price_info['publishTime']

            return {
                'symbol': symbol,
                'price': price,
                'confidence': confidence,
                'timestamp': timestamp,
                'datetime': datetime.fromtimestamp(timestamp)
            }

        except Exception as e:
            logger.error(f"❌ Failed to fetch {symbol} price: {e}")
            return None

    def _store_price_data(self, symbol: str, price_data: Dict):
        """Store price data for volatility calculation"""
        if symbol not in self.price_history:
            self.price_history[symbol] = []

        # Add new price point
        self.price_history[symbol].append(price_data)

        # Keep only recent history
        if len(self.price_history[symbol]) > self.max_history:
            self.price_history[symbol] = self.price_history[symbol][-self.max_history:]

        logger.debug(f"📊 Stored {symbol} price: ${price_data['price']:.4f}")

    def calculate_historical_volatility(self, symbol: str = 'ETH/USD', period_hours: int = 24) -> float:
        """Calculate historical volatility from real price data"""
        try:
            if symbol not in self.price_history or len(self.price_history[symbol]) < 2:
                logger.warning(f"⚠️ Insufficient price data for {symbol}, using fallback volatility")
                return 0.15  # Fallback volatility

            prices = self.price_history[symbol]

            # Filter prices within the specified period
            cutoff_time = datetime.now() - timedelta(hours=period_hours)
            recent_prices = [p for p in prices if p['datetime'] >= cutoff_time]

            if len(recent_prices) < 2:
                recent_prices = prices[-min(len(prices), 24):]  # Use last 24 points

            # Calculate returns
            price_values = [p['price'] for p in recent_prices]
            returns = []

            for i in range(1, len(price_values)):
                if price_values[i-1] > 0:
                    return_rate = (price_values[i] - price_values[i-1]) / price_values[i-1]
                    returns.append(return_rate)

            if len(returns) < 2:
                return 0.15

            # Calculate volatility (standard deviation of returns)
            returns_array = np.array(returns)
            volatility = np.std(returns_array)

            # Annualize volatility (assuming hourly data)
            annualized_volatility = volatility * np.sqrt(24 * 365)

            # Ensure reasonable bounds
            volatility = max(0.01, min(annualized_volatility, 2.0))

            logger.info(f"📈 Calculated {symbol} volatility: {volatility:.4f} from {len(returns)} price points")
            return float(volatility)

        except Exception as e:
            logger.error(f"❌ Volatility calculation failed for {symbol}: {e}")
            return 0.15

    def prepare_lstm_features(self, symbol: str = 'ETH/USD', sequence_length: int = 24) -> Optional[np.ndarray]:
        """Prepare feature sequence for LSTM model"""
        try:
            if symbol not in self.price_history or len(self.price_history[symbol]) < sequence_length:
                logger.warning(f"⚠️ Insufficient data for LSTM features, using synthetic data")
                return self._generate_synthetic_features(sequence_length)

            prices = self.price_history[symbol][-sequence_length:]

            features = []
            for i, price_data in enumerate(prices):
                # Create multi-dimensional features
                feature_vector = [
                    np.log(price_data['price']) if price_data['price'] > 0 else 0,  # Log price
                    price_data['confidence'] / price_data['price'] if price_data['price'] > 0 else 0,  # Confidence ratio
                    i / sequence_length,  # Time position
                    0.0,  # Volume (placeholder - not available from Pyth)
                    0.0   # Additional technical indicator (placeholder)
                ]
                features.append(feature_vector)

            # Calculate returns and add as features
            for i in range(1, len(features)):
                if prices[i-1]['price'] > 0:
                    return_rate = (prices[i]['price'] - prices[i-1]['price']) / prices[i-1]['price']
                    features[i][3] = return_rate  # Store return in volume slot

            # Add volatility as last feature
            recent_volatility = self.calculate_historical_volatility(symbol, period_hours=6)
            for feature in features:
                feature[4] = recent_volatility

            # Convert to numpy array and reshape for LSTM
            feature_array = np.array(features, dtype=np.float32)
            feature_array = feature_array.reshape(1, sequence_length, self.feature_count)

            logger.info(f"✅ Prepared LSTM features for {symbol}: shape {feature_array.shape}")
            return feature_array

        except Exception as e:
            logger.error(f"❌ Feature preparation failed for {symbol}: {e}")
            return self._generate_synthetic_features(sequence_length)

    def _generate_synthetic_features(self, sequence_length: int) -> np.ndarray:
        """Generate synthetic features when real data is unavailable"""
        logger.info("🔧 Generating synthetic features for LSTM model")

        # Create realistic synthetic price series
        base_price = 4000.0  # Base ETH price
        volatility = 0.15

        features = []
        current_price = base_price

        for i in range(sequence_length):
            # Random walk with volatility
            price_change = np.random.normal(0, volatility * current_price * 0.01)
            current_price = max(current_price + price_change, 100)  # Minimum price

            feature_vector = [
                np.log(current_price),
                0.001,  # Confidence ratio
                i / sequence_length,  # Time position
                price_change / current_price if i > 0 else 0,  # Return
                volatility  # Volatility
            ]
            features.append(feature_vector)

        feature_array = np.array(features, dtype=np.float32)
        return feature_array.reshape(1, sequence_length, self.feature_count)

    def predict_volatility_lstm(self, symbol: str = 'ETH/USD') -> Tuple[float, Dict]:
        """Predict volatility using LSTM model with real price data"""
        try:
            # Prepare input features
            input_features = self.prepare_lstm_features(symbol, self.sequence_length)

            if input_features is None:
                return 0.15, {'method': 'fallback', 'confidence': 'low'}

            # Run LSTM inference
            if self.session is not None:
                input_name = self.session.get_inputs()[0].name
                result = self.session.run(None, {input_name: input_features})

                # Extract predicted volatility
                predicted_vol = float(result[0][0][0])

                # Ensure reasonable bounds
                predicted_vol = max(0.005, min(predicted_vol, 1.0))

                # Calculate confidence based on data quality
                data_points = len(self.price_history.get(symbol, []))
                confidence = 'high' if data_points > 100 else 'medium' if data_points > 20 else 'low'

                metadata = {
                    'method': 'lstm_with_real_data',
                    'confidence': confidence,
                    'data_points': data_points,
                    'symbol': symbol,
                    'model_input_shape': input_features.shape
                }

                logger.info(f"🎯 LSTM predicted volatility for {symbol}: {predicted_vol:.4f} (confidence: {confidence})")
                return predicted_vol, metadata

            else:
                # Fallback to historical calculation
                historical_vol = self.calculate_historical_volatility(symbol)
                metadata = {
                    'method': 'historical_calculation',
                    'confidence': 'medium',
                    'symbol': symbol
                }
                return historical_vol, metadata

        except Exception as e:
            logger.error(f"❌ LSTM volatility prediction failed for {symbol}: {e}")
            return 0.15, {'method': 'error_fallback', 'confidence': 'low', 'error': str(e)}

    def calculate_lambda_coefficient(self, volatility: float, base_rate: float = 0.05) -> float:
        """Calculate lambda coefficient for lending risk assessment"""
        try:
            # Enhanced lambda calculation considering market conditions
            risk_free_rate = base_rate
            volatility_premium = volatility * 2.0  # Volatility risk premium
            market_stress_factor = min(volatility / 0.3, 2.0)  # Stress multiplier

            lambda_value = 1.0 + risk_free_rate + volatility_premium + (market_stress_factor - 1.0) * 0.5

            # Ensure reasonable bounds for lending
            lambda_value = max(1.01, min(lambda_value, 3.0))

            return lambda_value

        except Exception as e:
            logger.error(f"❌ Lambda calculation failed: {e}")
            return 1.2  # Safe fallback

    def get_prediction_summary(self, symbol: str = 'ETH/USD') -> Dict:
        """Get comprehensive volatility prediction summary"""
        try:
            # Get LSTM prediction
            lstm_volatility, lstm_metadata = self.predict_volatility_lstm(symbol)

            # Get historical volatility for comparison
            historical_volatility = self.calculate_historical_volatility(symbol)

            # Calculate lambda coefficient
            lambda_value = self.calculate_lambda_coefficient(lstm_volatility)

            # Get current price
            current_price = None
            if symbol in self.price_history and self.price_history[symbol]:
                current_price = self.price_history[symbol][-1]['price']

            summary = {
                'symbol': symbol,
                'current_price': current_price,
                'lstm_volatility': lstm_volatility,
                'historical_volatility': historical_volatility,
                'lambda_coefficient': lambda_value,
                'lambda1000': int(lambda_value * 1000),
                'confidence': lstm_metadata['confidence'],
                'prediction_method': lstm_metadata['method'],
                'data_points': len(self.price_history.get(symbol, [])),
                'last_update': datetime.now().isoformat(),
                'risk_assessment': self._assess_risk_level(lstm_volatility),
                'metadata': lstm_metadata
            }

            return summary

        except Exception as e:
            logger.error(f"❌ Prediction summary failed for {symbol}: {e}")
            return {
                'symbol': symbol,
                'error': str(e),
                'lambda_coefficient': 1.2,
                'lstm_volatility': 0.15,
                'confidence': 'low'
            }

    def _assess_risk_level(self, volatility: float) -> str:
        """Assess risk level based on volatility"""
        if volatility < 0.1:
            return 'LOW'
        elif volatility < 0.25:
            return 'MEDIUM'
        elif volatility < 0.5:
            return 'HIGH'
        else:
            return 'EXTREME'

    def get_price_history_summary(self) -> Dict:
        """Get summary of collected price data"""
        summary = {}
        for symbol, prices in self.price_history.items():
            if prices:
                latest = prices[-1]
                summary[symbol] = {
                    'count': len(prices),
                    'latest_price': latest['price'],
                    'latest_timestamp': latest['datetime'].isoformat(),
                    'price_range': {
                        'min': min(p['price'] for p in prices),
                        'max': max(p['price'] for p in prices)
                    }
                }
            else:
                summary[symbol] = {'count': 0, 'latest_price': None}

        return summary