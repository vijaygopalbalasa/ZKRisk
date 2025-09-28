'use client'

import { useState, useEffect } from 'react'
import { BrowserProvider, formatEther } from 'ethers'
import { Wallet, Copy, LogOut, CheckCircle, AlertTriangle } from 'lucide-react'
// Network constants
const SUPPORTED_NETWORKS = {
  POLYGON_AMOY: 80002,
  CELO_ALFAJORES: 44787
}

const NETWORK_NAMES = {
  [SUPPORTED_NETWORKS.POLYGON_AMOY]: 'Polygon Amoy',
  [SUPPORTED_NETWORKS.CELO_ALFAJORES]: 'Celo Alfajores',
}

interface WalletInfo {
  address: string
  chainId: number
}

interface WalletConnectProps {
  onWalletConnected: (walletInfo: WalletInfo) => void
  onWalletDisconnected: () => void
  onNetworkChanged: (chainId: number) => void
}

interface Notification {
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
}

declare global {
  interface Window {
    ethereum?: any
  }
}

export default function WalletConnect({
  onWalletConnected,
  onWalletDisconnected,
  onNetworkChanged
}: WalletConnectProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [address, setAddress] = useState('')
  const [balance, setBalance] = useState('0.000')
  const [chainId, setChainId] = useState<number | null>(null)
  const [provider, setProvider] = useState<BrowserProvider | null>(null)
  const [notification, setNotification] = useState<Notification | null>(null)

  const nativeToken = chainId === SUPPORTED_NETWORKS.POLYGON_AMOY ? 'POL' :
                     chainId === SUPPORTED_NETWORKS.CELO_ALFAJORES ? 'CELO' : 'ETH'

  const currentNetworkName = chainId ? (NETWORK_NAMES[chainId] || `Network ${chainId}`) : 'Unknown Network'

  const isCorrectNetwork = chainId === SUPPORTED_NETWORKS.POLYGON_AMOY

  const formatAddress = (addr: string) => {
    if (!addr) return ''
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  const showNotification = (message: string, type: Notification['type'] = 'info') => {
    setNotification({ message, type })
    setTimeout(() => {
      setNotification(null)
    }, 4000)
  }

  const connectWallet = async () => {
    if (!window.ethereum) {
      showNotification('MetaMask not found. Please install MetaMask.', 'error')
      return
    }

    setIsConnecting(true)

    try {
      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      })

      if (accounts.length === 0) {
        throw new Error('No accounts found')
      }

      // Set up provider
      const browserProvider = new BrowserProvider(window.ethereum)
      setProvider(browserProvider)
      setAddress(accounts[0])
      setIsConnected(true)

      // Get network info using direct ethereum API call
      const currentChainId = await window.ethereum.request({ method: 'eth_chainId' })
      const networkChainId = parseInt(currentChainId, 16)

      console.log('🔍 Network Detection Details:')
      console.log('Raw chainId from ethereum:', currentChainId)
      console.log('Converted chainId:', networkChainId)
      console.log('Expected Polygon Amoy:', SUPPORTED_NETWORKS.POLYGON_AMOY)

      setChainId(networkChainId)

      // Get balance
      await updateBalance(accounts[0])

      // Set up event listeners
      setupEventListeners()

      showNotification('Wallet connected successfully!', 'success')

      onWalletConnected({
        address: accounts[0],
        chainId: networkChainId
      })

      // Check if on correct network
      if (networkChainId !== SUPPORTED_NETWORKS.POLYGON_AMOY) {
        showNotification('Please switch to Polygon Amoy network', 'warning')
      }

    } catch (error: any) {
      console.error('Connection failed:', error)
      showNotification(`Connection failed: ${error.message}`, 'error')
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnect = () => {
    setIsConnected(false)
    setAddress('')
    setBalance('0.000')
    setChainId(null)
    setProvider(null)

    // Remove event listeners
    if (window.ethereum) {
      window.ethereum.removeAllListeners('accountsChanged')
      window.ethereum.removeAllListeners('chainChanged')
    }

    showNotification('Wallet disconnected', 'success')
    onWalletDisconnected()
  }

  const switchNetwork = async () => {
    if (!window.ethereum) return

    try {
      // Try to switch to Polygon Amoy
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x13882' }], // 80002 in hex
      })
    } catch (switchError: any) {
      // If network doesn't exist, add it
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
          console.error('Failed to add network:', addError)
          showNotification('Failed to add Polygon Amoy network', 'error')
        }
      } else {
        console.error('Failed to switch network:', switchError)
        showNotification('Failed to switch network', 'error')
      }
    }
  }

  const updateBalance = async (address: string) => {
    if (!address) return

    try {
      // Use direct ethereum call instead of provider
      const balanceHex = await window.ethereum.request({
        method: 'eth_getBalance',
        params: [address, 'latest']
      })

      const balanceWei = BigInt(balanceHex)
      const balanceEth = formatEther(balanceWei)
      const balanceNum = parseFloat(balanceEth)

      if (balanceNum < 0.001) {
        setBalance('< 0.001')
      } else {
        setBalance(balanceNum.toFixed(3))
      }
    } catch (error) {
      console.error('Failed to get balance:', error)
      setBalance('0.000')
    }
  }

  const copyAddress = async () => {
    if (!address) return

    try {
      await navigator.clipboard.writeText(address)
      showNotification('Address copied to clipboard!', 'success')
    } catch (error) {
      console.error('Copy failed:', error)
      showNotification('Failed to copy address', 'error')
    }
  }

  const setupEventListeners = () => {
    if (!window.ethereum) return

    // Account changed
    window.ethereum.on('accountsChanged', async (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnect()
      } else {
        setAddress(accounts[0])
        await updateBalance(accounts[0])
        onWalletConnected({
          address: accounts[0],
          chainId: chainId!
        })
      }
    })

    // Network changed
    window.ethereum.on('chainChanged', async (newChainId: string) => {
      const parsedChainId = parseInt(newChainId, 16)
      console.log('🔄 Network Changed:')
      console.log('Raw newChainId:', newChainId)
      console.log('Parsed chainId:', parsedChainId)

      setChainId(parsedChainId)

      if (provider) {
        // Update provider network
        const newProvider = new BrowserProvider(window.ethereum)
        setProvider(newProvider)
        await updateBalance(address)
      }

      onNetworkChanged(parsedChainId)

      if (parsedChainId === SUPPORTED_NETWORKS.POLYGON_AMOY) {
        showNotification(`Switched to ${currentNetworkName}`, 'success')
      } else {
        showNotification('Please switch to Polygon Amoy network', 'warning')
      }
    })
  }

  const checkConnection = async () => {
    if (!window.ethereum) return

    try {
      const accounts = await window.ethereum.request({
        method: 'eth_accounts'
      })

      if (accounts.length > 0) {
        // Auto-connect if previously connected
        const browserProvider = new BrowserProvider(window.ethereum)
        setProvider(browserProvider)
        setAddress(accounts[0])
        setIsConnected(true)

        try {
          // Get current network from ethereum object directly first
          const currentChainId = await window.ethereum.request({ method: 'eth_chainId' })
          const networkChainId = parseInt(currentChainId, 16)

          console.log('📋 Auto-connection network check:')
          console.log('Raw chainId from ethereum:', currentChainId)
          console.log('Parsed Network chainId:', networkChainId)

          setChainId(networkChainId)
        } catch (networkError) {
          console.error('Failed to get network info:', networkError)
          setChainId(null)
        }

        await updateBalance(accounts[0])
        setupEventListeners()

        onWalletConnected({
          address: accounts[0],
          chainId: chainId!
        })
      }
    } catch (error) {
      console.error('Failed to check connection:', error)
    }
  }

  useEffect(() => {
    console.log('🚀 WalletConnect Component Mounted')
    console.log('SUPPORTED_NETWORKS:', SUPPORTED_NETWORKS)
    console.log('NETWORK_NAMES:', NETWORK_NAMES)
    checkConnection()

    return () => {
      if (window.ethereum) {
        window.ethereum.removeAllListeners('accountsChanged')
        window.ethereum.removeAllListeners('chainChanged')
      }
    }
  }, [])

  if (isConnected) {
    return (
      <div className="relative">
        {/* Wallet Display */}
        <div className="flex items-center space-x-4">
          {/* Network Status */}
          <div className="hidden sm:flex items-center space-x-2 text-sm">
            <div className={`w-2 h-2 rounded-full ${
              isCorrectNetwork ? 'bg-green-400' : 'bg-red-400'
            }`}></div>
            <span className="text-slate-300">{currentNetworkName}</span>
          </div>

          {/* Wallet Info */}
          <div className="flex items-center space-x-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
              <Wallet className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="font-medium text-white">{formatAddress(address)}</div>
              <div className="text-sm text-slate-400">{balance} {nativeToken}</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={copyAddress}
              className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
              title="Copy Address"
            >
              <Copy className="w-4 h-4 text-slate-400" />
            </button>
            <button
              onClick={disconnect}
              className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
              title="Disconnect"
            >
              <LogOut className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Network Switch Button */}
        {!isCorrectNetwork && (
          <div className="absolute top-full left-0 right-0 mt-2 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-sm text-orange-300">
                <AlertTriangle className="w-4 h-4" />
                <span>Wrong Network</span>
              </div>
              <button
                onClick={switchNetwork}
                className="px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-md transition-colors"
              >
                Switch to Polygon Amoy
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <button
      onClick={connectWallet}
      disabled={isConnecting}
      className="btn-primary"
    >
      <Wallet className="w-5 h-5" />
      <span>{isConnecting ? 'Connecting...' : 'Connect Wallet'}</span>
    </button>
  )
}