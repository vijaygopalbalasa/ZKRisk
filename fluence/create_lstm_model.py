#!/usr/bin/env python3
"""
Create production LSTM model for volatility prediction
Generates ONNX model for real-time volatility inference in zkRisk
"""

import torch
import torch.nn as nn
import numpy as np
import onnx
import os
from typing import Tuple

class VolatilityLSTM(nn.Module):
    """
    LSTM model for cryptocurrency volatility prediction
    Input: Historical price data (sequence_length, features)
    Output: Predicted volatility (single value)
    """

    def __init__(self, input_size: int = 5, hidden_size: int = 64, num_layers: int = 2, dropout: float = 0.2):
        super(VolatilityLSTM, self).__init__()

        self.hidden_size = hidden_size
        self.num_layers = num_layers

        # LSTM layers
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            dropout=dropout if num_layers > 1 else 0,
            batch_first=True
        )

        # Attention mechanism for better feature importance
        self.attention = nn.Sequential(
            nn.Linear(hidden_size, hidden_size),
            nn.Tanh(),
            nn.Linear(hidden_size, 1),
            nn.Softmax(dim=1)
        )

        # Fully connected layers
        self.fc_layers = nn.Sequential(
            nn.Linear(hidden_size, 32),
            nn.ReLU(),
            nn.Dropout(0.1),
            nn.Linear(32, 16),
            nn.ReLU(),
            nn.Linear(16, 1),
            nn.Sigmoid()  # Volatility is always positive, bounded between 0-1
        )

        # Initialize weights
        self._init_weights()

    def _init_weights(self):
        """Initialize weights using Xavier initialization"""
        for name, param in self.named_parameters():
            if 'weight_ih' in name:
                nn.init.xavier_uniform_(param.data)
            elif 'weight_hh' in name:
                nn.init.orthogonal_(param.data)
            elif 'bias' in name:
                param.data.fill_(0)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x shape: (batch_size, sequence_length, input_size)

        # LSTM forward pass
        lstm_out, (hidden, cell) = self.lstm(x)
        # lstm_out shape: (batch_size, sequence_length, hidden_size)

        # Apply attention mechanism
        attention_weights = self.attention(lstm_out)
        # attention_weights shape: (batch_size, sequence_length, 1)

        # Weighted sum using attention
        context_vector = torch.sum(lstm_out * attention_weights, dim=1)
        # context_vector shape: (batch_size, hidden_size)

        # Final prediction
        output = self.fc_layers(context_vector)
        # output shape: (batch_size, 1)

        return output

def generate_synthetic_training_data(num_samples: int = 10000, sequence_length: int = 24) -> Tuple[np.ndarray, np.ndarray]:
    """
    Generate synthetic training data for volatility prediction
    Simulates realistic cryptocurrency price patterns
    """
    print(f"🔢 Generating {num_samples} synthetic training samples...")

    X = []
    y = []

    for i in range(num_samples):
        # Generate base price trend
        base_price = np.random.uniform(1000, 50000)  # Random starting price
        trend = np.random.uniform(-0.02, 0.02)  # Daily trend

        # Generate price sequence with volatility patterns
        prices = []
        volumes = []
        returns = []

        for t in range(sequence_length + 1):
            # Add noise and volatility clustering
            if t == 0:
                price = base_price
                volume = np.random.uniform(1e6, 1e8)
            else:
                # Volatility clustering: high volatility follows high volatility
                vol_regime = np.random.choice([0.01, 0.03, 0.08], p=[0.7, 0.2, 0.1])
                noise = np.random.normal(0, vol_regime)
                price = prices[-1] * (1 + trend + noise)
                volume = volumes[-1] * np.random.uniform(0.5, 2.0)

            prices.append(price)
            volumes.append(volume)

            if t > 0:
                return_val = (price - prices[-2]) / prices[-2]
                returns.append(return_val)

        # Calculate features for the sequence
        features = []
        for t in range(sequence_length):
            # Feature engineering
            price = prices[t]
            volume = volumes[t]

            # Price-based features
            sma_5 = np.mean(prices[max(0, t-4):t+1])
            price_momentum = (price - sma_5) / sma_5 if sma_5 > 0 else 0

            # Volume features
            volume_norm = np.log(volume) / 20  # Normalized log volume

            # Volatility proxy
            if t >= 5:
                recent_returns = returns[max(0, t-4):t+1]
                vol_proxy = np.std(recent_returns) if len(recent_returns) > 1 else 0
            else:
                vol_proxy = 0

            # Technical indicators
            rsi = np.random.uniform(20, 80)  # Simplified RSI

            features.append([
                price_momentum,
                volume_norm,
                vol_proxy,
                rsi / 100,  # Normalized RSI
                np.sin(t * 2 * np.pi / 24)  # Time-of-day feature
            ])

        # Calculate target volatility (next period realized volatility)
        if len(returns) >= 5:
            future_vol = np.std(returns[-5:])
            # Normalize volatility to 0-1 range
            target_vol = min(future_vol * 10, 1.0)  # Scale and cap at 1.0
        else:
            target_vol = 0.1

        X.append(features)
        y.append([target_vol])

    return np.array(X, dtype=np.float32), np.array(y, dtype=np.float32)

