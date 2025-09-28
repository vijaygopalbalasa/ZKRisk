import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { hyperlaneMessenger, HyperlaneUtils, LendingMessage } from '../lib/hyperlane';
import { getProvider, SUPPORTED_NETWORKS, NETWORK_NAMES } from '../config/wagmi';

interface CrossChainLendingProps {
  userAddress?: string;
  currentChain?: number;
}

interface CrossChainRequest {
  id: string;
  borrower: string;
  amount: string;
  duration: number;
  lambdaRisk: number;
  targetChain: number;
  status: 'pending' | 'matched' | 'rejected';
  timestamp: number;
}

interface MessageStatus {
  messageId: string;
  sent: boolean;
  delivered: boolean;
  timestamp?: number;
}

const CrossChainLending: React.FC<CrossChainLendingProps> = ({
  userAddress,
  currentChain = SUPPORTED_NETWORKS.POLYGON_AMOY
}) => {
  // State management
  const [isConnected, setIsConnected] = useState(false);
  const [crossChainRequests, setCrossChainRequests] = useState<CrossChainRequest[]>([]);
  const [pendingMessages, setPendingMessages] = useState<MessageStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state for creating cross-chain requests
  const [loanAmount, setLoanAmount] = useState('');
  const [loanDuration, setLoanDuration] = useState('30'); // days
  const [targetChain, setTargetChain] = useState(SUPPORTED_NETWORKS.CELO_ALFAJORES);
  const [collateralHash, setCollateralHash] = useState('');
  const [verificationProof, setVerificationProof] = useState('');

  // Initialize Hyperlane messenger
  useEffect(() => {
    const initializeHyperlane = async () => {
      try {
        if (userAddress) {
          await hyperlaneMessenger.connect();
          setIsConnected(true);

          // Start listening for incoming messages
          await hyperlaneMessenger.listenForIncomingMessages(
            currentChain,
            userAddress,
            handleIncomingMessage
          );

          console.log('🌉 Hyperlane cross-chain messaging initialized');
        }
      } catch (error) {
        console.error('❌ Failed to initialize Hyperlane:', error);
        setError('Failed to initialize cross-chain messaging');
      }
    };

    initializeHyperlane();
  }, [userAddress, currentChain]);

  // Handle incoming cross-chain messages
  const handleIncomingMessage = useCallback((message: LendingMessage, messageId: string) => {
    console.log('📨 Received cross-chain message:', message);

    // Update UI based on message type
    switch (message.messageType) {
      case 'LOAN_REQUEST':
        // Add new lending request to the list
        const newRequest: CrossChainRequest = {
          id: messageId,
          borrower: message.borrower,
          amount: message.amount,
          duration: 30, // Default duration
          lambdaRisk: message.lambdaValue,
          targetChain: currentChain,
          status: 'pending',
          timestamp: Date.now()
        };
        setCrossChainRequests(prev => [...prev, newRequest]);
        break;

      case 'LOAN_APPROVAL':
        // Update request status to matched
        setCrossChainRequests(prev =>
          prev.map(req =>
            req.id === messageId
              ? { ...req, status: 'matched' }
              : req
          )
        );
        break;

      case 'VERIFICATION_SYNC':
        console.log('✅ Verification synced across chains');
        break;

      case 'LIQUIDATION_ALERT':
        console.log('⚠️ Liquidation alert received');
        break;
    }
  }, [currentChain]);

  // Create cross-chain lending request
  const createCrossChainRequest = async () => {
    if (!isConnected || !userAddress) {
      setError('Please connect your wallet first');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Validate inputs
      if (!loanAmount || parseFloat(loanAmount) <= 0) {
        throw new Error('Invalid loan amount');
      }

      if (!verificationProof) {
        throw new Error('Self Protocol verification required');
      }

      // Get AI risk assessment from Fluence
      const aiResponse = await fetch(`http://localhost:5001/infer?symbol=SHIB/USD`);
      const aiData = await aiResponse.json();
      const lambdaRisk = aiData.lambda1000; // Lambda * 1000

      // Calculate recipient address (cross-chain lending contract)
      const recipientAddress = '0xCrossChainLendingContract'; // Would be actual deployed address

      // Create lending message
      const lendingMessage: LendingMessage = {
        borrower: userAddress,
        lender: ethers.ZeroAddress, // To be filled by matching lender
        amount: loanAmount,
        collateralHash: collateralHash || ethers.keccak256(ethers.toUtf8Bytes(`collateral_${Date.now()}`)),
        lambdaValue: lambdaRisk,
        verificationProof: verificationProof,
        messageType: 'LOAN_REQUEST'
      };

      // Send cross-chain message
      const messageId = await hyperlaneMessenger.sendLendingMessage(
        targetChain,
        recipientAddress,
        lendingMessage
      );

      // Add to pending messages
      const newMessage: MessageStatus = {
        messageId,
        sent: true,
        delivered: false,
        timestamp: Date.now()
      };
      setPendingMessages(prev => [...prev, newMessage]);

      // Add to local requests
      const newRequest: CrossChainRequest = {
        id: messageId,
        borrower: userAddress,
        amount: loanAmount,
        duration: parseInt(loanDuration),
        lambdaRisk,
        targetChain,
        status: 'pending',
        timestamp: Date.now()
      };
      setCrossChainRequests(prev => [...prev, newRequest]);

      // Reset form
      setLoanAmount('');
      setCollateralHash('');
      setVerificationProof('');

      console.log(`✅ Cross-chain lending request sent: ${messageId}`);

    } catch (error) {
      console.error('❌ Failed to create cross-chain request:', error);
      setError(error instanceof Error ? error.message : 'Failed to create request');
    } finally {
      setLoading(false);
    }
  };

  // Check message delivery status
  const checkMessageStatus = async (messageId: string) => {
    try {
      const status = await hyperlaneMessenger.getMessageStatus(
        currentChain,
        targetChain,
        messageId
      );

      setPendingMessages(prev =>
        prev.map(msg =>
          msg.messageId === messageId
            ? { ...msg, delivered: status.delivered, timestamp: status.timestamp }
            : msg
        )
      );

    } catch (error) {
      console.error('❌ Failed to check message status:', error);
    }
  };

  // Sync Self Protocol verification across chains
  const syncVerificationAcrossChains = async () => {
    if (!userAddress || !verificationProof) {
      setError('Verification proof required');
      return;
    }

    try {
      setLoading(true);

      const messageId = await hyperlaneMessenger.syncVerificationAcrossChains(
        targetChain,
        userAddress,
        verificationProof,
        { ageVerified: true, countryVerified: true }
      );

      console.log(`✅ Verification synced across chains: ${messageId}`);

    } catch (error) {
      console.error('❌ Failed to sync verification:', error);
      setError('Failed to sync verification');
    } finally {
      setLoading(false);
    }
  };

  // Match a cross-chain lending request (as lender)
  const matchLendingRequest = async (requestId: string) => {
    try {
      setLoading(true);

      // Find the request
      const request = crossChainRequests.find(req => req.id === requestId);
      if (!request) {
        throw new Error('Request not found');
      }

      // Send loan approval message
      const lendingMessage: LendingMessage = {
        borrower: request.borrower,
        lender: userAddress!,
        amount: request.amount,
        collateralHash: ethers.ZeroHash,
        lambdaValue: request.lambdaRisk,
        verificationProof: '',
        messageType: 'LOAN_APPROVAL'
      };

      const messageId = await hyperlaneMessenger.sendLendingMessage(
        request.targetChain,
        request.borrower, // Send back to borrower
        lendingMessage
      );

      // Update request status
      setCrossChainRequests(prev =>
        prev.map(req =>
          req.id === requestId
            ? { ...req, status: 'matched' }
            : req
        )
      );

      console.log(`✅ Matched lending request: ${messageId}`);

    } catch (error) {
      console.error('❌ Failed to match request:', error);
      setError('Failed to match lending request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white">
        <h2 className="text-2xl font-bold mb-2">🌉 Cross-Chain Lending</h2>
        <p className="text-blue-100">
          Lend and borrow across Polygon and Celo using Hyperlane messaging
        </p>
        {isConnected && (
          <div className="mt-2 text-sm">
            <span className="bg-green-500 px-2 py-1 rounded">Connected</span>
            <span className="ml-2">Current Chain: {NETWORK_NAMES[currentChain]}</span>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
          <button
            onClick={() => setError(null)}
            className="float-right font-bold text-red-700 hover:text-red-900"
          >
            ×
          </button>
        </div>
      )}

      {/* Create Cross-Chain Request */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-semibold mb-4">📨 Create Cross-Chain Lending Request</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Loan Amount (USDC)
            </label>
            <input
              type="number"
              value={loanAmount}
              onChange={(e) => setLoanAmount(e.target.value)}
              placeholder="1000"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Duration (days)
            </label>
            <select
              value={loanDuration}
              onChange={(e) => setLoanDuration(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="7">7 days</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
              <option value="365">1 year</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Chain
            </label>
            <select
              value={targetChain}
              onChange={(e) => setTargetChain(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.entries(SUPPORTED_NETWORKS)
                .filter(([_, chainId]) => chainId !== currentChain)
                .map(([name, chainId]) => (
                  <option key={chainId} value={chainId}>
                    {NETWORK_NAMES[chainId]}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Self Protocol Verification Proof
            </label>
            <input
              type="text"
              value={verificationProof}
              onChange={(e) => setVerificationProof(e.target.value)}
              placeholder="0x..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="mt-6 flex space-x-4">
          <button
            onClick={createCrossChainRequest}
            disabled={loading || !isConnected}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Creating...
              </>
            ) : (
              '📨 Create Request'
            )}
          </button>

          <button
            onClick={syncVerificationAcrossChains}
            disabled={loading || !verificationProof}
            className="bg-purple-600 text-white px-6 py-2 rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            🔄 Sync Verification
          </button>
        </div>
      </div>

      {/* Cross-Chain Requests */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-semibold mb-4">📋 Cross-Chain Requests</h3>

        {crossChainRequests.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No cross-chain requests yet</p>
        ) : (
          <div className="space-y-4">
            {crossChainRequests.map((request) => (
              <div
                key={request.id}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="font-medium">
                        {request.amount} USDC
                      </span>
                      <span className={`px-2 py-1 rounded text-xs ${
                        request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        request.status === 'matched' ? 'bg-green-100 text-green-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {request.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="text-sm text-gray-600 space-y-1">
                      <p>Borrower: {request.borrower.slice(0, 8)}...{request.borrower.slice(-6)}</p>
                      <p>Duration: {request.duration} days</p>
                      <p>Risk (λ): {(request.lambdaRisk / 1000).toFixed(3)}x</p>
                      <p>Target: {NETWORK_NAMES[request.targetChain]}</p>
                      <p>Created: {new Date(request.timestamp).toLocaleString()}</p>
                    </div>
                  </div>

                  {request.status === 'pending' && request.borrower !== userAddress && (
                    <button
                      onClick={() => matchLendingRequest(request.id)}
                      disabled={loading}
                      className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:bg-gray-400 text-sm"
                    >
                      Match Request
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Message Status */}
      {pendingMessages.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-semibold mb-4">📊 Message Status</h3>

          <div className="space-y-3">
            {pendingMessages.map((message) => (
              <div key={message.messageId} className="flex items-center justify-between p-3 border border-gray-200 rounded">
                <div>
                  <p className="font-medium text-sm">
                    {HyperlaneUtils.formatMessageId(message.messageId)}
                  </p>
                  <div className="flex items-center space-x-4 text-xs text-gray-600">
                    <span className={message.sent ? 'text-green-600' : 'text-gray-400'}>
                      {message.sent ? '✅ Sent' : '⏳ Sending...'}
                    </span>
                    <span className={message.delivered ? 'text-green-600' : 'text-yellow-600'}>
                      {message.delivered ? '✅ Delivered' : '⏳ In Transit'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => checkMessageStatus(message.messageId)}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  🔄 Check Status
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Network Info */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium mb-2">🌐 Supported Networks</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          {Object.entries(SUPPORTED_NETWORKS).map(([name, chainId]) => (
            <div key={chainId} className="flex items-center justify-between">
              <span>{NETWORK_NAMES[chainId]}</span>
              <span className={`px-2 py-1 rounded text-xs ${
                HyperlaneUtils.isChainSupported(chainId)
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {HyperlaneUtils.isChainSupported(chainId) ? 'Supported' : 'Unsupported'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CrossChainLending;