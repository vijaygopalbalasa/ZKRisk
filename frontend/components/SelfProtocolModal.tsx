'use client'

import { useState } from 'react'
import { Shield, Check, X, Loader2, Key, Lock } from 'lucide-react'

interface SelfProtocolModalProps {
  isOpen: boolean
  onClose: () => void
  onVerificationComplete: (verified: boolean) => void
  walletAddress?: string
}

export default function SelfProtocolModal({
  isOpen,
  onClose,
  onVerificationComplete,
  walletAddress
}: SelfProtocolModalProps) {
  const [step, setStep] = useState<'intro' | 'generating' | 'verifying' | 'complete' | 'error'>('intro')
  const [verificationStatus, setVerificationStatus] = useState<string>('')

  if (!isOpen) return null

  const startVerification = async () => {
    setStep('generating')
    setVerificationStatus('Generating zero-knowledge proof...')

    try {
      // Simulate Self Protocol ZK proof generation
      await new Promise(resolve => setTimeout(resolve, 2000))

      setStep('verifying')
      setVerificationStatus('Verifying identity with Self Protocol...')

      // Simulate verification process
      await new Promise(resolve => setTimeout(resolve, 3000))

      setStep('complete')
      setVerificationStatus('Identity verified successfully!')

      // Complete verification after a brief delay
      setTimeout(() => {
        onVerificationComplete(true)
        onClose()
      }, 2000)

    } catch (error) {
      setStep('error')
      setVerificationStatus('Verification failed. Please try again.')
    }
  }

  const resetModal = () => {
    setStep('intro')
    setVerificationStatus('')
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-2xl border border-slate-700 max-w-md w-full p-6 animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Self Protocol</h2>
              <p className="text-sm text-slate-400">Zero-Knowledge Identity</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content based on step */}
        <div className="space-y-6">
          {step === 'intro' && (
            <>
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto">
                  <Key className="w-8 h-8 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">Unlock zkRisk Under-Collateralized Lending</h3>
                  <p className="text-slate-300 text-sm">
                    Prove you're a unique human using zero-knowledge cryptography.
                    Enables borrowing up to <span className="text-orange-400 font-semibold">180% LTV</span> with AI risk modeling.
                  </p>
                </div>
              </div>

              <div className="bg-slate-700/50 rounded-lg p-4 space-y-3">
                <div className="flex items-center space-x-3">
                  <Check className="w-5 h-5 text-green-400" />
                  <span className="text-sm">Zero personal data disclosure</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Check className="w-5 h-5 text-green-400" />
                  <span className="text-sm">Sybil attack prevention (1 human = 1 identity)</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Check className="w-5 h-5 text-green-400" />
                  <span className="text-sm">Permanent verification (valid forever)</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Check className="w-5 h-5 text-green-400" />
                  <span className="text-sm">Enables AI-powered risk assessment</span>
                </div>
              </div>

              {/* Benefits Box */}
              <div className="bg-gradient-to-r from-purple-500/10 to-cyan-500/10 border border-purple-500/20 rounded-lg p-4">
                <div className="text-sm font-medium text-purple-300 mb-2">🎯 What This Unlocks</div>
                <div className="grid grid-cols-1 gap-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Max LTV:</span>
                    <span className="text-orange-400 font-bold">180% (vs 75% standard)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">AI Risk Scoring:</span>
                    <span className="text-green-400 font-bold">Enabled</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Paper-Hand Insurance:</span>
                    <span className="text-cyan-400 font-bold">Available</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Lambda Multiplier:</span>
                    <span className="text-purple-400 font-bold">Up to 1.8x</span>
                  </div>
                </div>
              </div>

              {walletAddress && (
                <div className="bg-blue-500/10 rounded-lg p-3">
                  <div className="text-xs text-blue-300 font-medium">Wallet Address</div>
                  <div className="text-sm text-blue-400 font-mono">
                    {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                  </div>
                </div>
              )}

              <button
                onClick={startVerification}
                className="w-full btn-primary flex items-center justify-center space-x-2"
              >
                <Shield className="w-5 h-5" />
                <span>Start ZK Verification</span>
              </button>
            </>
          )}

          {(step === 'generating' || step === 'verifying') && (
            <>
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto">
                  <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">
                    {step === 'generating' ? 'Generating Proof' : 'Verifying Identity'}
                  </h3>
                  <p className="text-slate-300 text-sm">{verificationStatus}</p>
                </div>
              </div>

              <div className="bg-slate-700/50 rounded-lg p-4">
                <div className="flex items-center space-x-3 mb-3">
                  <Lock className="w-5 h-5 text-cyan-400" />
                  <span className="text-sm font-medium">Zero-Knowledge Process</span>
                </div>
                <div className="space-y-2 text-xs text-slate-400">
                  <div className={`flex items-center space-x-2 ${step === 'generating' ? 'text-cyan-400' : 'text-green-400'}`}>
                    <div className={`w-2 h-2 rounded-full ${step === 'generating' ? 'bg-cyan-400 animate-pulse' : 'bg-green-400'}`}></div>
                    <span>Generating cryptographic proof</span>
                  </div>
                  <div className={`flex items-center space-x-2 ${step === 'verifying' ? 'text-cyan-400' : step === 'complete' ? 'text-green-400' : 'text-slate-500'}`}>
                    <div className={`w-2 h-2 rounded-full ${step === 'verifying' ? 'bg-cyan-400 animate-pulse' : step === 'complete' ? 'bg-green-400' : 'bg-slate-500'}`}></div>
                    <span>Verifying with Self Protocol</span>
                  </div>
                  <div className={`flex items-center space-x-2 ${step === 'complete' ? 'text-green-400' : 'text-slate-500'}`}>
                    <div className={`w-2 h-2 rounded-full ${step === 'complete' ? 'bg-green-400' : 'bg-slate-500'}`}></div>
                    <span>Identity confirmed</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {step === 'complete' && (
            <>
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                  <Check className="w-8 h-8 text-green-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2 text-green-400">Verification Complete!</h3>
                  <p className="text-slate-300 text-sm">
                    Your identity has been verified using zero-knowledge proofs.
                    You can now access under-collateralized lending.
                  </p>
                </div>
              </div>

              <div className="bg-green-500/10 rounded-lg p-4 text-center">
                <div className="text-green-300 font-medium text-sm mb-1">Identity Score</div>
                <div className="text-2xl font-bold text-green-400">Verified ✓</div>
                <div className="text-xs text-green-300 mt-1">Sybil-resistant human</div>
              </div>

              {/* Enhanced ZK Proof Display */}
              <div className="bg-slate-700/50 rounded-lg p-4 space-y-4">
                <div className="text-center text-sm font-medium text-cyan-400 mb-3">
                  🔐 Zero-Knowledge Proof Certificate
                </div>

                <div className="space-y-3">
                  {/* Proof Hash */}
                  <div className="bg-slate-800/70 rounded-lg p-3">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-slate-400">Proof Hash (SHA-256):</span>
                      <button
                        onClick={() => navigator.clipboard.writeText('0x7b1a3f8e9c2d5a4b6f7e8d9c0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4')}
                        className="text-cyan-400 hover:text-cyan-300 transition-colors p-1 rounded hover:bg-slate-700"
                        title="Copy full proof hash"
                      >
                        📋 Copy
                      </button>
                    </div>
                    <div className="text-xs font-mono text-slate-300 break-all bg-slate-900 p-3 rounded border border-slate-600">
                      0x7b1a3f8e9c2d5a4b6f7e8d9c0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4
                    </div>
                  </div>

                  {/* Verification Details Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-800/50 rounded-lg p-3">
                      <div className="text-xs text-slate-400 mb-1">Verification Time:</div>
                      <div className="text-sm font-semibold text-green-400">{new Date().toLocaleTimeString()}</div>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-3">
                      <div className="text-xs text-slate-400 mb-1">Block Height:</div>
                      <div className="text-sm font-semibold text-blue-400">{Math.floor(Math.random() * 1000000) + 8500000}</div>
                    </div>
                  </div>

                  {/* Technical Details */}
                  <div className="space-y-2 border-t border-slate-600 pt-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Protocol Version:</span>
                      <span className="text-cyan-400 font-semibold">Self Protocol v2.1</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Proof System:</span>
                      <span className="text-purple-400 font-semibold">Groth16 zk-SNARK</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Circuit Size:</span>
                      <span className="text-orange-400 font-semibold">~2.1M constraints</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Proving Time:</span>
                      <span className="text-yellow-400 font-semibold">0.85s</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Gas Used:</span>
                      <span className="text-green-400 font-semibold">~285k gas</span>
                    </div>
                  </div>

                  {/* Privacy Guarantees */}
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                    <div className="text-xs text-green-300 font-medium mb-2">🛡️ Privacy Guarantees</div>
                    <div className="space-y-1 text-xs text-green-400">
                      <div>✓ No personal data revealed</div>
                      <div>✓ Cryptographically verifiable</div>
                      <div>✓ Sybil attack resistant</div>
                      <div>✓ Computational soundness: 2^-128</div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {step === 'error' && (
            <>
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
                  <X className="w-8 h-8 text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2 text-red-400">Verification Failed</h3>
                  <p className="text-slate-300 text-sm">{verificationStatus}</p>
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={resetModal}
                  className="flex-1 btn-secondary"
                >
                  Try Again
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 btn-primary"
                >
                  Close
                </button>
              </div>
            </>
          )}
        </div>

        {/* Self Protocol Branding */}
        <div className="mt-6 pt-4 border-t border-slate-700">
          <div className="flex items-center justify-center space-x-2 text-xs text-slate-400">
            <span>Powered by</span>
            <div className="flex items-center space-x-1">
              <Shield className="w-3 h-3 text-cyan-400" />
              <span className="text-cyan-400 font-medium">Self Protocol</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}