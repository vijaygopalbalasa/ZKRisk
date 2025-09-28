'use client'

import { useState, useEffect, useCallback } from 'react'
import { Dog, Twitter, Shield, Zap, Award, ExternalLink } from 'lucide-react'
import { useAccount, useWriteContract, useReadContract, useWaitForTransactionReceipt } from 'wagmi'
import { formatEther, parseEther } from 'viem'
import { TOKEN_CONFIG } from '@/config/wagmi'
import { CONTRACT_ADDRESSES, CONTRACT_ABIS, getContractAddress } from '@/config/contracts'
import SelfProtocolModal from './SelfProtocolModal'

interface ShibLendingInterfaceProps {
  isConnected: boolean
  walletAddress: string | null
  shibPrice?: number
  lambda?: number
}

export default function ShibLendingInterface({ isConnected, walletAddress, shibPrice = 0.000025, lambda = 1.8 }: ShibLendingInterfaceProps) {
  const [shibAmount, setShibAmount] = useState('')
  const [usdcAmount, setUsdcAmount] = useState('')
  const [showInsurance, setShowInsurance] = useState(false)
  const [dogMeme, setDogMeme] = useState('Much collateral, very alpha!')
  const [showSelfModal, setShowSelfModal] = useState(false)
  const [isVerified, setIsVerified] = useState(false)
  const [nftMinted, setNftMinted] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [shibBalance, setShibBalance] = useState('0')
  const [transactionHashes, setTransactionHashes] = useState<{ [key: string]: `0x${string}` | undefined }>({})
  const [isMounted, setIsMounted] = useState(false)

  // All hooks must be called before any conditional returns
  const { address } = useAccount()

  // Contract addresses (these need to be calculated before hooks)
  const shibTokenAddress = getContractAddress('polygonAmoy', 'mockSHIB') as `0x${string}`
  const loanAddress = getContractAddress('polygonAmoy', 'loan') as `0x${string}`
  const insuranceAddress = getContractAddress('polygonAmoy', 'paperHandInsurance') as `0x${string}`

  // Read SHIB balance
  const { data: shibBalanceData } = useReadContract({
    address: shibTokenAddress,
    abi: CONTRACT_ABIS.MockERC20,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
    query: { enabled: !!address && isMounted }
  })

  // Read SHIB allowance for MemeLoan contract
  const { data: shibAllowance } = useReadContract({
    address: shibTokenAddress,
    abi: CONTRACT_ABIS.MockERC20,
    functionName: 'allowance',
    args: [address as `0x${string}`, loanAddress],
    query: { enabled: !!address && isMounted }
  })

  // Write contracts
  const { writeContract: writeApprove, data: approveHash } = useWriteContract()
  const { writeContract: writeDeposit, data: depositHash } = useWriteContract()
  const { writeContract: writeBorrow, data: borrowHash } = useWriteContract()
  const { writeContract: writeMintInsurance, data: insuranceHash } = useWriteContract()

  // Wait for transactions
  const { isLoading: isApproving } = useWaitForTransactionReceipt({ hash: approveHash })
  const { isLoading: isDepositing } = useWaitForTransactionReceipt({ hash: depositHash })
  const { isLoading: isBorrowing } = useWaitForTransactionReceipt({ hash: borrowHash })
  const { isLoading: isMintingInsurance } = useWaitForTransactionReceipt({ hash: insuranceHash })

  // All useEffect hooks must be before conditional returns
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Update transaction hashes
  useEffect(() => {
    if (approveHash) setTransactionHashes(prev => ({ ...prev, approve: approveHash }))
    if (depositHash) setTransactionHashes(prev => ({ ...prev, deposit: depositHash }))
    if (borrowHash) setTransactionHashes(prev => ({ ...prev, borrow: borrowHash }))
    if (insuranceHash) setTransactionHashes(prev => ({ ...prev, insurance: insuranceHash }))
  }, [approveHash, depositHash, borrowHash, insuranceHash])

  // Update SHIB balance display
  useEffect(() => {
    if (shibBalanceData) {
      setShibBalance(formatEther(shibBalanceData))
    }
  }, [shibBalanceData])

  // Explorer link helper
  const getExplorerLink = (hash: string) => `https://amoy.polygonscan.com/tx/${hash}`

  // Don't render until mounted on client
  if (!isMounted) {
    return (
      <div className="max-w-md mx-auto bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-slate-600 border-t-orange-400 rounded-full animate-spin"></div>
          <span className="ml-3 text-slate-400">Loading...</span>
        </div>
      </div>
    )
  }


  const handleLendingAction = async () => {
    if (!isVerified) {
      setShowSelfModal(true)
      return
    }

    if (!shibAmount || !address) return

    setIsProcessing(true)

    try {
      const shibAmountWei = parseEther(shibAmount)

      // Validate amounts
      if (shibAmountWei <= 0n) {
        alert('Please enter a valid SHIB amount')
        setIsProcessing(false)
        return
      }

      // For testing: just do a simple SHIB transfer to ourselves (since Loan contract doesn't exist)
      // No approval needed for transfers to ourselves
      writeDeposit({
        address: shibTokenAddress,
        abi: CONTRACT_ABIS.MockERC20,
        functionName: 'transfer',
        args: [address, shibAmountWei]
      })
    } catch (error) {
      setIsProcessing(false)
      alert('Transaction failed. Please try again.')
    }
  }

  const handleVerificationComplete = (verified: boolean) => {
    setIsVerified(verified)
    if (verified) {
      // Automatically proceed with lending
      setTimeout(() => {
        handleLendingAction()
      }, 500)
    }
  }

  // Calculate USDC amount based on SHIB input
  const calculateUSDC = (shibValue: string) => {
    if (!shibValue || isNaN(Number(shibValue)) || Number(shibValue) <= 0) {
      setUsdcAmount('')
      return
    }

    const shibNum = Number(shibValue)
    const collateralValue = shibNum * shibPrice
    const borrowableAmount = collateralValue / lambda
    setUsdcAmount(borrowableAmount.toFixed(6))
  }


  // Handle Twitter sharing
  const handleTwitterShare = () => {
    const text = nftMinted
      ? `Just minted my Paper-Hand Insurance NFT on zkRisk! "${dogMeme}" 🐕🛡️ Much protection, very wise! #zkRisk #DeFi #SHIB`
      : `Just used zkRisk for AI-powered under-collateralized lending with SHIB! 🚀 The future of DeFi is here! #zkRisk #DeFi #SHIB`

    const url = 'https://zkrisk.ai'
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`
    window.open(tweetUrl, '_blank')
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-full flex items-center justify-center">
            <Dog className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">SHIB Lending</h2>
            <p className="text-slate-400">Deposit SHIB, Borrow USDC</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-slate-400">Max LTV</div>
          <div className="text-2xl font-bold text-orange-400">{(lambda * 100).toFixed(0)}%</div>
          {isVerified && (
            <div className="flex items-center space-x-1 mt-1">
              <Shield className="w-4 h-4 text-green-400" />
              <span className="text-xs text-green-400">Verified</span>
            </div>
          )}
        </div>
      </div>

      {!isConnected ? (
        <div className="text-center py-8">
          <Dog className="w-16 h-16 text-slate-500 mx-auto mb-4" />
          <p className="text-slate-400">Connect your wallet to start lending with SHIB!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Collateral Input */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Collateral (SHIB)</label>
              <div className="flex items-center space-x-2 text-sm text-slate-400">
                <img
                  src={TOKEN_CONFIG.SHIB.icon}
                  alt="SHIB"
                  className="w-4 h-4 rounded-full"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
                <span>Balance: {Number(shibBalance).toLocaleString()} SHIB</span>
              </div>
            </div>
            <div className="relative">
              <input
                type="number"
                value={shibAmount}
                onChange={(e) => {
                  setShibAmount(e.target.value)
                  calculateUSDC(e.target.value)
                }}
                placeholder="0.00"
                className="w-full p-4 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 pr-16"
              />
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400">
                SHIB
              </div>
            </div>
          </div>

          {/* Borrow Amount */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Borrow (USDC)</label>
              <div className="flex items-center space-x-2 text-sm text-slate-400">
                <img
                  src={TOKEN_CONFIG.USDC.icon}
                  alt="USDC"
                  className="w-4 h-4 rounded-full"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
                <span>Auto-calculated borrowable amount</span>
              </div>
            </div>
            <div className="relative">
              <input
                type="number"
                value={usdcAmount}
                readOnly
                placeholder="0.00"
                className="w-full p-4 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 pr-16 cursor-not-allowed"
              />
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400">
                USDC
              </div>
            </div>
          </div>

          {/* Paper-Hand Insurance */}
          <div className="border border-slate-600 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Shield className="w-5 h-5 text-blue-400" />
                <span className="font-medium">Paper-Hand Insurance NFT</span>
              </div>
              <button
                onClick={() => setShowInsurance(!showInsurance)}
                className="text-blue-400 hover:text-blue-300 text-sm"
              >
                {showInsurance ? 'Hide' : 'Show'}
              </button>
            </div>

            {showInsurance && (
              <div className="space-y-3">
                <p className="text-sm text-slate-400">
                  Protect yourself from SHIB volatility! Get an NFT that pays out if SHIB drops &gt;20%.
                </p>
                <div>
                  <label className="text-sm text-slate-300 block mb-1">Dog Meme Text</label>
                  <input
                    type="text"
                    value={dogMeme}
                    onChange={(e) => setDogMeme(e.target.value)}
                    placeholder="Such protection, very wise, wow"
                    className="w-full p-2 bg-slate-700/50 border border-slate-600 rounded text-white placeholder-slate-400 text-sm"
                  />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Insurance Fee:</span>
                  <span className="text-orange-400 font-medium">1% of loan</span>
                </div>
              </div>
            )}
          </div>

          {/* Transaction Status */}
          {Object.entries(transactionHashes).some(([_, hash]) => hash) && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <div className="font-medium text-blue-300 mb-2">Transaction Status</div>
              <div className="space-y-1">
                {transactionHashes.approve && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">🔓 Approval:</span>
                    <a
                      href={getExplorerLink(transactionHashes.approve)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 flex items-center space-x-1"
                    >
                      <span>{transactionHashes.approve.slice(0, 8)}...{transactionHashes.approve.slice(-6)}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
                {transactionHashes.deposit && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">🏦 Deposit:</span>
                    <a
                      href={getExplorerLink(transactionHashes.deposit)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 flex items-center space-x-1"
                    >
                      <span>{transactionHashes.deposit.slice(0, 8)}...{transactionHashes.deposit.slice(-6)}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
                {transactionHashes.borrow && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">💸 Borrow:</span>
                    <a
                      href={getExplorerLink(transactionHashes.borrow)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 flex items-center space-x-1"
                    >
                      <span>{transactionHashes.borrow.slice(0, 8)}...{transactionHashes.borrow.slice(-6)}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
                {transactionHashes.insurance && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">🛡️ Insurance:</span>
                    <a
                      href={getExplorerLink(transactionHashes.insurance)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 flex items-center space-x-1"
                    >
                      <span>{transactionHashes.insurance.slice(0, 8)}...{transactionHashes.insurance.slice(-6)}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={handleLendingAction}
              disabled={!shibAmount || !usdcAmount || isProcessing || isApproving || isDepositing || isBorrowing}
              className="w-full btn-primary flex items-center justify-center space-x-2"
            >
              {(isProcessing || isApproving || isDepositing || isBorrowing) ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>
                    {isApproving && 'Approving SHIB...'}
                    {isDepositing && 'Depositing Collateral...'}
                    {isBorrowing && 'Borrowing USDC...'}
                    {isProcessing && !isApproving && !isDepositing && !isBorrowing && 'Processing...'}
                  </span>
                </>
              ) : !isVerified ? (
                <>
                  <Shield className="w-5 h-5" />
                  <span>Verify Identity & Lend</span>
                </>
              ) : (
                <>
                  <Dog className="w-5 h-5" />
                  <span>Test SHIB Transfer</span>
                </>
              )}
            </button>

            <button
              onClick={handleTwitterShare}
              className="w-full btn-secondary flex items-center justify-center space-x-2"
            >
              <Twitter className="w-5 h-5" />
              <span>Share on Twitter</span>
            </button>
          </div>

          {/* Loan Stats */}
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="bg-slate-700/30 rounded-lg p-3">
              <div className="text-sm text-slate-400">Liquidation Price</div>
              <div className="text-lg font-bold text-red-400">$0.0000125</div>
            </div>
            <div className="bg-slate-700/30 rounded-lg p-3">
              <div className="text-sm text-slate-400">Interest Rate</div>
              <div className="text-lg font-bold text-green-400">0.1% APR</div>
            </div>
          </div>

          {/* Memecoin Warning */}
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Zap className="w-5 h-5 text-orange-400 mt-0.5" />
              <div>
                <div className="font-medium text-orange-300">Memecoin Risk Warning</div>
                <p className="text-sm text-orange-200/80 mt-1">
                  SHIB is highly volatile. Consider Paper-Hand Insurance to protect against sudden price drops.
                  Much risk, very important to understand!
                </p>
              </div>
            </div>
          </div>

          {/* NFT Display */}
          {nftMinted && (
            <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-lg p-4 animate-scale-in">
              <div className="flex items-center space-x-3 mb-3">
                <Award className="w-6 h-6 text-purple-400" />
                <div>
                  <div className="font-bold text-purple-300">Paper-Hand Insurance NFT Minted!</div>
                  <div className="text-sm text-purple-400">Much protection, very wise!</div>
                </div>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3 mb-3">
                <div className="text-center">
                  <div className="text-4xl mb-2">🐕🛡️</div>
                  <div className="font-bold text-sm">"{dogMeme}"</div>
                  <div className="text-xs text-slate-400 mt-1">Paper-Hand Insurance #1337</div>
                </div>
              </div>
              <button
                onClick={handleTwitterShare}
                className="w-full btn-secondary flex items-center justify-center space-x-2"
              >
                <Twitter className="w-4 h-4" />
                <span>Share NFT on Twitter</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Self Protocol Modal */}
      <SelfProtocolModal
        isOpen={showSelfModal}
        onClose={() => setShowSelfModal(false)}
        onVerificationComplete={handleVerificationComplete}
        walletAddress={walletAddress || undefined}
      />
    </div>
  )
}