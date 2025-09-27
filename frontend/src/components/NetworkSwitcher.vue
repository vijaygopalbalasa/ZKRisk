<template>
  <div class="network-switcher">
    <!-- Network Status Display -->
    <div class="network-status" :class="networkStatusClass">
      <div class="network-info">
        <div class="network-indicator" :class="networkIndicatorClass"></div>
        <span class="network-name">{{ currentNetworkName }}</span>
        <span v-if="!isCorrectNetwork" class="network-warning">Wrong Network</span>
      </div>

      <!-- Switch Network Button -->
      <button
        v-if="!isCorrectNetwork && isConnected"
        @click="switchToRequiredNetwork"
        class="switch-network-btn"
        :disabled="isSwitching"
      >
        {{ isSwitching ? 'Switching...' : 'Switch to Polygon Amoy' }}
      </button>
    </div>

    <!-- Network Selection Modal -->
    <div v-if="showNetworkModal" class="network-modal-overlay" @click="closeNetworkModal">
      <div class="network-modal" @click.stop>
        <div class="modal-header">
          <h3>Select Network</h3>
          <button @click="closeNetworkModal" class="close-btn">×</button>
        </div>

        <div class="network-list">
          <div
            v-for="network in supportedNetworks"
            :key="network.id"
            @click="switchToNetwork(network.id)"
            class="network-option"
            :class="{ active: chainId === network.id }"
          >
            <div class="network-icon">
              <img :src="network.icon" :alt="network.name" />
            </div>
            <div class="network-details">
              <div class="network-name">{{ network.name }}</div>
              <div class="network-chain-id">Chain ID: {{ network.id }}</div>
            </div>
            <div v-if="chainId === network.id" class="checkmark">✓</div>
          </div>
        </div>

        <div class="modal-footer">
          <p class="network-help">
            zkRisk-Agent requires Polygon Amoy testnet for optimal experience.
          </p>
        </div>
      </div>
    </div>

    <!-- Auto-switch notification -->
    <div v-if="showAutoSwitchNotification" class="auto-switch-notification">
      <div class="notification-content">
        <ExclamationTriangleIcon class="w-5 h-5 text-yellow-500" />
        <span>Detected unsupported network. Switching to Polygon Amoy...</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useAccount, useChainId, useSwitchChain } from '@wagmi/vue'
import { ExclamationTriangleIcon } from '@heroicons/vue/24/outline'
import {
  SUPPORTED_NETWORKS,
  NETWORK_NAMES,
  polygonAmoyTestnet,
  celoAlfajoresTestnet,
  isNetworkSupported
} from '../config/wagmi.js'

// Props
const props = defineProps({
  autoSwitch: {
    type: Boolean,
    default: true
  },
  showModal: {
    type: Boolean,
    default: false
  }
})

// Emits
const emit = defineEmits(['network-changed', 'network-switch-failed'])

// Composables
const { isConnected, address } = useAccount()
const chainId = useChainId()
const { switchChain, isPending: isSwitching } = useSwitchChain()

// Reactive state
const showNetworkModal = ref(props.showModal)
const showAutoSwitchNotification = ref(false)
const autoSwitchAttempted = ref(false)

// Computed properties
const currentNetworkName = computed(() => {
  return NETWORK_NAMES[chainId.value] || `Unknown Network (${chainId.value})`
})

const isCorrectNetwork = computed(() => {
  return chainId.value === SUPPORTED_NETWORKS.POLYGON_AMOY
})

const networkStatusClass = computed(() => ({
  'status-connected': isConnected.value && isCorrectNetwork.value,
  'status-wrong-network': isConnected.value && !isCorrectNetwork.value,
  'status-disconnected': !isConnected.value
}))

const networkIndicatorClass = computed(() => ({
  'indicator-green': isConnected.value && isCorrectNetwork.value,
  'indicator-yellow': isConnected.value && !isCorrectNetwork.value,
  'indicator-red': !isConnected.value
}))

const supportedNetworks = computed(() => [
  {
    id: SUPPORTED_NETWORKS.POLYGON_AMOY,
    name: 'Polygon Amoy Testnet',
    icon: 'https://cryptologos.cc/logos/polygon-matic-logo.png',
    description: 'Primary network for zkRisk-Agent'
  },
  {
    id: SUPPORTED_NETWORKS.CELO_ALFAJORES,
    name: 'Celo Alfajores Testnet',
    icon: 'https://cryptologos.cc/logos/celo-celo-logo.png',
    description: 'For Self Protocol verification'
  }
])

// Methods
const switchToRequiredNetwork = async () => {
  try {
    await switchToNetwork(SUPPORTED_NETWORKS.POLYGON_AMOY)
  } catch (error) {
    console.error('Failed to switch to required network:', error)
    emit('network-switch-failed', error)
  }
}

const switchToNetwork = async (networkId) => {
  try {
    await switchChain({ chainId: networkId })
    closeNetworkModal()
    emit('network-changed', networkId)
  } catch (error) {
    console.error('Network switch failed:', error)

    // Handle specific errors
    if (error.code === 4902) {
      // Network not added to wallet, try to add it
      await addNetworkToWallet(networkId)
    } else {
      emit('network-switch-failed', error)
    }
  }
}

