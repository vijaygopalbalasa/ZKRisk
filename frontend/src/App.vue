<template>
  <div class="min-h-screen bg-slate-900">
    <!-- Header -->
    <header class="border-b border-slate-700/50 backdrop-blur-xl bg-slate-900/80 sticky top-0 z-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <!-- Logo -->
          <div class="flex items-center space-x-4">
            <div class="flex items-center space-x-3">
              <div class="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h1 class="text-xl font-bold gradient-text">zkRisk</h1>
                <div class="text-xs text-slate-400 -mt-1">AI Lending Protocol</div>
              </div>
            </div>
          </div>

          <!-- Navigation & Wallet -->
          <div class="flex items-center space-x-4">
            <!-- Network Status -->
            <div class="hidden sm:flex items-center space-x-2 text-sm">
              <div :class="[
                'w-2 h-2 rounded-full',
                isCorrectNetwork ? 'bg-green-400' : 'bg-red-400'
              ]"></div>
              <span class="text-slate-300">{{ currentNetworkName || 'Not Connected' }}</span>
            </div>

            <!-- Wallet Connection -->
            <WalletConnect
              @wallet-connected="handleWalletConnected"
              @wallet-disconnected="handleWalletDisconnected"
              @network-changed="handleNetworkChanged"
            />
          </div>
        </div>
      </div>
    </header>

    <!-- Wrong Network Banner -->
    <div v-if="currentNetwork && !isCorrectNetwork"
         class="bg-gradient-to-r from-orange-500 to-red-500 text-white py-3">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span class="font-medium">Wrong Network</span>
            <span class="hidden sm:inline">Please switch to Polygon Amoy Testnet</span>
          </div>
          <button @click="switchToPolygonAmoy"
                  class="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg font-medium transition-colors">
            Switch Network
          </button>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Hero Section -->
      <div class="text-center mb-12">
        <h1 class="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
          <span class="gradient-text">AI-Powered</span><br>
          Lending Protocol
        </h1>
        <p class="text-xl text-slate-300 max-w-3xl mx-auto mb-8">
          Revolutionary under-collateralized loans powered by zero-knowledge proofs,
          AI risk assessment, and real-time oracle data. Get up to <span class="text-blue-400 font-bold">180% LTV</span>.
        </p>

        <!-- Status Dashboard -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-8">
          <!-- Wallet Status -->
          <div class="card">
            <div class="flex items-center space-x-3 mb-3">
              <div :class="[
                'w-10 h-10 rounded-lg flex items-center justify-center',
                isWalletConnected ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'
              ]">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div>
                <h3 class="font-semibold">Wallet</h3>
                <p :class="[
                  'text-sm',
                  isWalletConnected ? 'text-green-400' : 'text-slate-400'
                ]">
                  {{ isWalletConnected ? formatAddress(walletAddress) : 'Not Connected' }}
                </p>
              </div>
            </div>
            <div :class="[
              'badge w-full justify-center',
              isWalletConnected ? 'badge-success' : 'badge-error'
            ]">
              {{ isWalletConnected ? 'Connected' : 'Disconnected' }}
            </div>
          </div>

          <!-- Network Status -->
          <div class="card">
            <div class="flex items-center space-x-3 mb-3">
              <div :class="[
                'w-10 h-10 rounded-lg flex items-center justify-center',
                isCorrectNetwork ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-700 text-slate-400'
              ]">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9" />
                </svg>
              </div>
              <div>
                <h3 class="font-semibold">Network</h3>
                <p :class="[
                  'text-sm',
                  isCorrectNetwork ? 'text-blue-400' : 'text-slate-400'
                ]">
                  {{ currentNetworkName || 'Unknown' }}
                </p>
              </div>
            </div>
            <div :class="[
              'badge w-full justify-center',
              isCorrectNetwork ? 'badge-success' : currentNetwork ? 'badge-error' : 'badge-warning'
            ]">
              {{ isCorrectNetwork ? 'Polygon Amoy' : currentNetwork ? 'Wrong Network' : 'No Network' }}
            </div>
          </div>

          <!-- AI Service Status -->
          <div class="card">
            <div class="flex items-center space-x-3 mb-3">
              <div class="w-10 h-10 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <h3 class="font-semibold">AI Service</h3>
                <p class="text-sm text-purple-400">Real-time Risk</p>
              </div>
            </div>
            <div class="badge badge-success w-full justify-center">
              Active
            </div>
          </div>
        </div>
      </div>

      <!-- Feature Sections -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        <!-- AI Risk Assessment -->
        <div class="card hover:-translate-y-1">
          <div class="flex items-center space-x-3 mb-6">
            <div class="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h3 class="text-xl font-bold">AI Risk Assessment</h3>
              <p class="text-slate-400">Real-time volatility prediction using LSTM models</p>
            </div>
          </div>

          <div v-if="aiResult" class="grid grid-cols-2 gap-4 mb-6">
            <div class="bg-slate-700/50 rounded-lg p-4 text-center">
              <div class="text-2xl font-bold text-blue-400">{{ aiResult.lambda?.toFixed(2) }}</div>
              <div class="text-sm text-slate-400">Risk Factor (λ)</div>
            </div>
            <div class="bg-slate-700/50 rounded-lg p-4 text-center">
              <div class="text-2xl font-bold text-purple-400">{{ (aiResult.lambda * 100)?.toFixed(0) }}%</div>
              <div class="text-sm text-slate-400">Max LTV</div>
            </div>
          </div>

          <button @click="testAIService"
                  :disabled="loadingAI"
                  class="btn-primary w-full">
            <div v-if="loadingAI" class="loading-spinner mr-2"></div>
            {{ loadingAI ? 'Testing AI Service...' : 'Test AI Service' }}
          </button>
        </div>

        <!-- Smart Contracts -->
        <div class="card hover:-translate-y-1">
          <div class="flex items-center space-x-3 mb-6">
            <div class="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
              <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 class="text-xl font-bold">Smart Contracts</h3>
              <p class="text-slate-400">Deployed on Polygon Amoy Testnet</p>
            </div>
          </div>

          <div class="space-y-3 mb-6">
            <div class="flex justify-between items-center p-3 bg-slate-700/50 rounded-lg">
              <span class="font-medium">Loan Contract</span>
              <span class="badge badge-success">Deployed</span>
            </div>
            <div class="flex justify-between items-center p-3 bg-slate-700/50 rounded-lg">
              <span class="font-medium">Oracle Service</span>
              <span class="badge badge-success">Active</span>
            </div>
            <div class="flex justify-between items-center p-3 bg-slate-700/50 rounded-lg">
              <span class="font-medium">x402 Payments</span>
              <span class="badge badge-success">Ready</span>
            </div>
          </div>

          <button @click="viewContracts" class="btn-secondary w-full">
            View on Explorer
          </button>
        </div>
      </div>

      <!-- Technology Integration -->
      <div class="card mb-12">
        <div class="text-center mb-8">
          <h2 class="text-3xl font-bold mb-4">
            <span class="gradient-text">Multi-Chain Technology Stack</span>
          </h2>
          <p class="text-slate-300 max-w-2xl mx-auto">
            Integrating cutting-edge Web3 technologies for the next generation of DeFi lending
          </p>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
          <!-- Pyth Network -->
          <div class="text-center group">
            <div class="w-16 h-16 mx-auto mb-3 bg-gradient-to-r from-purple-600 to-purple-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h4 class="font-semibold mb-1">Pyth Network</h4>
            <p class="text-sm text-slate-400">Real-time Oracles</p>
          </div>

          <!-- Self Protocol -->
          <div class="text-center group">
            <div class="w-16 h-16 mx-auto mb-3 bg-gradient-to-r from-cyan-600 to-cyan-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h4 class="font-semibold mb-1">Self Protocol</h4>
            <p class="text-sm text-slate-400">ZK Identity</p>
          </div>

          <!-- Polygon -->
          <div class="text-center group">
            <div class="w-16 h-16 mx-auto mb-3 bg-gradient-to-r from-violet-600 to-violet-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h4 class="font-semibold mb-1">Polygon</h4>
            <p class="text-sm text-slate-400">L2 Scaling</p>
          </div>

          <!-- Fluence -->
          <div class="text-center group">
            <div class="w-16 h-16 mx-auto mb-3 bg-gradient-to-r from-blue-600 to-blue-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
              </svg>
            </div>
            <h4 class="font-semibold mb-1">Fluence</h4>
            <p class="text-sm text-slate-400">Decentralized AI</p>
          </div>
        </div>
      </div>

      <!-- Get Started -->
      <div class="text-center">
        <div class="inline-flex items-center space-x-2 text-slate-400 mb-4">
          <div class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span>All systems operational</span>
        </div>
        <h2 class="text-2xl font-bold mb-4">Ready to get started?</h2>
        <p class="text-slate-300 mb-6">Connect your wallet and experience the future of DeFi lending</p>

        <div v-if="!isWalletConnected" class="text-center">
          <p class="text-slate-400">Connect your wallet to begin</p>
        </div>

        <div v-else-if="!isCorrectNetwork" class="text-center">
          <button @click="switchToPolygonAmoy" class="btn-primary">
            Switch to Polygon Amoy
          </button>
        </div>

        <div v-else class="space-y-4">
          <div class="flex flex-col sm:flex-row gap-4 justify-center">
            <button class="btn-primary">
              Create Loan
            </button>
            <button class="btn-secondary">
              View Dashboard
            </button>
          </div>
        </div>
      </div>
    </main>

    <!-- Footer -->
    <footer class="border-t border-slate-700/50 mt-16">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div class="col-span-1 md:col-span-2">
            <div class="flex items-center space-x-3 mb-4">
              <div class="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span class="text-xl font-bold gradient-text">zkRisk</span>
            </div>
            <p class="text-slate-400 mb-4 max-w-md">
              Next-generation DeFi lending protocol powered by AI risk assessment and zero-knowledge proofs.
            </p>
            <div class="text-sm text-slate-500">
              Built for ETHGlobal hackathon 2024
            </div>
          </div>

          <div>
            <h4 class="font-semibold mb-4">Technology</h4>
            <ul class="space-y-2 text-sm text-slate-400">
              <li><a href="#" class="hover:text-white transition-colors">Zero-Knowledge Proofs</a></li>
              <li><a href="#" class="hover:text-white transition-colors">AI Risk Models</a></li>
              <li><a href="#" class="hover:text-white transition-colors">Oracle Integration</a></li>
              <li><a href="#" class="hover:text-white transition-colors">Cross-chain Bridge</a></li>
            </ul>
          </div>

          <div>
            <h4 class="font-semibold mb-4">Networks</h4>
            <ul class="space-y-2 text-sm text-slate-400">
              <li><a href="#" class="hover:text-white transition-colors">Polygon Amoy</a></li>
              <li><a href="#" class="hover:text-white transition-colors">Celo Alfajores</a></li>
              <li><a href="#" class="hover:text-white transition-colors">Mainnet (Soon)</a></li>
            </ul>
          </div>
        </div>

        <div class="border-t border-slate-700/50 mt-8 pt-8 text-center text-sm text-slate-500">
          © 2024 zkRisk-Agent. Built with ❤️ for the future of DeFi.
        </div>
      </div>
    </footer>

    <!-- Notifications -->
    <div v-if="globalNotification"
         :class="[
           'fixed top-4 right-4 z-50 max-w-sm w-full',
           'bg-slate-800 border rounded-lg shadow-lg p-4',
           'animate-slide-in',
           {
             'border-green-500/50': globalNotification.type === 'success',
             'border-yellow-500/50': globalNotification.type === 'warning',
             'border-red-500/50': globalNotification.type === 'error',
             'border-blue-500/50': globalNotification.type === 'info'
           }
         ]">
      <div class="flex items-start space-x-3">
        <div :class="[
          'w-5 h-5 mt-0.5',
          {
            'text-green-400': globalNotification.type === 'success',
            'text-yellow-400': globalNotification.type === 'warning',
            'text-red-400': globalNotification.type === 'error',
            'text-blue-400': globalNotification.type === 'info'
          }
        ]">
          <CheckCircleIcon v-if="globalNotification.type === 'success'" />
          <ExclamationTriangleIcon v-if="globalNotification.type === 'warning'" />
          <XCircleIcon v-if="globalNotification.type === 'error'" />
          <InformationCircleIcon v-if="globalNotification.type === 'info'" />
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-white">{{ globalNotification.message }}</p>
        </div>
        <button @click="dismissNotification"
                class="text-slate-400 hover:text-white transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Loading Overlay -->
    <div v-if="isLoading"
         class="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex items-center justify-center">
      <div class="bg-slate-800 rounded-xl p-8 max-w-sm w-full mx-4 text-center">
        <div class="loading-spinner w-12 h-12 mx-auto mb-4"></div>
        <h3 class="text-lg font-semibold mb-2">{{ loadingMessage }}</h3>
        <p class="text-slate-400 text-sm">{{ loadingDetails }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XCircleIcon
} from '@heroicons/vue/24/outline'

