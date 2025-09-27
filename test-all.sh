#!/bin/bash

# zkRisk-Agent Complete Testing Script
# Usage: ./test-all.sh

set -e  # Exit on any error

echo "🚀 zkRisk-Agent Complete Testing Script"
echo "======================================="
echo ""

# Check if we're in the right directory
if [ ! -f "README.md" ] || [ ! -d "contracts" ] || [ ! -d "frontend" ] || [ ! -d "fluence" ]; then
    echo "❌ Error: Please run this script from the zkRisk-Agent root directory"
    echo "   Expected structure: contracts/, frontend/, fluence/, README.md"
    exit 1
fi

echo "📁 Directory structure verified ✅"

# Test 1: Prerequisites Check
echo ""
echo "1️⃣ Checking Prerequisites..."
echo "----------------------------------------"

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "✅ Node.js: $NODE_VERSION"
else
    echo "❌ Node.js not found. Please install Node.js v18+"
    exit 1
fi

# Check Python
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    echo "✅ Python: $PYTHON_VERSION"
else
    echo "❌ Python3 not found. Please install Python 3.9+"
    exit 1
fi

# Check npm packages
echo ""
echo "2️⃣ Checking Dependencies..."
echo "----------------------------------------"

# Check contracts dependencies
if [ -d "contracts/node_modules" ]; then
    echo "✅ Contracts dependencies installed"
else
    echo "⚠️  Installing contracts dependencies..."
    cd contracts && npm install && cd ..
    echo "✅ Contracts dependencies installed"
fi

# Check frontend dependencies
if [ -d "frontend/node_modules" ]; then
    echo "✅ Frontend dependencies installed"
else
    echo "⚠️  Installing frontend dependencies..."
    cd frontend && npm install && cd ..
    echo "✅ Frontend dependencies installed"
fi

# Check Python dependencies
if python3 -c "import flask, numpy, onnxruntime" 2>/dev/null; then
    echo "✅ Python dependencies available"
else
    echo "⚠️  Installing Python dependencies..."
    cd fluence && pip3 install -r requirements.txt && cd ..
    echo "✅ Python dependencies installed"
fi

# Test 3: Contract Compilation
echo ""
echo "3️⃣ Testing Smart Contracts..."
echo "----------------------------------------"

cd contracts
COMPILE_OUTPUT=$(npm run compile 2>&1)
if echo "$COMPILE_OUTPUT" | grep -q "compiled\|Nothing to compile"; then
    echo "✅ Smart contracts compile successfully"
else
    echo "❌ Contract compilation failed:"
    echo "$COMPILE_OUTPUT"
    exit 1
fi
cd ..

# Test 4: Frontend Build
echo ""
echo "4️⃣ Testing Frontend Build..."
echo "----------------------------------------"

cd frontend
BUILD_OUTPUT=$(npm run build 2>&1)
if echo "$BUILD_OUTPUT" | grep -q "built in"; then
    echo "✅ Frontend builds successfully"
    BUILD_TIME=$(echo "$BUILD_OUTPUT" | grep "built in" | head -1)
    echo "   $BUILD_TIME"
else
    echo "❌ Frontend build failed:"
    echo "$BUILD_OUTPUT"
    exit 1
fi
cd ..

# Test 5: AI Service
echo ""
echo "5️⃣ Testing AI Service..."
echo "----------------------------------------"

cd fluence

# Start AI service in background
echo "🤖 Starting AI service..."
python3 infer.py > /tmp/zkrisk-ai-test.log 2>&1 &
AI_PID=$!

# Wait for service to start
sleep 5

# Test health endpoint
if curl -s http://localhost:5001/health | grep -q "healthy"; then
    echo "✅ AI service health check passed"
else
    echo "❌ AI service health check failed"
    kill $AI_PID 2>/dev/null
    echo "Error log:"
    cat /tmp/zkrisk-ai-test.log
    exit 1
fi

# Test demo endpoint
if curl -s http://localhost:5001/demo | grep -q "lambda"; then
    echo "✅ AI service demo endpoint working"
else
    echo "❌ AI service demo endpoint failed"
    kill $AI_PID 2>/dev/null
    exit 1
fi

# Test inference endpoint
INFER_RESULT=$(curl -s "http://localhost:5001/infer?volatility=0.2")
if echo "$INFER_RESULT" | grep -q "lambda"; then
    LAMBDA=$(echo "$INFER_RESULT" | python3 -c "import sys, json; print(json.load(sys.stdin)['lambda'])" 2>/dev/null || echo "unknown")
    echo "✅ AI service inference working (λ=$LAMBDA)"
else
    echo "❌ AI service inference failed"
    kill $AI_PID 2>/dev/null
    exit 1
fi

# Stop AI service
kill $AI_PID 2>/dev/null
cd ..

# Test 6: Frontend Dev Server (Quick Test)
echo ""
echo "6️⃣ Testing Frontend Dev Server..."
echo "----------------------------------------"

cd frontend
echo "🌐 Starting frontend dev server..."
timeout 10s npm run dev > /tmp/zkrisk-frontend-test.log 2>&1 &
FRONTEND_PID=$!

# Wait for server to start
sleep 6

# Test if server is responding
if curl -s http://localhost:5173/ | grep -q "zkRisk-Agent"; then
    echo "✅ Frontend dev server working"
    echo "   Available at: http://localhost:5173/"
else
    echo "❌ Frontend dev server test failed"
    echo "Error log:"
    cat /tmp/zkrisk-frontend-test.log
    exit 1
fi

# Stop frontend server
kill $FRONTEND_PID 2>/dev/null || true
cd ..

# Test Summary
echo ""
echo "🎉 ALL TESTS PASSED!"
echo "======================================="
echo "✅ Smart contracts compile successfully"
echo "✅ Frontend builds and runs"
echo "✅ AI service provides predictions"
echo "✅ All dependencies installed"
echo ""
echo "🚀 Ready for demo! Next steps:"
echo "1. Start AI service:    cd fluence && python3 infer.py"
echo "2. Start frontend:      cd frontend && npm run dev"
echo "3. Open browser:        http://localhost:5173/"
echo "4. Connect MetaMask to: Polygon Amoy (Chain ID: 80002)"
echo ""
echo "📋 Contract Addresses (Polygon Amoy):"
echo "   Loan:     0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9"
echo "   Oracle:   0x5FbDB2315678afecb367f032d93F642f64180aa3"
echo "   X402:     0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"
echo "   USDC:     0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582"
echo ""
echo "💡 Tip: Use 'curl http://localhost:5001/demo' to test AI predictions"
echo "💡 Tip: Get test USDC from https://faucet.circle.com/"
echo ""
echo "🏆 zkRisk-Agent is ready for hackathon judging!"