const addNetworkToWallet = async (networkId) => {
  try {
    const networkConfig = getNetworkConfigForWallet(networkId)

    await window.ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [networkConfig],
    })

    // Try switching again after adding
    setTimeout(() => {
      switchToNetwork(networkId)
    }, 1000)

  } catch (addError) {
    console.error('Failed to add network to wallet:', addError)
    emit('network-switch-failed', addError)
  }
}

const getNetworkConfigForWallet = (networkId) => {
  switch (networkId) {
    case SUPPORTED_NETWORKS.POLYGON_AMOY:
      return {
        chainId: '0x13882', // 80002 in hex
        chainName: 'Polygon Amoy Testnet',
        nativeCurrency: {
          name: 'POL',
          symbol: 'POL',
          decimals: 18,
        },
        rpcUrls: ['https://rpc-amoy.polygon.technology'],
        blockExplorerUrls: ['https://amoy.polygonscan.com'],
      }
    case SUPPORTED_NETWORKS.CELO_ALFAJORES:
      return {
        chainId: '0xAEF3', // 44787 in hex
        chainName: 'Celo Alfajores Testnet',
        nativeCurrency: {
          name: 'CELO',
          symbol: 'CELO',
          decimals: 18,
        },
        rpcUrls: ['https://alfajores-forno.celo-testnet.org'],
        blockExplorerUrls: ['https://alfajores.celoscan.io'],
      }
    default:
      throw new Error(`Unsupported network: ${networkId}`)
  }
}

const closeNetworkModal = () => {
  showNetworkModal.value = false
}

const openNetworkModal = () => {
  showNetworkModal.value = true
}

// Auto-switch logic
const handleAutoSwitch = async () => {
  if (!props.autoSwitch || autoSwitchAttempted.value) return
  if (!isConnected.value || isCorrectNetwork.value) return

  autoSwitchAttempted.value = true
  showAutoSwitchNotification.value = true

  try {
    await switchToRequiredNetwork()
    setTimeout(() => {
      showAutoSwitchNotification.value = false
    }, 3000)
  } catch (error) {
    console.error('Auto-switch failed:', error)
    showAutoSwitchNotification.value = false
    // Show manual switch option
    setTimeout(() => {
      if (!isCorrectNetwork.value) {
        openNetworkModal()
      }
    }, 1000)
  }
}

// Watchers
watch([isConnected, chainId], ([connected, newChainId]) => {
  if (connected && !isNetworkSupported(newChainId)) {
    handleAutoSwitch()
  }

  // Reset auto-switch flag when network changes
  if (isCorrectNetwork.value) {
    autoSwitchAttempted.value = false
  }
}, { immediate: true })

// Lifecycle
onMounted(() => {
  // Check network on mount
  if (isConnected.value && !isCorrectNetwork.value) {
    handleAutoSwitch()
  }
})

// Expose methods for parent components
defineExpose({
  openNetworkModal,
  switchToRequiredNetwork,
  isCorrectNetwork,
  currentNetworkName
})
</script>

<style scoped>
.network-switcher {
  position: relative;
}

.network-status {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  background: white;
  transition: all 0.2s ease;
}

.status-connected {
  border-color: #10b981;
  background: #f0fdf4;
}

.status-wrong-network {
  border-color: #f59e0b;
  background: #fffbeb;
}

.status-disconnected {
  border-color: #ef4444;
  background: #fef2f2;
}

.network-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.network-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  transition: background-color 0.2s ease;
}

.indicator-green {
  background-color: #10b981;
}

.indicator-yellow {
  background-color: #f59e0b;
}

.indicator-red {
  background-color: #ef4444;
}

.network-name {
  font-weight: 500;
  color: #374151;
}

.network-warning {
  font-size: 12px;
  color: #f59e0b;
  font-weight: 500;
}

.switch-network-btn {
  padding: 6px 12px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.switch-network-btn:hover {
  background: #2563eb;
}

.switch-network-btn:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

.network-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.network-modal {
  background: white;
  border-radius: 16px;
  padding: 24px;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: #6b7280;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.network-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.network-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.network-option:hover {
  border-color: #3b82f6;
  background: #f8fafc;
}

.network-option.active {
  border-color: #10b981;
  background: #f0fdf4;
}

.network-icon img {
  width: 32px;
  height: 32px;
  border-radius: 50%;
}

.network-details {
  flex: 1;
}

.network-details .network-name {
  font-weight: 500;
  color: #111827;
  margin-bottom: 2px;
}

.network-chain-id {
  font-size: 12px;
  color: #6b7280;
}

.checkmark {
  color: #10b981;
  font-weight: 600;
  font-size: 18px;
}

.modal-footer {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
}

.network-help {
  font-size: 14px;
  color: #6b7280;
  text-align: center;
  margin: 0;
}

.auto-switch-notification {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1001;
  background: #fffbeb;
  border: 1px solid #f59e0b;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  max-width: 300px;
}

.notification-content {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #92400e;
}
</style>