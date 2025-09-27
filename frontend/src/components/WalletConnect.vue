<template>
  <div class="wallet-connect">
    <!-- Connected State -->
    <div v-if="isConnected" class="wallet-connected">
      <!-- Wallet Display -->
      <div class="wallet-display">
        <div class="wallet-avatar">
          <div class="avatar-icon">👤</div>
        </div>
        <div class="wallet-info">
          <div class="wallet-address">{{ formatAddress(address) }}</div>
          <div class="wallet-balance">{{ balance }} {{ nativeToken }}</div>
        </div>
      </div>

      <!-- Network Status -->
      <div class="network-display" :class="{ correct: isCorrectNetwork, incorrect: !isCorrectNetwork }">
        <div class="network-dot"></div>
        <span class="network-name">{{ currentNetworkName }}</span>
      </div>

      <!-- Action Buttons -->
      <div class="wallet-actions">
        <button @click="copyAddress" class="action-btn copy-btn" title="Copy Address">
          <ClipboardIcon class="w-4 h-4" />
          <span>Copy</span>
        </button>
        <button @click="disconnect" class="action-btn disconnect-btn" title="Disconnect Wallet">
          <ArrowRightOnRectangleIcon class="w-4 h-4" />
          <span>Disconnect</span>
        </button>
      </div>

      <!-- Network Switch Button -->
      <div v-if="!isCorrectNetwork" class="network-switch">
        <button @click="switchNetwork" class="switch-network-btn">
          <span class="switch-icon">⚠️</span>
          Switch to Polygon Amoy
        </button>
      </div>
    </div>

    <!-- Disconnected State -->
    <div v-else class="wallet-disconnected">
      <button
        @click="connectWallet"
        class="connect-wallet-btn"
        :disabled="isConnecting"
      >
        <WalletIcon class="w-5 h-5" />
        <span>{{ isConnecting ? 'Connecting...' : 'Connect Wallet' }}</span>
      </button>
    </div>

    <!-- Notifications -->
    <div v-if="notification" class="notification" :class="notification.type">
      <div class="notification-content">
        <CheckCircleIcon v-if="notification.type === 'success'" class="w-5 h-5" />
        <ExclamationTriangleIcon v-else class="w-5 h-5" />
        <span>{{ notification.message }}</span>
        <button @click="notification = null" class="close-notification">×</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { BrowserProvider, formatEther } from 'ethers'
