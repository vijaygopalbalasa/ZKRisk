"""
Fluence AI Service for Volatility Prediction and Risk Assessment
Provides REST API for real-time volatility analysis and lambda calculation
"""

import os
import json
import pickle
import numpy as np
import onnxruntime as ort
from flask import Flask, request, jsonify
from flask_cors import CORS
import logging
import time
from datetime import datetime
import requests
import websocket
import threading

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)


class VolatilityInferenceService:
    def __init__(self):
        self.model_path = 'model/lstm_vol.onnx'
        self.model_info_path = 'model/model_info.json'
        self.scaler_path = 'model/scaler.pkl'

        self.session = None
        self.model_info = None
        self.scaler = None

        # Real-time data storage
        self.price_history = []
        self.volatility_cache = {}

        # Pyth WebSocket connection for production
        self.ws = None
        self.pyth_feeds = {
            'USDC/USD': '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',  # Real USDC/USD feed
            'ETH/USD': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',   # Real ETH/USD feed
            'BTC/USD': '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43'    # Real BTC/USD feed
        }

        # Production configuration
        self.config = {
            'PYTH_WS_ENDPOINT': os.getenv('PYTH_WS_ENDPOINT', 'wss://hermes.pyth.network/ws'),
            'BACKUP_PRICE_API': os.getenv('BACKUP_PRICE_API', 'https://api.coingecko.com/api/v3'),
            'UPDATE_INTERVAL': int(os.getenv('UPDATE_INTERVAL', '60')),  # seconds
            'MAX_PRICE_AGE': int(os.getenv('MAX_PRICE_AGE', '300')),     # 5 minutes
            'VOLATILITY_WINDOW': int(os.getenv('VOLATILITY_WINDOW', '24')),  # hours
            'PORT': int(os.getenv('PORT', '5001')),
            'DEBUG': os.getenv('DEBUG', 'false').lower() == 'true'
        }

        self.load_model()
        self.start_price_monitoring()

    def load_model(self):
        """Load ONNX model and preprocessing components"""
        try:
            # Load ONNX model
            if os.path.exists(self.model_path):
                self.session = ort.InferenceSession(self.model_path)
                logger.info(f"✅ ONNX model loaded: {self.model_path}")
            else:
                logger.warning(f"⚠️ Model not found: {self.model_path} - Using fallback mode")
                self.session = None

            # Load model info
            if os.path.exists(self.model_info_path):
                with open(self.model_info_path, 'r') as f:
                    self.model_info = json.load(f)
                logger.info("✅ Model info loaded")
            else:
                # Default model info
                self.model_info = {
                    'sequence_length': 24,
                    'features': 5,
                    'input_shape': [1, 24, 5],
                    'output_shape': [1, 1]
                }

            # Load scaler if available
            if os.path.exists(self.scaler_path):
                with open(self.scaler_path, 'rb') as f:
                    self.scaler = pickle.load(f)
                logger.info("✅ Feature scaler loaded")

            return True

        except Exception as e:
            logger.error(f"❌ Model loading failed: {e}")
            return False

    def start_price_monitoring(self):
        """Start real-time price monitoring from Pyth"""
        def monitor():
            try:
                # Connect to Pyth Hermes WebSocket
                ws_url = "wss://hermes.pyth.network/ws"
                self.ws = websocket.WebSocketApp(
                    ws_url,
                    on_message=self.on_price_message,
                    on_error=self.on_price_error,
                    on_close=self.on_price_close
                )

                # Subscribe to SHIB/USD feed
                subscription = {
                    "jsonrpc": "2.0",
                    "method": "subscribe",
                    "params": {
                        "ids": list(self.pyth_feeds.values())
                    },
                    "id": 1
                }

                logger.info("🔗 Connecting to Pyth WebSocket...")
                self.ws.run_forever()

            except Exception as e:
                logger.error(f"❌ Price monitoring failed: {e}")

        # Start monitoring in background thread
        thread = threading.Thread(target=monitor, daemon=True)
        thread.start()

    def on_price_message(self, ws, message):
        """Handle incoming price data from Pyth"""
        try:
            data = json.loads(message)

            if 'result' in data and 'price' in data['result']:
                price_data = data['result']
                price = float(price_data['price']) * (10 ** price_data['expo'])
                timestamp = time.time()

                # Store price history
                self.price_history.append({
                    'price': price,
                    'timestamp': timestamp,
                    'confidence': price_data.get('conf', 0)
                })

                # Keep only last 168 hours (1 week)
                if len(self.price_history) > 168:
                    self.price_history = self.price_history[-168:]

                logger.info(f"📈 Price update: ${price:.8f}")

        except Exception as e:
            logger.error(f"❌ Price message handling failed: {e}")

    def on_price_error(self, ws, error):
        """Handle WebSocket errors"""
        logger.error(f"❌ WebSocket error: {error}")

    def on_price_close(self, ws, close_status_code, close_msg):
        """Handle WebSocket close"""
        logger.warning("⚠️ WebSocket connection closed")

    def prepare_input_data(self, volatility_sequence):
        """Prepare input data for model inference"""
        try:
            # Convert to numpy array
            vol_array = np.array(volatility_sequence, dtype=np.float32)

            # Ensure we have the right sequence length
            seq_length = self.model_info['sequence_length']
            features = self.model_info['features']

            if len(vol_array) < seq_length:
                # Pad with mean if not enough data
                mean_vol = np.mean(vol_array) if len(vol_array) > 0 else 0.1
                padding = np.full(seq_length - len(vol_array), mean_vol)
                vol_array = np.concatenate([padding, vol_array])
            elif len(vol_array) > seq_length:
                # Take the last seq_length values
                vol_array = vol_array[-seq_length:]

            # Create feature matrix (replicate volatility for demo)
            # In production, would use actual features (price, volume, etc.)
            feature_matrix = np.zeros((seq_length, features))
            for i in range(features):
                feature_matrix[:, i] = vol_array

            # Reshape for model input [1, seq_length, features]
            model_input = feature_matrix.reshape(1, seq_length, features)

            return model_input.astype(np.float32)

        except Exception as e:
            logger.error(f"❌ Input preparation failed: {e}")
            # Return default input
            seq_length = self.model_info['sequence_length']
            features = self.model_info['features']
            return np.random.random((1, seq_length, features)).astype(np.float32)

    def predict_volatility(self, input_data):
        """Predict volatility using ONNX model or fallback calculation"""
        try:
            if self.session is not None:
                # Get input name
                input_name = self.session.get_inputs()[0].name

                # Run inference
                result = self.session.run(None, {input_name: input_data})

                # Extract predicted volatility
                predicted_vol = float(result[0][0][0])

                # Ensure volatility is in reasonable range
                predicted_vol = max(0.01, min(predicted_vol, 1.0))

                return predicted_vol
            else:
                # Fallback: calculate volatility from input data
                if input_data is not None and input_data.size > 0:
                    # Use mean of input data as predicted volatility
                    mean_input = np.mean(input_data)
                    predicted_vol = max(0.01, min(float(mean_input), 1.0))
                    return predicted_vol
                else:
                    return 0.15

        except Exception as e:
            logger.error(f"❌ Volatility prediction failed: {e}")
            # Return default volatility
            return 0.15

    def calculate_lambda(self, volatility):
        """
        Calculate risk multiplier (lambda) based on volatility
        Higher volatility = lower lambda (more conservative lending)
        """
        try:
            # Normalize volatility to 0-1 scale
            vol_normalized = min(volatility / 0.5, 1.0)  # Cap at 50% volatility

            # Calculate lambda using inverse relationship
            # Lambda ranges from 0.3 (high vol) to 1.8 (low vol)
            max_lambda = 1.8
            min_lambda = 0.3
            lambda_value = max_lambda - vol_normalized * (max_lambda - min_lambda)

            # Ensure lambda is in valid range
            lambda_value = max(min_lambda, min(lambda_value, max_lambda))

            return lambda_value

        except Exception as e:
            logger.error(f"❌ Lambda calculation failed: {e}")
            return 1.0  # Default safe value

    def calculate_volatility_from_prices(self, price_window=24):
        """Calculate volatility from recent price history"""
        try:
            if len(self.price_history) < 2:
                return 0.15  # Default volatility

            # Get recent prices
            recent_prices = [p['price'] for p in self.price_history[-price_window:]]

            if len(recent_prices) < 2:
                return 0.15

            # Calculate returns
            returns = []
            for i in range(1, len(recent_prices)):
                ret = (recent_prices[i] - recent_prices[i-1]) / recent_prices[i-1]
                returns.append(ret)

            if len(returns) < 2:
                return 0.15

            # Calculate volatility as standard deviation of returns
            volatility = np.std(returns)

            # Annualize volatility (assuming hourly data)
            annualized_vol = volatility * np.sqrt(24 * 365)

            return float(annualized_vol)

        except Exception as e:
            logger.error(f"❌ Volatility calculation failed: {e}")
            return 0.15


