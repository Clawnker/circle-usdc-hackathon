'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, LinkIcon, Globe, MessageSquare, AtSign } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface SeekerCardData {
  query: string;
  keyFindings: { title: string; content: string; }[]; // content can be markdown
  citations: { title: string; url: string; source: 'web' | 'reddit' | 'twitter'; credibilityScore?: number; }[];
  summary: string;
}

interface SeekerCardProps {
  data: SeekerCardData;
}

const SeekerCard: React.FC<SeekerCardProps> = ({ data }) => {
  const [expandedFindings, setExpandedFindings] = useState<number[]>([]);

  const toggleFinding = (index: number) => {
    setExpandedFindings(prev =>
      prev.includes(index) ? prev.filter(item => item !== index) : [...prev, index]
    );
  };

  const getSourceIcon = (source: 'web' | 'reddit' | 'twitter') => {
    switch (source) {
      case 'web': return <Globe size={14} className="inline-block mr-1" />;
      case 'reddit': return <MessageSquare size={14} className="inline-block mr-1" />;
      case 'twitter': return <AtSign size={14} className="inline-block mr-1" />;
      default: return null;
    }
  };

  return (
    <div className="glass-panel p-4 rounded-lg gradient-border flex flex-col gap-4">
      <h3 className="text-xl font-bold text-text-primary">Seeker Research for: "{data.query}"</h3>

      {/* Key Findings */}
      {data.keyFindings && data.keyFindings.length > 0 && (
        <div className="glass-panel-subtle p-3 rounded-md">
          <h4 className="font-semibold text-text-primary mb-2">Key Findings:</h4>
          <ul className="list-decimal list-inside pl-4">
            {data.keyFindings.map((finding, index) => (
              <li key={index} className="mb-2 last:mb-0">
                <button
                  onClick={() => toggleFinding(index)}
                  className="flex items-center w-full text-left text-text-secondary hover:text-text-primary focus:outline-none"
                >
                  {expandedFindings.includes(index) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  <span className="ml-2 font-medium text-text-primary">{finding.title}</span>
                </button>
                {expandedFindings.includes(index) && (
                  <div className="ml-6 mt-1 text-sm text-text-secondary prose prose-invert">
                    <ReactMarkdown>{finding.content}</ReactMarkdown>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Summary */}
      {data.summary && (
        <div className="text-text-secondary text-sm">
          <h4 className="font-semibold text-text-primary mb-1">Summary:</h4>
          <p>{data.summary}</p>
        </div>
      )}

      {/* Citations */}
      {data.citations && data.citations.length > 0 && (
        <div className="glass-panel-subtle p-3 rounded-md">
          <h4 className="font-semibold text-text-primary mb-2">Citations:</h4>
          <ul className="list-none">
            {data.citations.map((citation, index) => (
              <li key={index} className="mb-1 flex items-center text-sm">
                <span className="text-text-muted w-4 flex-shrink-0">[{index + 1}]</span>
                {getSourceIcon(citation.source)}
                <a href={citation.url} target="_blank" rel="noopener noreferrer" className="text-accent-cyan hover:underline ml-1">
                  {citation.title}
                </a>
                {citation.credibilityScore !== undefined && (
                  <span className="ml-2 text-xs text-text-muted">(Credibility: {citation.credibilityScore.toFixed(1)})</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SeekerCard;
