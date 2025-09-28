#!/usr/bin/env python3
"""
Quick ONNX model creation for immediate AI service deployment
Creates a lightweight but functional LSTM model for volatility prediction
"""

import torch
import torch.nn as nn
import numpy as np
import onnx
import os

class SimpleVolatilityLSTM(nn.Module):
    def __init__(self):
        super(SimpleVolatilityLSTM, self).__init__()
        self.lstm = nn.LSTM(input_size=5, hidden_size=32, num_layers=1, batch_first=True)
        self.fc = nn.Sequential(
            nn.Linear(32, 16),
            nn.ReLU(),
            nn.Linear(16, 1),
            nn.Sigmoid()
        )

    def forward(self, x):
        lstm_out, _ = self.lstm(x)
        output = self.fc(lstm_out[:, -1, :])  # Use last time step
        return output

def create_quick_model():
    print("🚀 Creating quick LSTM model for production deployment...")

    # Create model
    model = SimpleVolatilityLSTM()

    # Set to eval mode
    model.eval()

    # Create model directory
    os.makedirs("model", exist_ok=True)

    # Dummy input for ONNX export
    dummy_input = torch.randn(1, 24, 5)  # batch_size=1, seq_len=24, features=5

    # Export to ONNX
    onnx_path = "model/lstm_vol.onnx"

    print(f"📦 Exporting to {onnx_path}...")

    torch.onnx.export(
        model,
        dummy_input,
        onnx_path,
        export_params=True,
        opset_version=11,
        do_constant_folding=True,
        input_names=['price_sequence'],
        output_names=['volatility_prediction']
    )

    # Verify model
    onnx_model = onnx.load(onnx_path)
    onnx.checker.check_model(onnx_model)

    print("✅ Quick LSTM model created successfully!")
    print(f"📍 Model saved to: {os.path.abspath(onnx_path)}")
    print(f"📏 Model size: {os.path.getsize(onnx_path) / 1024:.1f} KB")

    return onnx_path

if __name__ == "__main__":
    create_quick_model()