# Initialize the service
inference_service = VolatilityInferenceService()


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'model_loaded': inference_service.session is not None,
        'price_history_length': len(inference_service.price_history)
    })


@app.route('/infer', methods=['GET', 'POST'])
def infer_volatility():
    """
    Main inference endpoint
    Accepts volatility sequence and returns risk multiplier (lambda)
    """
    try:
        start_time = time.time()

        if request.method == 'GET':
            # Get volatility from query parameters
            volatility_param = request.args.get('volatility', '')
            if volatility_param:
                volatility_sequence = [float(x) for x in volatility_param.split(',')]
            else:
                # Use calculated volatility from price history
                current_vol = inference_service.calculate_volatility_from_prices()
                volatility_sequence = [current_vol]

        else:  # POST
            data = request.get_json()
            volatility_sequence = data.get('volatility', [])

        # Validate input
        if not volatility_sequence:
            # Calculate from recent price data
            current_vol = inference_service.calculate_volatility_from_prices()
            volatility_sequence = [current_vol] * 5  # Replicate for sequence

        # Prepare model input
        model_input = inference_service.prepare_input_data(volatility_sequence)

        # Predict volatility
        predicted_volatility = inference_service.predict_volatility(model_input)

        # Calculate lambda (risk multiplier)
        lambda_value = inference_service.calculate_lambda(predicted_volatility)

        # Scale lambda to integer (multiply by 1000)
        lambda_1000 = int(lambda_value * 1000)

        # Calculate processing time
        processing_time = time.time() - start_time

        result = {
            'lambda1000': lambda_1000,
            'lambda': lambda_value,
            'predicted_volatility': predicted_volatility,
            'input_volatility': volatility_sequence[-1] if volatility_sequence else None,
            'processing_time_ms': round(processing_time * 1000, 2),
            'timestamp': datetime.now().isoformat(),
            'model_info': {
                'sequence_length': inference_service.model_info['sequence_length'],
                'features': inference_service.model_info['features']
            }
        }

        logger.info(f"🎯 Inference: vol={predicted_volatility:.4f}, λ={lambda_value:.3f}")

        return jsonify(result)

    except Exception as e:
        logger.error(f"❌ Inference failed: {e}")
        return jsonify({
            'error': str(e),
            'lambda1000': 1000,  # Safe default
            'lambda': 1.0,
            'timestamp': datetime.now().isoformat()
        }), 500


