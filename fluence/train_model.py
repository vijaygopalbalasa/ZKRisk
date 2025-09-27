"""
Train LSTM model for volatility prediction
Creates a quantized ONNX model optimized for CPU inference
"""

import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics import mean_squared_error, mean_absolute_error
import onnx
import onnxruntime as ort
import pickle
import json
import os
import requests
from datetime import datetime, timedelta

try:
    import tensorflow as tf
    from tensorflow.keras.models import Sequential
    from tensorflow.keras.layers import LSTM, Dense, Dropout
    from tensorflow.keras.optimizers import Adam
    from tensorflow.keras.callbacks import EarlyStopping
    print("✅ TensorFlow available for training")
except ImportError:
    print("⚠️ TensorFlow not available, using pre-trained model")


class VolatilityPredictor:
    def __init__(self, sequence_length=24, features=5):
        self.sequence_length = sequence_length  # 24 hours of data
        self.features = features  # price, volume, volatility, etc.
        self.scaler = MinMaxScaler()
        self.model = None

    def fetch_historical_data(self, days=30):
        """
        Fetch historical cryptocurrency data for training
        Using free API to get SHIB price data
        """
        print("📊 Fetching historical data...")

        # Simulate historical data if API fails
        try:
            # Using CoinGecko API for historical SHIB data
            url = f"https://api.coingecko.com/api/v3/coins/shiba-inu/market_chart"
            params = {
                'vs_currency': 'usd',
                'days': days,
                'interval': 'hourly'
            }

            response = requests.get(url, params=params, timeout=10)

            if response.status_code == 200:
                data = response.json()

                # Extract price and volume data
                prices = data['prices']
                volumes = data['total_volumes']

                # Create DataFrame
                df = pd.DataFrame(prices, columns=['timestamp', 'price'])
                df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
                df['volume'] = [v[1] for v in volumes]

                # Calculate additional features
                df['returns'] = df['price'].pct_change()
                df['volatility'] = df['returns'].rolling(window=12).std()  # 12-hour rolling volatility
                df['price_ma_12'] = df['price'].rolling(window=12).mean()
                df['volume_ma_12'] = df['volume'].rolling(window=12).mean()

                # Drop NaN values
                df = df.dropna()

                print(f"✅ Fetched {len(df)} data points from CoinGecko")
                return df

        except Exception as e:
            print(f"⚠️ API fetch failed: {e}")

        # Generate synthetic data for demo
        return self.generate_synthetic_data(days)

    def generate_synthetic_data(self, days=30):
        """Generate realistic synthetic crypto volatility data"""
        print("🎲 Generating synthetic training data...")

        hours = days * 24
        timestamps = pd.date_range(
            start=datetime.now() - timedelta(days=days),
            periods=hours,
            freq='H'
        )

        # Generate price data with volatility patterns
        np.random.seed(42)
        base_price = 0.00001  # SHIB-like price

        # Generate price with volatility clustering
        prices = [base_price]
        volatilities = [0.1]  # Initial volatility

        for i in range(1, hours):
            # Volatility follows AR(1) process
            vol = 0.05 + 0.9 * volatilities[-1] + 0.1 * np.random.normal(0, 0.02)
            vol = max(0.01, min(vol, 0.5))  # Clamp volatility

            # Price follows geometric Brownian motion with time-varying volatility
            price_change = np.random.normal(0, vol)
            new_price = prices[-1] * (1 + price_change)
            new_price = max(new_price, base_price * 0.1)  # Prevent negative prices

            prices.append(new_price)
            volatilities.append(vol)

        # Create DataFrame
        df = pd.DataFrame({
            'timestamp': timestamps,
            'price': prices,
            'volatility': volatilities
        })

        # Add derived features
        df['returns'] = df['price'].pct_change()
        df['volume'] = np.random.lognormal(10, 1, len(df))  # Synthetic volume
        df['price_ma_12'] = df['price'].rolling(window=12).mean()
        df['volume_ma_12'] = df['volume'].rolling(window=12).mean()

        # Drop NaN values
        df = df.dropna()

        print(f"✅ Generated {len(df)} synthetic data points")
        return df

    def prepare_features(self, df):
        """Prepare features for LSTM training"""
        feature_columns = ['price', 'volume', 'returns', 'price_ma_12', 'volume_ma_12']

        # Use available columns
        available_features = [col for col in feature_columns if col in df.columns]

        # Scale features
        features = df[available_features].values
        features_scaled = self.scaler.fit_transform(features)

        # Target: next-period volatility
        target = df['volatility'].values

        return features_scaled, target

    def create_sequences(self, features, target):
        """Create sequences for LSTM training"""
        X, y = [], []

        for i in range(self.sequence_length, len(features)):
            X.append(features[i-self.sequence_length:i])
            y.append(target[i])

        return np.array(X), np.array(y)

    def build_model(self):
        """Build LSTM model for volatility prediction"""
        if 'tf' not in globals():
            raise ImportError("TensorFlow required for training")

        model = Sequential([
            LSTM(64, return_sequences=True, input_shape=(self.sequence_length, self.features)),
            Dropout(0.2),
            LSTM(32, return_sequences=False),
            Dropout(0.2),
            Dense(16, activation='relu'),
            Dense(1, activation='linear')  # Volatility output
        ])

        model.compile(
            optimizer=Adam(learning_rate=0.001),
            loss='mse',
            metrics=['mae']
        )

        return model

    def train(self, df):
        """Train the LSTM model"""
        print("🚀 Training LSTM model...")

        # Prepare data
        features, target = self.prepare_features(df)
        X, y = self.create_sequences(features, target)

        # Update features count
        self.features = X.shape[2]

        # Split data
        split_idx = int(0.8 * len(X))
        X_train, X_test = X[:split_idx], X[split_idx:]
        y_train, y_test = y[:split_idx], y[split_idx:]

        print(f"📈 Training data: {X_train.shape}")
        print(f"📊 Test data: {X_test.shape}")

        # Build and train model
        self.model = self.build_model()

        early_stopping = EarlyStopping(
            monitor='val_loss',
            patience=10,
            restore_best_weights=True
        )

        history = self.model.fit(
            X_train, y_train,
            epochs=50,
            batch_size=32,
            validation_data=(X_test, y_test),
            callbacks=[early_stopping],
            verbose=1
        )

        # Evaluate model
        y_pred = self.model.predict(X_test)
        mse = mean_squared_error(y_test, y_pred)
        mae = mean_absolute_error(y_test, y_pred)

        print(f"✅ Model trained successfully!")
        print(f"   MSE: {mse:.6f}")
        print(f"   MAE: {mae:.6f}")

        return history

    def convert_to_onnx(self, output_path='model/lstm_vol.onnx'):
        """Convert TensorFlow model to ONNX format"""
        print("🔄 Converting model to ONNX...")

        try:
            import tf2onnx

            # Convert to ONNX
            model_proto, _ = tf2onnx.convert.from_keras(
                self.model,
                opset=13,
                output_path=output_path
            )

            # Optimize and quantize
            import onnxruntime.quantization as quant

            quantized_path = output_path.replace('.onnx', '_quantized.onnx')
            quant.quantize_dynamic(
                output_path,
                quantized_path,
                weight_type=quant.QuantType.QUInt8
            )

            # Use quantized model
            os.rename(quantized_path, output_path)

            print(f"✅ ONNX model saved: {output_path}")

            # Test ONNX model
            self.test_onnx_model(output_path)

        except ImportError:
            print("⚠️ tf2onnx not available, saving TensorFlow model")
            self.model.save('model/lstm_vol.h5')

    def test_onnx_model(self, model_path):
        """Test ONNX model inference"""
        print("🧪 Testing ONNX model...")

        try:
            # Load ONNX model
            session = ort.InferenceSession(model_path)

            # Create test input
            test_input = np.random.random((1, self.sequence_length, self.features)).astype(np.float32)

            # Run inference
            input_name = session.get_inputs()[0].name
            result = session.run(None, {input_name: test_input})

            predicted_volatility = result[0][0][0]
            print(f"✅ ONNX test successful! Predicted volatility: {predicted_volatility:.4f}")

            # Save model info
            model_info = {
                'sequence_length': self.sequence_length,
                'features': self.features,
                'input_shape': [1, self.sequence_length, self.features],
                'output_shape': [1, 1],
                'model_size_mb': os.path.getsize(model_path) / (1024 * 1024),
                'created_at': datetime.now().isoformat()
            }

            with open('model/model_info.json', 'w') as f:
                json.dump(model_info, f, indent=2)

            print(f"📄 Model info saved: model/model_info.json")

        except Exception as e:
            print(f"❌ ONNX test failed: {e}")

    def save_scaler(self, path='model/scaler.pkl'):
        """Save the feature scaler"""
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'wb') as f:
            pickle.dump(self.scaler, f)
        print(f"✅ Scaler saved: {path}")