def create_and_export_model():
    """Create, train, and export LSTM model to ONNX format"""

    print("🚀 Creating production LSTM volatility prediction model...")

    # Model hyperparameters
    input_size = 5  # price_momentum, volume, volatility_proxy, rsi, time_feature
    hidden_size = 64
    num_layers = 2
    sequence_length = 24  # 24 hours of data

    # Create model
    model = VolatilityLSTM(input_size=input_size, hidden_size=hidden_size, num_layers=num_layers)

    # Generate training data
    X_train, y_train = generate_synthetic_training_data(num_samples=10000, sequence_length=sequence_length)

    print(f"📊 Training data shape: X={X_train.shape}, y={y_train.shape}")

    # Convert to PyTorch tensors
    X_tensor = torch.FloatTensor(X_train)
    y_tensor = torch.FloatTensor(y_train)

    # Training setup
    criterion = nn.MSELoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=0.001, weight_decay=1e-5)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=10, factor=0.5)

    # Training loop
    model.train()
    print("🔥 Training model...")

    batch_size = 64
    num_epochs = 100

    for epoch in range(num_epochs):
        total_loss = 0
        num_batches = len(X_tensor) // batch_size

        for i in range(0, len(X_tensor), batch_size):
            # Get batch
            batch_X = X_tensor[i:i+batch_size]
            batch_y = y_tensor[i:i+batch_size]

            # Forward pass
            optimizer.zero_grad()
            outputs = model(batch_X)
            loss = criterion(outputs, batch_y)

            # Backward pass
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()

            total_loss += loss.item()

        avg_loss = total_loss / num_batches
        scheduler.step(avg_loss)

        if epoch % 20 == 0 or epoch == num_epochs - 1:
            print(f"Epoch {epoch+1}/{num_epochs}, Loss: {avg_loss:.6f}")

    print("✅ Training completed!")

    # Set model to evaluation mode
    model.eval()

    # Create dummy input for ONNX export
    dummy_input = torch.randn(1, sequence_length, input_size)

    # Test the model with dummy input
    with torch.no_grad():
        test_output = model(dummy_input)
        print(f"🧪 Test prediction: {test_output.item():.4f}")

    # Create model directory
    model_dir = "model"
    os.makedirs(model_dir, exist_ok=True)

    # Export to ONNX
    onnx_path = os.path.join(model_dir, "lstm_vol.onnx")

    print(f"📦 Exporting model to {onnx_path}...")

    torch.onnx.export(
        model,
        dummy_input,
        onnx_path,
        export_params=True,
        opset_version=11,
        do_constant_folding=True,
        input_names=['price_sequence'],
        output_names=['volatility_prediction'],
        dynamic_axes={
            'price_sequence': {0: 'batch_size'},
            'volatility_prediction': {0: 'batch_size'}
        },
        verbose=False
    )

    # Verify ONNX model
    print("🔍 Verifying ONNX model...")
    onnx_model = onnx.load(onnx_path)
    onnx.checker.check_model(onnx_model)

    print("✅ ONNX model verification successful!")

    # Create model metadata
    metadata = {
        "model_type": "LSTM Volatility Predictor",
        "input_size": input_size,
        "hidden_size": hidden_size,
        "num_layers": num_layers,
        "sequence_length": sequence_length,
        "features": [
            "price_momentum",
            "volume_normalized",
            "volatility_proxy",
            "rsi_normalized",
            "time_feature"
        ],
        "output": "predicted_volatility (0-1 range)",
        "training_samples": 10000,
        "model_version": "1.0.0",
        "created_for": "zkRisk-Agent Production"
    }

    # Save metadata
    import json
    metadata_path = os.path.join(model_dir, "model_metadata.json")
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)

    print(f"📝 Model metadata saved to {metadata_path}")
    print(f"📏 Model file size: {os.path.getsize(onnx_path) / 1024:.1f} KB")

    print("\n🎉 Production LSTM model created successfully!")
    print("🔧 The AI inference service will now load this model automatically.")
    print(f"📍 Model location: {os.path.abspath(onnx_path)}")

    return onnx_path

if __name__ == "__main__":
    create_and_export_model()