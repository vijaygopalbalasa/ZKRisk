'use client'

import { useState, useEffect } from 'react'
import {
  CheckCircle,
  AlertTriangle,
  Info,
  XCircle,
  Zap,
  Wallet,
  Globe,
  Brain,
  FileText,
  Database,
  Shield,
  Network,
  X,
  Dog
} from 'lucide-react'
import WalletConnect from '@/components/WalletConnect'
import ShibLendingInterface from '@/components/ShibLendingInterface'
import PythPriceDashboard from '@/components/PythPriceDashboard'
import LTVCalculator from '@/components/LTVCalculator'
import { CONTRACT_ADDRESSES } from '@/config/contracts'

// Network constants
const SUPPORTED_NETWORKS = {
  POLYGON_AMOY: 80002,
  CELO_ALFAJORES: 44787
}

// External services
const EXTERNAL_SERVICES = {
  FLUENCE_AI_ENDPOINT: 'http://localhost:5001'
}

interface WalletInfo {
  address: string
  chainId: number
}

interface Notification {
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
}

interface AIResult {
  lambda: number
  riskLevel: string
}

interface RealTimePrice {
  price: number
  change24h: number
  volatility: number
  timestamp: number
}

export default function Home() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [isWalletConnected, setIsWalletConnected] = useState(false)
  const [currentNetwork, setCurrentNetwork] = useState<number | null>(null)
  const [globalNotification, setGlobalNotification] = useState<Notification | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('')
  const [loadingDetails, setLoadingDetails] = useState('')
  const [loadingAI, setLoadingAI] = useState(false)
  const [aiResult, setAiResult] = useState<AIResult | null>(null)

  // Real-time price state - initialize with null, will be set by PythPriceDashboard
  const [realTimeETH, setRealTimeETH] = useState<RealTimePrice | null>(null)
  const [realTimeSHIB, setRealTimeSHIB] = useState<RealTimePrice | null>(null)

  const isCorrectNetwork = currentNetwork === 80002 // Polygon Amoy

  const currentNetworkName = (() => {
    if (currentNetwork === 80002) return 'Polygon Amoy'
    if (currentNetwork === 44787) return 'Celo Alfajores'
    if (currentNetwork === 1) return 'Ethereum Mainnet'
    if (currentNetwork === 11155111) return 'Sepolia Testnet'
    if (currentNetwork === 137) return 'Polygon Mainnet'
    return currentNetwork ? `Network ${currentNetwork}` : 'Unknown'
  })()

  const handleWalletConnected = (walletInfo: WalletInfo) => {
    setWalletAddress(walletInfo.address)
    setIsWalletConnected(true)
    setCurrentNetwork(walletInfo.chainId)

    showGlobalNotification({
      type: 'success',
      message: 'Wallet connected successfully',
    })
  }

  const handleWalletDisconnected = () => {
    setWalletAddress(null)
    setIsWalletConnected(false)
    setCurrentNetwork(null)

    showGlobalNotification({
      type: 'info',
      message: 'Wallet disconnected',
    })
  }

  const handleNetworkChanged = (networkId: number) => {
    setCurrentNetwork(networkId)

    if (networkId === 80002) {
      showGlobalNotification({
        type: 'success',
        message: 'Connected to Polygon Amoy successfully',
      })
    } else {
      showGlobalNotification({
        type: 'warning',
        message: 'Please switch to Polygon Amoy Testnet',
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
    } catch (switchError: any) {
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
    setLoadingAI(true)
    try {
      const response = await fetch(`${EXTERNAL_SERVICES.FLUENCE_AI_ENDPOINT}/demo`)
      const data = await response.json()

      setAiResult({
        lambda: data.lambda,
        riskLevel: data.interpretation.risk_level
      })

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
      setLoadingAI(false)
    }
  }

  const viewContracts = () => {
    window.open('https://amoy.polygonscan.com', '_blank')
  }

  const formatAddress = (address: string | null) => {
    if (!address) return ''
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const showGlobalNotification = (notification: Notification) => {
    setGlobalNotification(notification)
    setTimeout(() => {
      setGlobalNotification(null)
    }, 5000)
  }

  const dismissNotification = () => {
    setGlobalNotification(null)
  }

  // Handle real-time price updates from PythPriceDashboard
  const handlePriceUpdate = (symbol: string, priceData: { price: number; change24h: number; volatility: number; timestamp: number }) => {
    const realTimePrice: RealTimePrice = {
      price: priceData.price,
      change24h: priceData.change24h,
      volatility: priceData.volatility,
      timestamp: priceData.timestamp
    }

    if (symbol === 'ETH/USD') {
      setRealTimeETH(realTimePrice)
      console.log('📊 Real-time ETH price updated:', realTimePrice.price)
    } else if (symbol === 'SHIB/USD') {
      setRealTimeSHIB(realTimePrice)
      console.log('📊 Real-time SHIB price updated:', realTimePrice.price)
    }
  }

  useEffect(() => {
    console.log('🚀 zkRisk-Agent Frontend Initialized')
    console.log('📋 Supported Networks:', { POLYGON_AMOY: 80002, CELO_ALFAJORES: 44787 })
    console.log('📄 Contract Addresses:', CONTRACT_ADDRESSES)
  }, [])

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50 backdrop-blur-xl bg-slate-900/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold gradient-text">zkRisk 🐕</h1>
                  <div className="text-xs text-slate-400 -mt-1">SHIB Memecoin Lending</div>
                </div>
              </div>
            </div>

            {/* Navigation & Wallet */}
            <div className="flex items-center space-x-4">
              <WalletConnect
                onWalletConnected={handleWalletConnected}
                onWalletDisconnected={handleWalletDisconnected}
                onNetworkChanged={handleNetworkChanged}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Wrong Network Banner */}
      {currentNetwork && !isCorrectNetwork && (
        <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white py-3">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-medium">Wrong Network</span>
                <span className="hidden sm:inline">Please switch to Polygon Amoy Testnet</span>
              </div>
              <button
                onClick={switchToPolygonAmoy}
                className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Switch Network
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
            <span className="gradient-text">Deposit SHIB—Borrow USDC</span> 🐕<br />
            <span className="text-orange-400">Much leverage, very alpha</span>
          </h1>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto mb-8">
            🚀 <span className="text-orange-400 font-bold">1.8x leverage</span> on SHIB in 30 seconds!
            AI watches volatility every second → outputs λ → you borrow instantly.
            Get Paper-Hand Insurance NFT when volatility spikes.
          </p>

          {/* Status Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-8">
            {/* Wallet Status */}
            <div className="card">
              <div className="flex items-center space-x-3 mb-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  isWalletConnected ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'
                }`}>
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold">Wallet</h3>
                  <p className={`text-sm ${
                    isWalletConnected ? 'text-green-400' : 'text-slate-400'
                  }`}>
                    {isWalletConnected ? formatAddress(walletAddress) : 'Not Connected'}
                  </p>
                </div>
              </div>
              <div className={`badge w-full justify-center ${
                isWalletConnected ? 'badge-success' : 'badge-error'
              }`}>
                {isWalletConnected ? 'Connected' : 'Disconnected'}
              </div>
            </div>

            {/* Network Status */}
            <div className="card">
              <div className="flex items-center space-x-3 mb-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  isCorrectNetwork ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-700 text-slate-400'
                }`}>
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold">Network</h3>
                  <p className={`text-sm ${
                    isCorrectNetwork ? 'text-blue-400' : 'text-slate-400'
                  }`}>
                    {currentNetworkName || 'Unknown'}
                  </p>
                </div>
              </div>
              <div className={`badge w-full justify-center ${
                isCorrectNetwork ? 'badge-success' : currentNetwork ? 'badge-error' : 'badge-warning'
              }`}>
                {isCorrectNetwork ? 'Polygon Amoy' : currentNetwork ? 'Wrong Network' : 'No Network'}
              </div>
            </div>

            {/* AI Service Status */}
            <div className="card">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
                  <Brain className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold">AI Service</h3>
                  <p className="text-sm text-purple-400">Real-time Risk</p>
                </div>
              </div>
              <div className="badge badge-success w-full justify-center">
                Active
              </div>
            </div>
          </div>
        </div>

        {/* Feature Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* AI Risk Assessment */}
          <div className="card hover:-translate-y-1">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold">AI Risk Assessment</h3>
                <p className="text-slate-400">Real-time volatility prediction using LSTM models</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-slate-700/50 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-orange-400">{aiResult?.lambda?.toFixed(2) || '1.8'}</div>
                <div className="text-sm text-slate-400">AI Lambda (λ)</div>
                <div className="text-xs text-green-400 mt-1">Live SHIB Analysis</div>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-purple-400">{aiResult ? (aiResult.lambda * 100)?.toFixed(0) : '180'}%</div>
                <div className="text-sm text-slate-400">Leverage Available</div>
                <div className="text-xs text-orange-400 mt-1">Borrow Now</div>
              </div>
            </div>

            {/* Live AI Status */}
            <div className="bg-gradient-to-r from-orange-500/20 to-purple-500/20 rounded-lg p-4 mb-6 text-center">
              <div className="flex items-center justify-center space-x-2 mb-2">
                <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
                <span className="text-orange-400 font-medium">AI Watching SHIB Volatility</span>
              </div>
              <div className="text-sm text-slate-300">
                Quiet market → λ = 1.8 → borrow 18,000 USDC per 10k SHIB
              </div>
              <div className="text-sm text-slate-300">
                Crazy market → λ = 0.5 → borrow 5,000 USDC per 10k SHIB
              </div>
            </div>

            <button
              onClick={testAIService}
              disabled={loadingAI}
              className="btn-primary w-full"
            >
              {loadingAI && <div className="loading-spinner mr-2"></div>}
              {loadingAI ? 'Testing AI Service...' : 'Test AI Service'}
            </button>
          </div>

          {/* Smart Contracts */}
          <div className="card hover:-translate-y-1">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold">Smart Contracts</h3>
                <p className="text-slate-400">Deployed on Polygon Amoy Testnet</p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between items-center p-3 bg-slate-700/50 rounded-lg">
                <span className="font-medium">Loan Contract</span>
                <span className="badge badge-success">Deployed</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-700/50 rounded-lg">
                <span className="font-medium">Oracle Service</span>
                <span className="badge badge-success">Active</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-700/50 rounded-lg">
                <span className="font-medium">x402 Payments</span>
                <span className="badge badge-success">Ready</span>
              </div>
            </div>

            <button onClick={viewContracts} className="btn-secondary w-full">
              View on Explorer
            </button>
          </div>
        </div>

        {/* Live Pyth Price Dashboard */}
        <div className="mb-12">
          <PythPriceDashboard
            refreshInterval={5000}
            onPriceUpdate={handlePriceUpdate}
          />
        </div>

        {/* Real-time LTV Calculator Demo */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Real-time LTV Analysis</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {realTimeSHIB ? (
              <LTVCalculator
                collateralAmount={40000000}
                collateralPrice={realTimeSHIB.price}
                collateralSymbol="SHIB"
                borrowAmount={750}
                liquidationThreshold={80}
                maxLTV={75}
                className="h-full"
                showDetails={true}
              />
            ) : (
              <div className="card h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="loading-spinner w-8 h-8 mx-auto mb-3"></div>
                  <div className="text-slate-400">Loading real-time SHIB prices...</div>
                </div>
              </div>
            )}
            {realTimeETH ? (
              <LTVCalculator
                collateralAmount={1}
                collateralPrice={realTimeETH.price}
                collateralSymbol="ETH"
                borrowAmount={3015}
                liquidationThreshold={85}
                maxLTV={80}
                className="h-full"
                showDetails={false}
              />
            ) : (
              <div className="card h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="loading-spinner w-8 h-8 mx-auto mb-3"></div>
                  <div className="text-slate-400">Loading real-time ETH prices...</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SHIB Lending Interface */}
        <div className="mb-12">
          <ShibLendingInterface
            isConnected={isWalletConnected}
            walletAddress={walletAddress}
            shibPrice={realTimeSHIB?.price || 0.000025}
            lambda={realTimeSHIB ? (realTimeSHIB.volatility > 40 ? 1.8 : realTimeSHIB.volatility > 30 ? 1.6 : realTimeSHIB.volatility > 20 ? 1.4 : realTimeSHIB.volatility > 10 ? 1.2 : 1.0) : 1.8}
          />
        </div>

        {/* Technology Integration */}
        <div className="card mb-12">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-4">
              <span className="gradient-text">Multi-Chain Technology Stack</span>
            </h2>
            <p className="text-slate-300 max-w-2xl mx-auto">
              Integrating cutting-edge Web3 technologies for the next generation of DeFi lending
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {/* Pyth Network */}
            <div className="text-center group">
              <div className="w-16 h-16 mx-auto mb-3 bg-gradient-to-r from-purple-600 to-purple-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <h4 className="font-semibold mb-1">Pyth Network</h4>
              <p className="text-sm text-slate-400">Real-time Oracles</p>
            </div>

            {/* Self Protocol */}
            <div className="text-center group">
              <div className="w-16 h-16 mx-auto mb-3 bg-gradient-to-r from-cyan-600 to-cyan-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h4 className="font-semibold mb-1">Self Protocol</h4>
              <p className="text-sm text-slate-400">ZK Identity</p>
            </div>

            {/* Polygon */}
            <div className="text-center group">
              <div className="w-16 h-16 mx-auto mb-3 bg-gradient-to-r from-violet-600 to-violet-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Network className="w-8 h-8 text-white" />
              </div>
              <h4 className="font-semibold mb-1">Polygon</h4>
              <p className="text-sm text-slate-400">L2 Scaling</p>
            </div>

            {/* Fluence */}
            <div className="text-center group">
              <div className="w-16 h-16 mx-auto mb-3 bg-gradient-to-r from-blue-600 to-blue-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Database className="w-8 h-8 text-white" />
              </div>
              <h4 className="font-semibold mb-1">Fluence</h4>
              <p className="text-sm text-slate-400">Decentralized AI</p>
            </div>
          </div>
        </div>

        {/* Get Started */}
        <div className="text-center">
          <div className="inline-flex items-center space-x-2 text-slate-400 mb-4">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span>All systems operational</span>
          </div>
          <h2 className="text-2xl font-bold mb-4">Ready to get started?</h2>
          <p className="text-slate-300 mb-6">Connect your wallet and experience the future of DeFi lending</p>

          {!isWalletConnected ? (
            <div className="text-center">
              <p className="text-slate-400">Connect your wallet to begin</p>
            </div>
          ) : !isCorrectNetwork ? (
            <div className="text-center">
              <button onClick={switchToPolygonAmoy} className="btn-primary">
                Switch to Polygon Amoy
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a href="/demo" className="btn-primary inline-block text-center">
                  🚀 Try End-to-End Demo
                </a>
                <button className="btn-secondary">
                  View Dashboard
                </button>
              </div>
              <p className="text-sm text-slate-400">
                Experience the complete lending workflow with real contracts
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-700/50 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold gradient-text">zkRisk</span>
              </div>
              <p className="text-slate-400 mb-4 max-w-md">
                Next-generation DeFi lending protocol powered by AI risk assessment and zero-knowledge proofs.
              </p>
              <div className="text-sm text-slate-500">
                Built for ETHGlobal hackathon 2024
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Technology</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="#" className="hover:text-white transition-colors">Zero-Knowledge Proofs</a></li>
                <li><a href="#" className="hover:text-white transition-colors">AI Risk Models</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Oracle Integration</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Cross-chain Bridge</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Networks</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="#" className="hover:text-white transition-colors">Polygon Amoy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Celo Alfajores</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Mainnet (Soon)</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-700/50 mt-8 pt-8 text-center text-sm text-slate-500">
            © 2024 zkRisk-Agent. Built with ❤️ for the future of DeFi.
          </div>
        </div>
      </footer>

      {/* Notifications */}
      {globalNotification && (
        <div className={`fixed top-4 right-4 z-50 max-w-sm w-full bg-slate-800 border rounded-lg shadow-lg p-4 animate-slide-in ${
          {
            'border-green-500/50': globalNotification.type === 'success',
            'border-yellow-500/50': globalNotification.type === 'warning',
            'border-red-500/50': globalNotification.type === 'error',
            'border-blue-500/50': globalNotification.type === 'info'
          }[globalNotification.type]
        }`}>
          <div className="flex items-start space-x-3">
            <div className={`w-5 h-5 mt-0.5 ${
              {
                'text-green-400': globalNotification.type === 'success',
                'text-yellow-400': globalNotification.type === 'warning',
                'text-red-400': globalNotification.type === 'error',
                'text-blue-400': globalNotification.type === 'info'
              }[globalNotification.type]
            }`}>
              {globalNotification.type === 'success' && <CheckCircle />}
              {globalNotification.type === 'warning' && <AlertTriangle />}
              {globalNotification.type === 'error' && <XCircle />}
              {globalNotification.type === 'info' && <Info />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">{globalNotification.message}</p>
            </div>
            <button
              onClick={dismissNotification}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-slate-800 rounded-xl p-8 max-w-sm w-full mx-4 text-center">
            <div className="loading-spinner w-12 h-12 mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold mb-2">{loadingMessage}</h3>
            <p className="text-slate-400 text-sm">{loadingDetails}</p>
          </div>
        </div>
      )}
    </div>
  )
}