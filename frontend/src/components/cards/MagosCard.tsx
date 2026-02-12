'use client';

import React from 'react';
import { ArrowUp, ArrowDown, TrendingUp, TrendingDown, CircleHelp } from 'lucide-react';

interface MagosCardData {
  token: string;
  price: { current: number; change24h: number; change7d?: number; formatted: string };
  market?: { cap?: number; volume24h?: number; rank?: number };
  sentiment: { label: string; score: number; confidence: number };
  prediction?: { direction: string; target: number; confidence: number; timeHorizon: string; reasoning: string };
  risk?: { level: string; score: number; factors: string[] };
  sources: string[];
  summary: string;
}

interface MagosCardProps {
  data: MagosCardData;
}

const MagosCard: React.FC<MagosCardProps> = ({ data }) => {
  // Graceful fallbacks for missing data
  const price = data?.price || { current: 0, change24h: 0, formatted: 'N/A' };
  const sentiment = data?.sentiment || { label: 'neutral', score: 0, confidence: 0 };
  const sources = data?.sources || [];
  const summary = data?.summary || '';
  
  const isPriceUp = (price.change24h || 0) >= 0;
  const priceChangeColor = isPriceUp ? 'text-green-500' : 'text-red-500';
  const priceChangeIcon = isPriceUp ? <ArrowUp size={16} /> : <ArrowDown size={16} />;

  const getSentimentColor = (label: string) => {
    switch (label.toLowerCase()) {
      case 'bullish': return 'bg-green-500';
      case 'bearish': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const formatCurrency = (value: number | undefined) => {
    if (value === undefined) return 'N/A';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact' }).format(value);
  };

  return (
    <div className="glass-panel p-4 rounded-lg gradient-border flex flex-col gap-4">
      <h3 className="text-xl font-bold text-text-primary">{data?.token || "Token"} Market Data</h3>

      {/* Price Display */}
      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-bold text-text-primary">{price.formatted}</span>
        <span className={`flex items-center gap-1 ${priceChangeColor}`}>
          {priceChangeIcon}
          {Math.abs(price.change24h).toFixed(2)}% (24h)
        </span>
      </div>

      {/* Market Data Row */}
      {(data.market?.cap || data.market?.volume24h || data.market?.rank) && (
        <div className="flex justify-between text-text-secondary text-sm">
          {data.market?.cap && <span>Market Cap: {formatCurrency(data.market.cap)}</span>}
          {data.market?.volume24h && <span>24h Volume: {formatCurrency(data.market.volume24h)}</span>}
          {data.market?.rank && <span>Rank: #{data.market.rank}</span>}
        </div>
      )}

      {/* Sentiment Badge */}
      <div className="flex items-center gap-2">
        <span className="text-text-secondary">Sentiment:</span>
        <span className={`px-2 py-1 rounded-full text-xs font-semibold text-white ${getSentimentColor(sentiment.label)}`}>
          {sentiment.label} ({sentiment.score.toFixed(2)})
        </span>
        <span className="text-text-muted text-xs">Confidence: {(sentiment.confidence * 100).toFixed(0)}%</span>
      </div>

      {/* Prediction Section */}
      {data.prediction && (
        <div className="glass-panel-subtle p-3 rounded-md">
          <h4 className="font-semibold text-text-primary">Prediction ({data.prediction.timeHorizon})</h4>
          <div className="flex items-center gap-2 mt-2">
            {data.prediction.direction === 'up' ? <TrendingUp size={20} className="text-green-500" /> : <TrendingDown size={20} className="text-red-500" />}
            <span className="text-lg text-text-primary">Target: {formatCurrency(data.prediction.target)}</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2.5 mt-2">
            <div className="bg-accent-gold h-2.5 rounded-full" style={{ width: `${(data.prediction.confidence * 100).toFixed(0)}%` }}></div>
          </div>
          <p className="text-text-muted text-xs mt-1">Confidence: {(data.prediction.confidence * 100).toFixed(0)}%</p>
          <p className="text-text-secondary text-sm mt-2">{data.prediction.reasoning}</p>
        </div>
      )}

      {/* Risk Section */}
      {data.risk && (
        <div className="glass-panel-subtle p-3 rounded-md">
          <h4 className="font-semibold text-text-primary">Risk Assessment</h4>
          <div className="flex items-center gap-2 mt-2">
            <CircleHelp size={20} className="text-yellow-500" />
            <span className="px-2 py-1 rounded-full text-xs font-semibold text-white bg-red-600">{data.risk.level} ({data.risk.score})</span>
          </div>
          <p className="text-text-secondary text-sm mt-2">Factors: {data.risk.factors.join(', ')}</p>
        </div>
      )}

      {/* Summary */}
      {data.summary && (
        <div className="text-text-secondary text-sm">
          <h4 className="font-semibold text-text-primary mb-1">Summary:</h4>
          <p>{summary}</p>
        </div>
      )}

      {/* Sources List */}
      {sources && sources.length > 0 && (
        <div className="text-text-muted text-xs">
          <h4 className="font-semibold text-text-primary mb-1">Sources:</h4>
          <ul>
            {sources.map((source, index) => (
              <li key={index}>{source}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default MagosCard;
