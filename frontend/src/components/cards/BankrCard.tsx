'use client';

import React from 'react';
import { ArrowRight, Fuel, Wallet, CircleCheck, CircleX } from 'lucide-react';

interface BankrCardData {
  transactionSummary: {
    inputAmount: string;
    inputToken: string;
    outputAmount: string;
    outputToken: string;
  };
  route: string[]; // e.g., ["USDC", "Uniswap V3", "ETH", "Sushiswap", "WETH"]
  priceImpact?: number; // e.g., 0.015 for 1.5%
  feeEstimate: {
    gasCost: string;
    currency: string;
  };
  balanceBefore?: {
    token: string;
    amount: string;
  }[];
  balanceAfter?: {
    token: string;
    amount: string;
  }[];
  requiresApproval?: boolean;
}

interface BankrCardProps {
  data: BankrCardData;
}

const BankrCard: React.FC<BankrCardProps> = ({ data }) => {
  const formatPercentage = (value: number | undefined) => {
    if (value === undefined) return 'N/A';
    return `${(value * 100).toFixed(2)}%`;
  };

  return (
    <div className="glass-panel p-4 rounded-lg gradient-border flex flex-col gap-4">
      <h3 className="text-xl font-bold text-text-primary">Bankr Transaction</h3>

      {/* Transaction Summary */}
      <div className="glass-panel-subtle p-3 rounded-md flex items-center justify-center gap-2 text-text-primary text-lg font-semibold">
        <span>{data.transactionSummary.inputAmount} {data.transactionSummary.inputToken}</span>
        <ArrowRight size={20} className="text-accent-gold" />
        <span>{data.transactionSummary.outputAmount} {data.transactionSummary.outputToken}</span>
      </div>

      {/* Route Visualization */}
      {data.route && data.route.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 text-sm text-text-secondary">
          <span className="font-semibold text-text-primary">Route:</span>
          {data.route.map((hop, index) => (
            <React.Fragment key={index}>
              <span className="px-2 py-1 rounded-full bg-gray-700 text-white text-xs">{hop}</span>
              {index < data.route.length - 1 && <ArrowRight size={12} className="text-text-muted" />}
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Price Impact */}
      {data.priceImpact !== undefined && (
        <div className={`flex items-center gap-2 text-sm ${data.priceImpact > 0.01 ? 'text-red-500' : 'text-green-500'}`}>
          <span className="font-semibold text-text-primary">Price Impact:</span>
          <span>{formatPercentage(data.priceImpact)}</span>
          {data.priceImpact > 0.01 && <span className="text-red-500 font-bold">(Warning: High Impact!)</span>}
        </div>
      )}

      {/* Fee Estimate */}
      <div className="flex items-center gap-2 text-sm text-text-secondary">
        <Fuel size={16} className="text-accent-cyan" />
        <span className="font-semibold text-text-primary">Estimated Fee:</span>
        <span>{data.feeEstimate.gasCost} {data.feeEstimate.currency}</span>
      </div>

      {/* Balance Before/After */}
      {(data.balanceBefore || data.balanceAfter) && (
        <div className="glass-panel-subtle p-3 rounded-md flex flex-col md:flex-row justify-around gap-4 text-sm">
          {data.balanceBefore && (
            <div>
              <h4 className="font-semibold text-text-primary mb-1 flex items-center gap-1"><Wallet size={16} /> Balance Before:</h4>
              {data.balanceBefore.map((bal, index) => (
                <p key={index} className="text-text-secondary">{bal.amount} {bal.token}</p>
              ))}
            </div>
          )}
          {data.balanceAfter && (
            <div>
              <h4 className="font-semibold text-text-primary mb-1 flex items-center gap-1"><Wallet size={16} /> Balance After:</h4>
              {data.balanceAfter.map((bal, index) => (
                <p key={index} className="text-text-secondary">{bal.amount} {bal.token}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Approve/Reject Buttons */}
      {data.requiresApproval && (
        <div className="flex justify-around gap-4 mt-4">
          <button className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-md text-white font-semibold flex items-center justify-center gap-2">
            <CircleCheck size={20} /> Approve
          </button>
          <button className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-md text-white font-semibold flex items-center justify-center gap-2">
            <CircleX size={20} /> Reject
          </button>
        </div>
      )}
    </div>
  );
};

export default BankrCard;