import WalletConnect from './components/WalletConnect.vue'
import { CONTRACT_ADDRESSES, SUPPORTED_NETWORKS } from './config/wagmi.js'

// Reactive state
const walletAddress = ref(null)
const isWalletConnected = ref(false)
const currentNetwork = ref(null)
const globalNotification = ref(null)
const isLoading = ref(false)
const loadingMessage = ref('')
const loadingDetails = ref('')
const loadingAI = ref(false)
const aiResult = ref(null)

// Computed
const isCorrectNetwork = computed(() => {
  if (!currentNetwork.value) return false
  return currentNetwork.value === SUPPORTED_NETWORKS.POLYGON_AMOY
})

const currentNetworkName = computed(() => {
  if (currentNetwork.value === SUPPORTED_NETWORKS.POLYGON_AMOY) return 'Polygon Amoy'
  if (currentNetwork.value === SUPPORTED_NETWORKS.CELO_ALFAJORES) return 'Celo Alfajores'
  if (currentNetwork.value === 1) return 'Ethereum Mainnet'
  if (currentNetwork.value === 11155111) return 'Sepolia Testnet'
  if (currentNetwork.value === 137) return 'Polygon Mainnet'
  return `Network ${currentNetwork.value}`
})

// Methods
const handleWalletConnected = (walletInfo) => {
  walletAddress.value = walletInfo.address
  isWalletConnected.value = true
  currentNetwork.value = walletInfo.chainId

  showGlobalNotification({
    type: 'success',
    message: `Wallet connected successfully`,
  })
}

