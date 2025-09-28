'use client';

import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { ZKRiskTransactionFlow, LendingFlowParams, TransactionStatus } from '../lib/transactionFlows';

interface DemoStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'active' | 'completed' | 'error';
  details?: string;
  hash?: string;
}

export default function EndToEndDemo() {
  const [transactionFlow, setTransactionFlow] = useState<ZKRiskTransactionFlow | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [currentAccount, setCurrentAccount] = useState<string>('');
  const [chainId, setChainId] = useState<number>(0);
  const [steps, setSteps] = useState<DemoStep[]>([
    {
      id: 'connect',
      title: '🔗 Connect Wallet',
      description: 'Connect to MetaMask and initialize the transaction flow',
      status: 'pending'
    },
    {
      id: 'zk-verify',
      title: '🛡️ ZK Identity Verification',
      description: 'Verify identity using Self Protocol zero-knowledge proofs',
      status: 'pending'
    },
    {
      id: 'ai-assessment',
      title: '🤖 AI Risk Assessment',
      description: 'Analyze market volatility using enhanced LSTM model',
      status: 'pending'
    },
    {
      id: 'deposit',
      title: '💰 Deposit Collateral',
      description: 'Deposit USDC as collateral for the loan',
      status: 'pending'
    },
    {
      id: 'borrow',
      title: '📊 Execute Borrow',
      description: 'Borrow USDC against collateral with AI-calculated risk',
      status: 'pending'
    }
  ]);

  const [lendingParams, setLendingParams] = useState<LendingFlowParams>({
    collateralAmount: '1000',
    borrowAmount: '800',
    duration: 30,
    collateralType: 'USDC',
    crossChain: false
  });

  const [vaultInfo, setVaultInfo] = useState<{
    collateralAmount: string;
    debtAmount: string;
    lastLambda: number;
    isZkVerified: boolean;
  } | null>(null);

  const [isExecuting, setIsExecuting] = useState(false);

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.listAccounts();

        if (accounts.length > 0) {
          const network = await provider.getNetwork();
          setIsConnected(true);
          setCurrentAccount(accounts[0].address);
          setChainId(Number(network.chainId));

          const flow = new ZKRiskTransactionFlow(provider, handleTransactionStatus);
          await flow.initialize();
          setTransactionFlow(flow);

          updateStepStatus('connect', 'completed', `Connected to ${accounts[0].address}`);

          // Load vault info
          await loadVaultInfo(flow);
        }
      } catch (error) {
        console.error('Connection check failed:', error);
      }
    }
  };

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert('Please install MetaMask');
      return;
    }

    try {
      updateStepStatus('connect', 'active', 'Connecting to MetaMask...');

      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send('eth_requestAccounts', []);

      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const network = await provider.getNetwork();

      setIsConnected(true);
      setCurrentAccount(address);
      setChainId(Number(network.chainId));

      const flow = new ZKRiskTransactionFlow(provider, handleTransactionStatus);
      await flow.initialize();
      setTransactionFlow(flow);

      updateStepStatus('connect', 'completed', `Connected to ${address}`);

      // Load vault info
      await loadVaultInfo(flow);

    } catch (error: any) {
      updateStepStatus('connect', 'error', error.message);
    }
  };

  const loadVaultInfo = async (flow: ZKRiskTransactionFlow) => {
    try {
      const info = await flow.getVaultInfo();
      setVaultInfo(info);
    } catch (error) {
      console.log('No existing vault found (expected for new users)');
    }
  };

  const handleTransactionStatus = (status: TransactionStatus) => {
    console.log('Transaction status:', status);

    // Map transaction steps to demo steps
    const stepMapping: Record<string, string> = {
      'ZK Verification': 'zk-verify',
      'AI Risk Assessment': 'ai-assessment',
      'Deposit Collateral': 'deposit',
      'Execute Borrow': 'borrow',
      'Cross-Chain Borrow': 'borrow'
    };

    const stepId = stepMapping[status.step];
    if (stepId) {
      updateStepStatus(
        stepId,
        status.status === 'pending' ? 'active' : status.status,
        status.message,
        status.hash
      );
    }
  };

  const updateStepStatus = (stepId: string, status: 'pending' | 'active' | 'completed' | 'error', details?: string, hash?: string) => {
    setSteps(prev => prev.map(step =>
      step.id === stepId
        ? { ...step, status, details, hash }
        : step
    ));
  };

  const executeCompleteFlow = async () => {
    if (!transactionFlow) {
      alert('Please connect wallet first');
      return;
    }

    setIsExecuting(true);

    try {
      // Reset step statuses
      setSteps(prev => prev.map(step =>
        step.id === 'connect'
          ? step
          : { ...step, status: 'pending', details: undefined, hash: undefined }
      ));

      const txHash = await transactionFlow.executeLendingFlow(lendingParams);

      console.log('🎉 Complete lending flow executed successfully!', txHash);

      // Reload vault info
      await loadVaultInfo(transactionFlow);

    } catch (error: any) {
      console.error('Flow execution failed:', error);
      alert(`Execution failed: ${error.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const executeMemeLoan = async () => {
    if (!transactionFlow) {
      alert('Please connect wallet first');
      return;
    }

    try {
      const txHash = await transactionFlow.createMemeLoan('1000', 30, 'Diamond Hands SHIB 💎🐕');
      alert(`Meme loan created! Transaction: ${txHash}`);
    } catch (error: any) {
      alert(`Meme loan failed: ${error.message}`);
    }
  };

  const repayLoan = async () => {
    if (!transactionFlow || !vaultInfo || vaultInfo.debtAmount === '0') {
      alert('No loan to repay');
      return;
    }

    try {
      const txHash = await transactionFlow.repayLoan(vaultInfo.debtAmount);
      alert(`Loan repaid! Transaction: ${txHash}`);
      await loadVaultInfo(transactionFlow);
    } catch (error: any) {
      alert(`Repayment failed: ${error.message}`);
    }
  };

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'completed': return '✅';
      case 'active': return '🔄';
      case 'error': return '❌';
      default: return '⏳';
    }
  };

  const getChainName = (chainId: number) => {
    switch (chainId) {
      case 31337: return 'Hardhat Local';
      case 80002: return 'Polygon Amoy';
      case 44787: return 'Celo Alfajores';
      default: return `Chain ${chainId}`;
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          🚀 zkRisk End-to-End Demo
        </h1>
        <p className="text-gray-600">
          Complete lending workflow with ZK proofs, AI risk assessment, and cross-chain messaging
        </p>
      </div>

      {/* Connection Status */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Connection Status</h3>
            {isConnected ? (
              <div className="text-sm text-gray-600">
                <p>Account: {currentAccount}</p>
                <p>Chain: {getChainName(chainId)}</p>
              </div>
            ) : (
              <p className="text-gray-500">Not connected</p>
            )}
          </div>

          {!isConnected && (
            <button
              onClick={connectWallet}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </div>

      {/* Current Vault Status */}
      {vaultInfo && (
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">💼 Current Vault Status</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Collateral</p>
              <p className="font-mono">{parseFloat(vaultInfo.collateralAmount).toFixed(2)} USDC</p>
            </div>
            <div>
              <p className="text-gray-600">Debt</p>
              <p className="font-mono">{parseFloat(vaultInfo.debtAmount).toFixed(2)} USDC</p>
            </div>
            <div>
              <p className="text-gray-600">Risk Multiplier</p>
              <p className="font-mono">{(vaultInfo.lastLambda / 1000).toFixed(3)}x</p>
            </div>
            <div>
              <p className="text-gray-600">ZK Verified</p>
              <p>{vaultInfo.isZkVerified ? '✅ Yes' : '❌ No'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Lending Parameters */}
      <div className="bg-white border border-gray-200 p-6 rounded-lg">
        <h3 className="text-xl font-semibold mb-4">📊 Lending Parameters</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Collateral Amount (USDC)
            </label>
            <input
              type="number"
              value={lendingParams.collateralAmount}
              onChange={(e) => setLendingParams(prev => ({ ...prev, collateralAmount: e.target.value }))}
              className="w-full p-2 border border-gray-300 rounded-md"
              disabled={isExecuting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Borrow Amount (USDC)
            </label>
            <input
              type="number"
              value={lendingParams.borrowAmount}
              onChange={(e) => setLendingParams(prev => ({ ...prev, borrowAmount: e.target.value }))}
              className="w-full p-2 border border-gray-300 rounded-md"
              disabled={isExecuting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Duration (days)
            </label>
            <input
              type="number"
              value={lendingParams.duration}
              onChange={(e) => setLendingParams(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
              className="w-full p-2 border border-gray-300 rounded-md"
              disabled={isExecuting}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center space-x-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={lendingParams.crossChain}
              onChange={(e) => setLendingParams(prev => ({
                ...prev,
                crossChain: e.target.checked,
                targetChain: e.target.checked ? 44787 : undefined
              }))}
              className="mr-2"
              disabled={isExecuting}
            />
            Enable Cross-Chain (to Celo)
          </label>
        </div>
      </div>

      {/* Execution Steps */}
      <div className="bg-white border border-gray-200 p-6 rounded-lg">
        <h3 className="text-xl font-semibold mb-4">⚡ Execution Steps</h3>

        <div className="space-y-4">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-start space-x-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-lg">
                {getStepIcon(step.status)}
              </div>

              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <h4 className="font-medium">{step.title}</h4>
                  <span className={`text-sm px-2 py-1 rounded-full ${
                    step.status === 'completed' ? 'bg-green-100 text-green-800' :
                    step.status === 'active' ? 'bg-blue-100 text-blue-800' :
                    step.status === 'error' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {step.status}
                  </span>
                </div>

                <p className="text-sm text-gray-600 mt-1">{step.description}</p>

                {step.details && (
                  <p className="text-sm text-blue-600 mt-1">{step.details}</p>
                )}

                {step.hash && (
                  <p className="text-xs font-mono text-gray-500 mt-1">
                    TX: {step.hash.substring(0, 10)}...{step.hash.substring(step.hash.length - 8)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-4">
          <button
            onClick={executeCompleteFlow}
            disabled={!isConnected || isExecuting}
            className={`px-6 py-3 rounded-lg font-medium ${
              !isConnected || isExecuting
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {isExecuting ? '🔄 Executing...' : '🚀 Execute Complete Flow'}
          </button>

          <button
            onClick={executeMemeLoan}
            disabled={!isConnected || isExecuting}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:text-gray-500"
          >
            🐕 Create SHIB Meme Loan
          </button>

          {vaultInfo && parseFloat(vaultInfo.debtAmount) > 0 && (
            <button
              onClick={repayLoan}
              disabled={!isConnected || isExecuting}
              className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-300 disabled:text-gray-500"
            >
              💰 Repay Loan
            </button>
          )}
        </div>
      </div>

      {/* Technical Details */}
      <div className="bg-gray-50 p-6 rounded-lg">
        <h3 className="text-xl font-semibold mb-4">🔧 Technical Integration</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium mb-2">✅ Integrated Components</h4>
            <ul className="text-sm space-y-1 text-gray-600">
              <li>• Real ZK-SNARK proofs via Self Protocol</li>
              <li>• Live AI risk assessment (LSTM model)</li>
              <li>• Pyth Network price oracles</li>
              <li>• Hyperlane cross-chain messaging</li>
              <li>• Production smart contracts</li>
              <li>• End-to-end transaction flows</li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium mb-2">🎯 Deployed Contracts</h4>
            <ul className="text-xs font-mono space-y-1 text-gray-600">
              <li>RealOracle: 0x5FbDB...aa3</li>
              <li>SelfBridge: 0xe7f17...512</li>
              <li>CrossChainLending: 0xCf7Ed...Fc9</li>
              <li>Loan: 0x5FC8d...707</li>
              <li>MemeLoan: 0x0165...b8F</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}