import {
  WalletIcon,
  ClipboardIcon,
  ArrowRightOnRectangleIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/vue/24/outline'
import { SUPPORTED_NETWORKS, NETWORK_NAMES } from '../config/wagmi.js'

// Emits
const emit = defineEmits(['wallet-connected', 'wallet-disconnected', 'network-changed'])

// Reactive state
const isConnected = ref(false)
const isConnecting = ref(false)
const address = ref('')
const balance = ref('0.000')
const chainId = ref(null)
const provider = ref(null)
const notification = ref(null)

// Computed
const nativeToken = computed(() => {
  if (chainId.value === SUPPORTED_NETWORKS.POLYGON_AMOY) return 'POL'
  if (chainId.value === SUPPORTED_NETWORKS.CELO_ALFAJORES) return 'CELO'
  return 'ETH'
})

const currentNetworkName = computed(() => {
  console.log('🌐 Network Name Check:')
  console.log('Current chainId:', chainId.value)
  console.log('NETWORK_NAMES mapping:', NETWORK_NAMES)
  console.log('Found name:', NETWORK_NAMES[chainId.value])

  const name = NETWORK_NAMES[chainId.value] || 'Unknown Network'
  console.log('Final network name:', name)
  return name
})

const isCorrectNetwork = computed(() => {
  console.log('WalletConnect Network Detection:')
  console.log('Current chainId:', chainId.value)
  console.log('Polygon Amoy ID:', SUPPORTED_NETWORKS.POLYGON_AMOY)
  console.log('Direct match?', chainId.value === SUPPORTED_NETWORKS.POLYGON_AMOY)
  // Focus on Polygon Amoy only for now
  return chainId.value === SUPPORTED_NETWORKS.POLYGON_AMOY
})

// Methods
const formatAddress = (addr) => {
  if (!addr) return ''
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

const showNotification = (message, type = 'info') => {
  notification.value = { message, type }
  setTimeout(() => {
    notification.value = null
  }, 4000)
}

const connectWallet = async () => {
  if (!window.ethereum) {
    showNotification('MetaMask not found. Please install MetaMask.', 'error')
    return
  }

  isConnecting.value = true

  try {
    // Request account access
    const accounts = await window.ethereum.request({
      method: 'eth_requestAccounts'
    })

    if (accounts.length === 0) {
      throw new Error('No accounts found')
    }

    // Set up provider
    provider.value = new BrowserProvider(window.ethereum)
    address.value = accounts[0]
    isConnected.value = true

    // Get network info using direct ethereum API call
    const currentChainId = await window.ethereum.request({ method: 'eth_chainId' })
    const networkChainId = parseInt(currentChainId, 16)

    console.log('🔍 Network Detection Details:')
    console.log('Raw chainId from ethereum:', currentChainId)
    console.log('Converted chainId:', networkChainId)
    console.log('Expected Polygon Amoy:', SUPPORTED_NETWORKS.POLYGON_AMOY)
    console.log('Type of converted:', typeof networkChainId)
    console.log('Type of expected:', typeof SUPPORTED_NETWORKS.POLYGON_AMOY)
    console.log('Direct comparison:', networkChainId === SUPPORTED_NETWORKS.POLYGON_AMOY)

    chainId.value = networkChainId

    // Get balance
    await updateBalance()

    // Set up event listeners
    setupEventListeners()

    showNotification('Wallet connected successfully!', 'success')

    emit('wallet-connected', {
      address: address.value,
      chainId: chainId.value
    })

    // Check if on correct network
    if (!isCorrectNetwork.value) {
      showNotification('Please switch to Polygon Amoy network', 'error')
    }

  } catch (error) {
    console.error('Connection failed:', error)
    showNotification(`Connection failed: ${error.message}`, 'error')
  } finally {
    isConnecting.value = false
  }
}

const disconnect = () => {
  isConnected.value = false
  address.value = ''
  balance.value = '0.000'
  chainId.value = null
  provider.value = null

  // Remove event listeners
  if (window.ethereum) {
    window.ethereum.removeAllListeners('accountsChanged')
    window.ethereum.removeAllListeners('chainChanged')
  }

  showNotification('Wallet disconnected', 'success')
  emit('wallet-disconnected')
}

const switchNetwork = async () => {
  if (!window.ethereum) return

  try {
    // Try to switch to Polygon Amoy
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x13882' }], // 80002 in hex
    })
  } catch (switchError) {
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

const updateBalance = async () => {
  if (!address.value) return

  try {
    // Use direct ethereum call instead of provider
    const balanceHex = await window.ethereum.request({
      method: 'eth_getBalance',
      params: [address.value, 'latest']
    })

    const balanceWei = BigInt(balanceHex)
    const balanceEth = formatEther(balanceWei)
    const balanceNum = parseFloat(balanceEth)

    if (balanceNum < 0.001) {
      balance.value = '< 0.001'
    } else {
      balance.value = balanceNum.toFixed(3)
    }
  } catch (error) {
    console.error('Failed to get balance:', error)
    balance.value = '0.000'
  }
}

const copyAddress = async () => {
  if (!address.value) return

  try {
    await navigator.clipboard.writeText(address.value)
    showNotification('Address copied to clipboard!', 'success')
  } catch (error) {
    console.error('Copy failed:', error)
    showNotification('Failed to copy address', 'error')
  }
}

const debugNetwork = () => {
  console.log('🔧 DEBUG NETWORK VALUES:')
  console.log('Current chainId.value:', chainId.value)
  console.log('Type of chainId.value:', typeof chainId.value)
  console.log('SUPPORTED_NETWORKS object:', SUPPORTED_NETWORKS)
  console.log('SUPPORTED_NETWORKS.POLYGON_AMOY:', SUPPORTED_NETWORKS.POLYGON_AMOY)
  console.log('Type of POLYGON_AMOY:', typeof SUPPORTED_NETWORKS.POLYGON_AMOY)
  console.log('Strict equality:', chainId.value === SUPPORTED_NETWORKS.POLYGON_AMOY)
  console.log('Loose equality:', chainId.value == SUPPORTED_NETWORKS.POLYGON_AMOY)
  console.log('NETWORK_NAMES:', NETWORK_NAMES)
  console.log('Network name lookup:', NETWORK_NAMES[chainId.value])
  console.log('isCorrectNetwork computed:', isCorrectNetwork.value)
  console.log('currentNetworkName computed:', currentNetworkName.value)
  console.log('nativeToken computed:', nativeToken.value)

  alert(`Debug Info:
chainId: ${chainId.value} (${typeof chainId.value})
Polygon Amoy: ${SUPPORTED_NETWORKS.POLYGON_AMOY} (${typeof SUPPORTED_NETWORKS.POLYGON_AMOY})
Match: ${chainId.value === SUPPORTED_NETWORKS.POLYGON_AMOY}
Network Name: ${currentNetworkName.value}
Token: ${nativeToken.value}`)
}

const setupEventListeners = () => {
  if (!window.ethereum) return

  // Account changed
  window.ethereum.on('accountsChanged', async (accounts) => {
    if (accounts.length === 0) {
      disconnect()
    } else {
      address.value = accounts[0]
      await updateBalance()
      emit('wallet-connected', {
        address: address.value,
        chainId: chainId.value
      })
    }
  })

  // Network changed
  window.ethereum.on('chainChanged', async (newChainId) => {
    const parsedChainId = parseInt(newChainId, 16)
    console.log('🔄 Network Changed:')
    console.log('Raw newChainId:', newChainId)
    console.log('Parsed chainId:', parsedChainId)
    console.log('Expected Polygon Amoy:', SUPPORTED_NETWORKS.POLYGON_AMOY)

    chainId.value = parsedChainId

    if (provider.value) {
      // Update provider network
      provider.value = new BrowserProvider(window.ethereum)
      await updateBalance()
    }

    emit('network-changed', chainId.value)

    if (isCorrectNetwork.value) {
      showNotification(`Switched to ${currentNetworkName.value}`, 'success')
    } else {
      showNotification('Please switch to Polygon Amoy network', 'error')
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
      provider.value = new BrowserProvider(window.ethereum)
      address.value = accounts[0]
      isConnected.value = true

      try {
        // Get current network from ethereum object directly first
        const currentChainId = await window.ethereum.request({ method: 'eth_chainId' })
        const networkChainId = parseInt(currentChainId, 16)

        console.log('📋 Auto-connection network check:')
        console.log('Raw chainId from ethereum:', currentChainId)
        console.log('Parsed Network chainId:', networkChainId)
        console.log('Expected Polygon Amoy:', SUPPORTED_NETWORKS.POLYGON_AMOY)

        chainId.value = networkChainId
      } catch (networkError) {
        console.error('Failed to get network info:', networkError)
        // Fallback: try to get it from provider if that fails
        try {
          const network = await provider.value.getNetwork()
          chainId.value = Number(network.chainId)
        } catch (providerError) {
          console.error('Failed to get network from provider:', providerError)
          // Set a default or leave it null
          chainId.value = null
        }
      }

      await updateBalance()
      setupEventListeners()

      emit('wallet-connected', {
        address: address.value,
        chainId: chainId.value
      })
    }
  } catch (error) {
    console.error('Failed to check connection:', error)
  }
}

// Lifecycle
onMounted(() => {
  console.log('🚀 WalletConnect Component Mounted')
  console.log('SUPPORTED_NETWORKS:', SUPPORTED_NETWORKS)
  console.log('NETWORK_NAMES:', NETWORK_NAMES)
  console.log('Polygon Amoy ID from config:', SUPPORTED_NETWORKS.POLYGON_AMOY)
  checkConnection()
})

onUnmounted(() => {
  if (window.ethereum) {
    window.ethereum.removeAllListeners('accountsChanged')
    window.ethereum.removeAllListeners('chainChanged')
  }
})

// Expose methods for parent components
defineExpose({
  connectWallet,
  disconnect,
  isConnected,
  address,
  chainId
})
</script>

<style scoped>
.wallet-connect {
  position: relative;
}

.wallet-connected {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.wallet-info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
}

.wallet-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 14px;
}

.wallet-details {
  flex: 1;
}

.wallet-name {
  font-weight: 600;
  color: #111827;
  margin-bottom: 2px;
}

.wallet-balance {
  font-size: 14px;
  color: #6b7280;
}

.wallet-actions {
  display: flex;
  gap: 8px;
}

.action-btn, .disconnect-btn {
  padding: 8px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-btn:hover {
  background: #f9fafb;
  border-color: #d1d5db;
}

.disconnect-btn {
  color: #ef4444;
  border-color: #fee2e2;
}

.disconnect-btn:hover {
  background: #fef2f2;
  border-color: #fecaca;
}

.network-status {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: #f9fafb;
  border-radius: 8px;
  font-size: 14px;
}

.network-indicator {
  padding: 4px 8px;
  border-radius: 6px;
  font-weight: 500;
  background: #fee2e2;
  color: #dc2626;
}

.network-indicator.connected {
  background: #dcfce7;
  color: #166534;
}

.switch-network-btn {
  padding: 6px 12px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s ease;
}

.switch-network-btn:hover {
  background: #2563eb;
}

.debug-btn {
  padding: 4px 8px;
  background: #ff6600;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease;
}

.debug-btn:hover {
  background: #e55a00;
}

.connect-wallet-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  color: white;
  border: none;
  border-radius: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.1);
}

.connect-wallet-btn:hover {
  background: linear-gradient(135deg, #2563eb, #1e40af);
  transform: translateY(-1px);
  box-shadow: 0 6px 8px -1px rgba(59, 130, 246, 0.15);
}

.connect-wallet-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  transform: none;
}

.notification {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1001;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  max-width: 400px;
  backdrop-filter: blur(10px);
}

.notification.success {
  background: rgba(240, 253, 244, 0.95);
  border: 1px solid #bbf7d0;
}

.notification.error {
  background: rgba(254, 242, 242, 0.95);
  border: 1px solid #fecaca;
}

.notification-content {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  line-height: 1.4;
}

.notification.success .notification-content {
  color: #166534;
}

.notification.error .notification-content {
  color: #dc2626;
}

.close-notification {
  margin-left: auto;
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.2s ease;
}

.close-notification:hover {
  opacity: 1;
}
</style>