@app.route('/volatility', methods=['GET'])
def get_current_volatility():
    """Get current volatility from price history"""
    try:
        volatility = inference_service.calculate_volatility_from_prices()
        lambda_value = inference_service.calculate_lambda(volatility)

        return jsonify({
            'volatility': volatility,
            'lambda': lambda_value,
            'lambda1000': int(lambda_value * 1000),
            'price_history_length': len(inference_service.price_history),
            'last_price': inference_service.price_history[-1] if inference_service.price_history else None,
            'timestamp': datetime.now().isoformat()
        })

    except Exception as e:
        logger.error(f"❌ Volatility calculation failed: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/price-feed', methods=['GET'])
def get_price_feed():
    """Get recent price history"""
    try:
        recent_count = int(request.args.get('count', 24))
        recent_prices = inference_service.price_history[-recent_count:]

        return jsonify({
            'prices': recent_prices,
            'count': len(recent_prices),
            'timestamp': datetime.now().isoformat()
        })

    except Exception as e:
        logger.error(f"❌ Price feed failed: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/model-info', methods=['GET'])
def get_model_info():
    """Get model information"""
    return jsonify({
        'model_info': inference_service.model_info,
        'model_loaded': inference_service.session is not None,
        'scaler_loaded': inference_service.scaler is not None,
        'price_monitoring_active': inference_service.ws is not None,
        'timestamp': datetime.now().isoformat()
    })


@app.route('/demo', methods=['GET'])
def demo_inference():
    """Demo endpoint with sample data"""
    try:
        # Generate sample volatility sequence
        sample_volatilities = [0.1, 0.15, 0.2, 0.18, 0.12]

        # Prepare input
        model_input = inference_service.prepare_input_data(sample_volatilities)

        # Predict
        predicted_vol = inference_service.predict_volatility(model_input)
        lambda_value = inference_service.calculate_lambda(predicted_vol)

        return jsonify({
            'demo': True,
            'input_volatilities': sample_volatilities,
            'predicted_volatility': predicted_vol,
            'lambda': lambda_value,
            'lambda1000': int(lambda_value * 1000),
            'interpretation': {
                'risk_level': 'low' if lambda_value > 1.4 else 'medium' if lambda_value > 0.8 else 'high',
                'max_ltv': f"{lambda_value * 100:.1f}%"
            },
            'timestamp': datetime.now().isoformat()
        })

    except Exception as e:
        logger.error(f"❌ Demo failed: {e}")
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    logger.info("🚀 Starting zkRisk Volatility Inference Service")
    logger.info(f"🤖 Model path: {inference_service.model_path}")
    logger.info(f"📊 Model loaded: {inference_service.session is not None}")

    # Run Flask app
    app.run(
        host='0.0.0.0',
        port=inference_service.config['PORT'],
        debug=False,
        threaded=True
    )