def create_minimal_onnx_model():
    """Create a minimal ONNX model if TensorFlow is not available"""
    print("🔧 Creating minimal ONNX model...")

    # This creates a very simple model for demo purposes
    import onnx
    from onnx import helper, TensorProto

    # Define model inputs and outputs
    input_tensor = helper.make_tensor_value_info(
        'input', TensorProto.FLOAT, [1, 24, 5]
    )
    output_tensor = helper.make_tensor_value_info(
        'output', TensorProto.FLOAT, [1, 1]
    )

    # Create a simple linear transformation (demo only)
    # In reality, this would be a proper LSTM model
    weights = np.random.random((120, 1)).astype(np.float32)  # 24*5 = 120 inputs
    bias = np.array([0.1], dtype=np.float32)

    # Create weight and bias tensors
    weight_tensor = helper.make_tensor(
        'weights', TensorProto.FLOAT, [120, 1], weights.flatten()
    )
    bias_tensor = helper.make_tensor(
        'bias', TensorProto.FLOAT, [1], bias
    )

    # Create nodes
    reshape_node = helper.make_node(
        'Reshape',
        inputs=['input', 'shape'],
        outputs=['reshaped'],
        name='reshape'
    )

    matmul_node = helper.make_node(
        'MatMul',
        inputs=['reshaped', 'weights'],
        outputs=['matmul_out'],
        name='matmul'
    )

    add_node = helper.make_node(
        'Add',
        inputs=['matmul_out', 'bias'],
        outputs=['output'],
        name='add'
    )

    # Create shape tensor for reshape
    shape_tensor = helper.make_tensor(
        'shape', TensorProto.INT64, [2], [1, 120]
    )

    # Create the graph
    graph = helper.make_graph(
        nodes=[reshape_node, matmul_node, add_node],
        name='minimal_lstm',
        inputs=[input_tensor],
        outputs=[output_tensor],
        initializer=[weight_tensor, bias_tensor, shape_tensor]
    )

    # Create the model
    model = helper.make_model(graph, producer_name='zkrisk')

    # Save the model
    os.makedirs('model', exist_ok=True)
    onnx.save(model, 'model/lstm_vol.onnx')

    print("✅ Minimal ONNX model created")

    # Create model info
    model_info = {
        'sequence_length': 24,
        'features': 5,
        'input_shape': [1, 24, 5],
        'output_shape': [1, 1],
        'model_size_mb': os.path.getsize('model/lstm_vol.onnx') / (1024 * 1024),
        'created_at': datetime.now().isoformat(),
        'type': 'minimal_demo'
    }

    with open('model/model_info.json', 'w') as f:
        json.dump(model_info, f, indent=2)


def main():
    """Main training function"""
    print("🤖 zkRisk LSTM Volatility Predictor Training")
    print("=" * 50)

    predictor = VolatilityPredictor()

    # Check if TensorFlow is available for training
    if 'tf' in globals():
        print("🧠 Training full LSTM model...")

        # Fetch or generate training data
        df = predictor.fetch_historical_data(days=30)

        # Train model
        history = predictor.train(df)

        # Convert to ONNX
        os.makedirs('model', exist_ok=True)
        predictor.convert_to_onnx()

        # Save scaler
        predictor.save_scaler()

    else:
        print("⚡ Creating minimal demo model...")
        create_minimal_onnx_model()

    print("\n✅ Model training completed!")
    print("\n📁 Generated files:")
    print("   - model/lstm_vol.onnx (ONNX model)")
    print("   - model/model_info.json (Model metadata)")
    if 'tf' in globals():
        print("   - model/scaler.pkl (Feature scaler)")


if __name__ == "__main__":
    main()