'use client';

import React from 'react';
import { TrendingDownIcon, TrendingUpIcon, Minus } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface AuraCardData {
  topic?: string;
  overallSentiment?: string;
  score?: number;
  confidence?: number;
  trendDirection?: string;
  entities?: { name: string; sentiment: string; mentionCount: number }[];
  sources?: { title: string; url: string; source?: string; sentiment?: string }[];
  summary?: string;
  trending?: { rank?: number; topic: string; sentiment?: string; momentum?: string; reason?: string }[];
  category?: string;
}

interface AuraCardProps {
  data: AuraCardData;
}

const AuraCard: React.FC<AuraCardProps> = ({ data }) => {
  const getSentimentColorClass = (sentiment: string) => {
    if (sentiment.toLowerCase() === 'bullish') return 'bg-green-500';
    if (sentiment.toLowerCase() === 'bearish') return 'bg-red-500';
    return 'bg-gray-500'; // neutral
  };

  const getSentimentGaugeColor = (score: number) => {
    if (score > 0.3) return 'bg-green-500';
    if (score < -0.3) return 'bg-red-500';
    return 'bg-yellow-500';
  };

  const getTrendIcon = (direction: string) => {
    if (direction.toLowerCase() === 'rising') return <TrendingUpIcon className="text-green-500" size={16} />;
    if (direction.toLowerCase() === 'falling') return <TrendingDownIcon className="text-red-500" size={16} />;
    return <Minus className="text-gray-500" size={16} />;
  };

  const isTrendingView = Array.isArray(data?.trending) && data.trending.length > 0;

  return (
    <div className="glass-panel p-4 rounded-lg gradient-border flex flex-col gap-4">
      <h3 className="text-xl font-bold text-text-primary">
        {isTrendingView
          ? `Aura Trending${data?.category ? `: ${String(data.category).toUpperCase()}` : ''}`
          : `Aura Sentiment for: ${data?.topic || 'Unknown'}`}
      </h3>

      {!isTrendingView ? (
        <>
          {/* Overall Sentiment Gauge */}
          <div className="flex flex-col gap-2">
            <div className="text-text-secondary">Overall Sentiment: <span className="font-semibold text-text-primary">{data?.overallSentiment || 'neutral'}</span></div>
            <div className="w-full bg-gray-700 rounded-full h-2.5 relative">
              <div
                className={`h-2.5 rounded-full absolute ${getSentimentGaugeColor((data?.score || 0))}`}
                style={{
                  width: '50%',
                  left: `calc(50% + ${((data?.score || 0) * 50).toFixed(2)}%)`,
                  transform: 'translateX(-50%)',
                }}
              />
              <div
                className="h-4 w-1 bg-white absolute rounded-full -mt-1"
                style={{ left: `calc(50% + ${((data?.score || 0) * 50).toFixed(2)}%)`, transform: 'translateX(-50%)' }}
              />
            </div>
            <div className="flex justify-between text-xs text-text-muted mt-1">
              <span>Bearish (-1.0)</span>
              <span>Neutral (0.0)</span>
              <span>Bullish (1.0)</span>
            </div>
            <div className="text-text-primary text-lg font-bold">Score: {(data?.score || 0).toFixed(2)}</div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-text-secondary">Confidence:</span>
            <div className="w-32 bg-gray-700 rounded-full h-2.5">
              <div className="bg-accent-cyan h-2.5 rounded-full" style={{ width: `${((data?.confidence || 0) * 100).toFixed(0)}%` }} />
            </div>
            <span className="text-text-primary font-bold">{((data?.confidence || 0) * 100).toFixed(0)}%</span>
          </div>

          <div className="flex items-center gap-2 text-text-secondary">
            <span>Trend:</span>
            {getTrendIcon(data?.trendDirection || 'stable')}
            <span className="font-semibold text-text-primary">{data?.trendDirection || 'stable'}</span>
          </div>

          {data.entities && data.entities.length > 0 && (
            <div className="glass-panel-subtle p-3 rounded-md">
              <h4 className="font-semibold text-text-primary mb-2">Detected Entities:</h4>
              <div className="flex flex-wrap gap-2">
                {data.entities.slice(0, 8).map((entity, index) => (
                  <span key={index} className={`px-3 py-1 rounded-full text-xs font-semibold text-white ${getSentimentColorClass(entity.sentiment)}`}>
                    {entity.name} ({entity.sentiment}) • {entity.mentionCount}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="glass-panel-subtle p-3 rounded-md">
          <h4 className="font-semibold text-text-primary mb-2">Top Trending Signals</h4>
          <ul className="space-y-2 text-sm text-text-secondary">
            {data.trending!.slice(0, 5).map((t, idx) => (
              <li key={idx} className="border border-white/5 rounded-md p-2">
                <div className="font-semibold text-text-primary">#{t.rank || idx + 1} {t.topic}</div>
                <div className="text-xs text-text-muted">{t.sentiment || 'neutral'} • {t.momentum || 'medium'}</div>
                {t.reason && <div className="mt-1 line-clamp-3">{t.reason}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.summary && (
        <div className="text-text-secondary text-sm prose prose-invert max-w-none prose-p:my-2 prose-li:my-0.5">
          <h4 className="font-semibold text-text-primary mb-1 not-prose">Summary</h4>
          <ReactMarkdown>{data.summary}</ReactMarkdown>
        </div>
      )}

      {data.sources && data.sources.length > 0 && (
        <div className="glass-panel-subtle p-3 rounded-md text-xs text-text-muted">
          <h4 className="font-semibold text-text-primary mb-1">Sources</h4>
          <ul className="space-y-1">
            {data.sources.slice(0, 8).map((source, index) => (
              <li key={index} className="truncate">
                <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-accent-cyan hover:underline">
                  {source.title}
                </a>
                {source.source ? ` (${source.source}${source.sentiment ? `, ${source.sentiment}` : ''})` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default AuraCard;