const handleWalletDisconnected = () => {
  walletAddress.value = null
  isWalletConnected.value = false
  currentNetwork.value = null

  showGlobalNotification({
    type: 'info',
    message: 'Wallet disconnected',
  })
}

const handleNetworkChanged = (networkId) => {
  currentNetwork.value = networkId

  if (isCorrectNetwork.value) {
    showGlobalNotification({
      type: 'success',
      message: 'Connected to Polygon Amoy successfully',
    })
  } else {
    showGlobalNotification({
      type: 'warning',
      message: `Please switch to Polygon Amoy Testnet`,
    })
  }
}

const switchToPolygonAmoy = async () => {
  if (!window.ethereum) {
    showGlobalNotification({
      type: 'error',
      message: 'No wallet detected. Please install MetaMask.',
    })
    return
  }

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x13882' }], // 80002 in hex
    })
  } catch (switchError) {
    if (switchError.code === 4902) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x13882',
            chainName: 'Polygon Amoy Testnet',
            nativeCurrency: {
              name: 'POL',
              symbol: 'POL',
              decimals: 18,
            },
            rpcUrls: ['https://rpc-amoy.polygon.technology'],
            blockExplorerUrls: ['https://amoy.polygonscan.com'],
          }],
        })
      } catch (addError) {
        showGlobalNotification({
          type: 'error',
          message: 'Failed to add Polygon Amoy network',
        })
      }
    } else {
      showGlobalNotification({
        type: 'error',
        message: 'Failed to switch network',
      })
    }
  }
}

const testAIService = async () => {
  loadingAI.value = true
  try {
    const response = await fetch('http://localhost:5001/demo')
    const data = await response.json()

    aiResult.value = {
      lambda: data.lambda,
      riskLevel: data.interpretation.risk_level
    }

    showGlobalNotification({
      type: 'success',
      message: `AI Service Test Successful - Risk Factor: ${data.lambda.toFixed(2)}`
    })
  } catch (error) {
    showGlobalNotification({
      type: 'error',
      message: 'AI Service unavailable. Please ensure the service is running.'
    })
  } finally {
    loadingAI.value = false
  }
}

const viewContracts = () => {
  window.open('https://amoy.polygonscan.com', '_blank')
}

const formatAddress = (address) => {
  if (!address) return ''
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

const showGlobalNotification = (notification) => {
  globalNotification.value = notification
  setTimeout(() => {
    globalNotification.value = null
  }, 5000)
}

const dismissNotification = () => {
  globalNotification.value = null
}

// Lifecycle
onMounted(() => {
  console.log('🚀 zkRisk-Agent Frontend Initialized')
  console.log('📋 Supported Networks:', SUPPORTED_NETWORKS)
  console.log('📄 Contract Addresses:', CONTRACT_ADDRESSES)
})
</script>