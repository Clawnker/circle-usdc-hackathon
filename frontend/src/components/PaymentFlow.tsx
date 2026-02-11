'use client';
import { Transaction, TransactionButton, TransactionStatus } from '@coinbase/onchainkit/transaction';
import { useAccount } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

// USDC contract on Base Sepolia
const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const TREASURY_ADDRESS = '0x676fF3d546932dE6558a267887E58e39f405B135';

interface PaymentFlowProps {
  specialistId: string;
  fee: number; // in USD
  onPaymentComplete: (txHash: string) => void;
  onCancel: () => void;
  recipientAddress?: string; // Custom recipient for transfers (default: treasury)
}

export function PaymentFlow({ specialistId, fee, onPaymentComplete, onCancel, recipientAddress }: PaymentFlowProps) {
  const { address, isConnected } = useAccount();
  
  const recipient = recipientAddress || TREASURY_ADDRESS;
  
  if (!isConnected) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="glass-panel p-6 max-w-sm w-full text-center">
          <h3 className="text-xl font-bold mb-4">Connection Required</h3>
          <p className="text-[var(--text-secondary)] mb-6">Please connect your wallet to proceed with the payment.</p>
          <button 
            onClick={onCancel}
            className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors font-bold"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ERC-20 transfer call
  const calls = [{
    to: USDC_ADDRESS as `0x${string}`,
    data: encodeTransferCall(recipient, fee),
  }];

  const isTransfer = !!recipientAddress;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-panel p-6 max-w-md w-full relative"
      >
        <button 
          onClick={onCancel}
          className="absolute top-4 right-4 p-1 rounded-full hover:bg-white/10 transition-colors"
        >
          <X size={20} />
        </button>

        <h3 className="text-xl font-bold mb-2">{isTransfer ? 'Confirm Transfer' : 'Payment Required'}</h3>
        <p className="text-[var(--text-secondary)] mb-2">
          {isTransfer ? (
            <>Send <span className="text-white font-bold">{fee} USDC</span> to</>
          ) : (
            <>To query the <span className="text-[var(--accent-gold)] font-bold">{specialistId}</span>, a payment of <span className="text-white font-bold">{fee} USDC</span> is required.</>
          )}
        </p>
        {isTransfer && (
          <p className="text-xs text-[var(--text-muted)] font-mono mb-4 break-all">
            {recipientAddress}
          </p>
        )}
        <p className="text-xs text-[var(--text-muted)] mb-6">
          Network: Base Sepolia
        </p>
        
        <div className="space-y-4">
          <Transaction
            chainId={baseSepolia.id}
            calls={calls}
            onSuccess={(response) => {
              if (response.transactionReceipts[0]) {
                onPaymentComplete(response.transactionReceipts[0].transactionHash);
              }
            }}
            onError={(error) => console.error('Payment failed:', error)}
          >
            <TransactionButton 
              className="w-full !bg-gradient-to-r !from-[#F7B32B] !to-[#f97316] !text-black !font-bold !py-3 !rounded-xl !border-none !shadow-[0_0_20px_rgba(247,179,43,0.3)] hover:!scale-[1.02] !transition-transform"
              text={`Pay ${fee} USDC`} 
            />
            <TransactionStatus />
          </Transaction>
          
          <button 
            onClick={onCancel}
            className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors font-bold text-sm"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// Helper to encode ERC-20 transfer
function encodeTransferCall(to: string, amountUsd: number): `0x${string}` {
  const amount = BigInt(Math.floor(amountUsd * 1_000_000)); // USDC has 6 decimals
  const transferSelector = '0xa9059cbb'; // transfer(address,uint256)
  const paddedTo = to.slice(2).padStart(64, '0');
  const paddedAmount = amount.toString(16).padStart(64, '0');
  return `${transferSelector}${paddedTo}${paddedAmount}` as `0x${string}`;
}
