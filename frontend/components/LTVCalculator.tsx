'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, TrendingUp, Shield } from 'lucide-react'

interface LTVCalculatorProps {
  collateralAmount: number
  collateralPrice: number
  collateralSymbol: string
  borrowAmount: number
  liquidationThreshold?: number // Default 80%
  maxLTV?: number // Default 75%
  className?: string
  showDetails?: boolean
}

interface LTVData {
  currentLTV: number
  maxBorrowAmount: number
  liquidationPrice: number
  safetyMargin: number
  riskLevel: 'safe' | 'moderate' | 'high' | 'critical'
  timeToLiquidation?: string
}

export default function LTVCalculator({
  collateralAmount,
  collateralPrice,
  collateralSymbol,
  borrowAmount,
  liquidationThreshold = 80,
  maxLTV = 75,
  className = '',
  showDetails = true
}: LTVCalculatorProps) {
  const [ltvData, setLtvData] = useState<LTVData | null>(null)

  useEffect(() => {
    calculateLTV()
  }, [collateralAmount, collateralPrice, borrowAmount, liquidationThreshold, maxLTV])

  const calculateLTV = () => {
    if (collateralAmount <= 0 || collateralPrice <= 0) {
      setLtvData(null)
      return
    }

    const collateralValue = collateralAmount * collateralPrice
    const currentLTV = collateralValue > 0 ? (borrowAmount / collateralValue) * 100 : 0
    const maxBorrowAmount = (collateralValue * maxLTV) / 100
    const liquidationPrice = borrowAmount > 0 ? (borrowAmount * 100) / (collateralAmount * liquidationThreshold) : 0
    const safetyMargin = liquidationThreshold - currentLTV

    // Determine risk level
    let riskLevel: 'safe' | 'moderate' | 'high' | 'critical' = 'safe'
    if (currentLTV >= liquidationThreshold) {
      riskLevel = 'critical'
    } else if (currentLTV >= liquidationThreshold * 0.9) {
      riskLevel = 'high'
    } else if (currentLTV >= liquidationThreshold * 0.7) {
      riskLevel = 'moderate'
    }

    // Estimate time to liquidation (simplified)
    let timeToLiquidation: string | undefined
    if (riskLevel === 'high' || riskLevel === 'critical') {
      const priceDropNeeded = ((collateralPrice - liquidationPrice) / collateralPrice) * 100
      if (priceDropNeeded > 0) {
        if (priceDropNeeded < 5) timeToLiquidation = '< 1 hour'
        else if (priceDropNeeded < 15) timeToLiquidation = '< 24 hours'
        else if (priceDropNeeded < 30) timeToLiquidation = '< 1 week'
        else timeToLiquidation = '> 1 week'
      }
    }

    setLtvData({
      currentLTV,
      maxBorrowAmount,
      liquidationPrice,
      safetyMargin,
      riskLevel,
      timeToLiquidation
    })
  }

  const getLTVColor = (ltv: number) => {
    if (ltv >= liquidationThreshold) return 'text-red-400'
    if (ltv >= liquidationThreshold * 0.9) return 'text-orange-400'
    if (ltv >= liquidationThreshold * 0.7) return 'text-yellow-400'
    return 'text-green-400'
  }

  const getRiskBadgeStyle = (riskLevel: string) => {
    switch (riskLevel) {
      case 'critical':
        return 'bg-red-500/20 text-red-400 border-red-500/30'
      case 'high':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
      case 'moderate':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      default:
        return 'bg-green-500/20 text-green-400 border-green-500/30'
    }
  }

  const formatPrice = (price: number, symbol: string) => {
    if (symbol === 'SHIB' && price < 0.0001) {
      return price.toFixed(8)
    }
    return price.toFixed(4)
  }

  if (!ltvData) {
    return (
      <div className={`card border-slate-600 ${className}`}>
        <div className="text-center text-slate-400">
          Enter collateral details to calculate LTV
        </div>
      </div>
    )
  }

  return (
    <div className={`card border-slate-600 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg">Loan-to-Value Analysis</h3>
        <div className={`px-3 py-1 rounded-full text-xs font-medium border ${getRiskBadgeStyle(ltvData.riskLevel)}`}>
          {ltvData.riskLevel.toUpperCase()}
        </div>
      </div>

      {/* Main LTV Display */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="text-center">
          <div className={`text-3xl font-bold ${getLTVColor(ltvData.currentLTV)}`}>
            {ltvData.currentLTV.toFixed(1)}%
          </div>
          <div className="text-sm text-slate-400">Current LTV</div>
        </div>

        <div className="text-center">
          <div className="text-3xl font-bold text-slate-300">
            {maxLTV}%
          </div>
          <div className="text-sm text-slate-400">Max Safe LTV</div>
        </div>

        <div className="text-center">
          <div className="text-3xl font-bold text-red-400">
            {liquidationThreshold}%
          </div>
          <div className="text-sm text-slate-400">Liquidation LTV</div>
        </div>
      </div>

      {/* LTV Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-400">LTV Progress</span>
          <span className="text-sm text-slate-300">{ltvData.currentLTV.toFixed(1)}% of {liquidationThreshold}%</span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-3">
          <div className="relative h-3 rounded-full overflow-hidden">
            {/* Safe zone (0-70%) */}
            <div
              className="absolute left-0 top-0 h-full bg-green-500"
              style={{ width: `${Math.min((maxLTV * 0.7 / liquidationThreshold) * 100, 100)}%` }}
            />
            {/* Moderate zone (70-90%) */}
            <div
              className="absolute left-0 top-0 h-full bg-yellow-500"
              style={{
                left: `${(maxLTV * 0.7 / liquidationThreshold) * 100}%`,
                width: `${Math.min((maxLTV * 0.2 / liquidationThreshold) * 100, 100 - (maxLTV * 0.7 / liquidationThreshold) * 100)}%`
              }}
            />
            {/* High risk zone (90-100%) */}
            <div
              className="absolute left-0 top-0 h-full bg-red-500"
              style={{
                left: `${(maxLTV * 0.9 / liquidationThreshold) * 100}%`,
                width: `${Math.min((maxLTV * 0.1 / liquidationThreshold) * 100, 100 - (maxLTV * 0.9 / liquidationThreshold) * 100)}%`
              }}
            />
            {/* Current LTV indicator */}
            <div
              className="absolute top-0 w-1 h-full bg-white shadow-lg"
              style={{ left: `${Math.min((ltvData.currentLTV / liquidationThreshold) * 100, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {showDetails && (
        <>
          {/* Warning Messages */}
          {ltvData.riskLevel === 'critical' && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <span className="text-red-400 font-medium">LIQUIDATION RISK</span>
              </div>
              <div className="text-sm text-red-300 mt-1">
                Your position is at high risk of liquidation. Consider adding more collateral or repaying part of your loan.
              </div>
            </div>
          )}

          {ltvData.riskLevel === 'high' && (
            <div className="mb-4 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-orange-400" />
                <span className="text-orange-400 font-medium">HIGH RISK</span>
              </div>
              <div className="text-sm text-orange-300 mt-1">
                Your LTV is approaching dangerous levels. Monitor closely and consider reducing risk.
                {ltvData.timeToLiquidation && ` Est. time to liquidation: ${ltvData.timeToLiquidation}`}
              </div>
            </div>
          )}

          {/* Detailed Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-400">Collateral Value</span>
                <span className="text-slate-300">${(collateralAmount * collateralPrice).toLocaleString()}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-400">Borrowed Amount</span>
                <span className="text-slate-300">${borrowAmount.toLocaleString()}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-400">Max Borrow Available</span>
                <span className="text-green-400">
                  ${ltvData.maxBorrowAmount < 1
                    ? ltvData.maxBorrowAmount.toFixed(4)
                    : ltvData.maxBorrowAmount.toLocaleString()
                  }
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-400">Safety Margin</span>
                <span className={`${ltvData.safetyMargin > 10 ? 'text-green-400' : 'text-orange-400'}`}>
                  {ltvData.safetyMargin.toFixed(1)}%
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-400">Current {collateralSymbol} Price</span>
                <span className="text-slate-300">${formatPrice(collateralPrice, collateralSymbol)}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-400">Liquidation Price</span>
                <span className="text-red-400">${formatPrice(ltvData.liquidationPrice, collateralSymbol)}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-400">Price Drop to Liquidation</span>
                <span className="text-red-400">
                  {(((collateralPrice - ltvData.liquidationPrice) / collateralPrice) * 100).toFixed(1)}%
                </span>
              </div>

              {ltvData.timeToLiquidation && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Est. Time to Risk</span>
                  <span className="text-orange-400">{ltvData.timeToLiquidation}</span>
                </div>
              )}
            </div>
          </div>

          {/* Action Suggestions */}
          {ltvData.riskLevel !== 'safe' && (
            <div className="mt-4 p-3 bg-slate-800/50 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Shield className="w-4 h-4 text-blue-400" />
                <span className="text-blue-400 font-medium">Risk Management Suggestions</span>
              </div>
              <ul className="text-sm text-slate-300 space-y-1">
                {ltvData.currentLTV > maxLTV && (
                  <li>• Add more {collateralSymbol} collateral to reduce LTV below {maxLTV}%</li>
                )}
                {ltvData.safetyMargin < 10 && (
                  <li>• Repay part of your loan to increase safety margin</li>
                )}
                <li>• Set up price alerts for {collateralSymbol} near ${formatPrice(ltvData.liquidationPrice * 1.1, collateralSymbol)}</li>
                <li>• Consider hedging your position if expecting price volatility</li>
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}