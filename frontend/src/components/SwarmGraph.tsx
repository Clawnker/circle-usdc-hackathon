'use client';

import { useCallback, useMemo, useEffect, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  BackgroundVariant,
} from '@xyflow/react';
import { motion } from 'framer-motion';
import { Brain, Sparkles, LineChart, Wallet, Activity, Target, Shield, Newspaper, Eye, FileText, Search } from 'lucide-react';
import type { SpecialistType } from '@/types';

interface SwarmGraphProps {
  activeSpecialist: string | null;
  currentStep: { specialist: string; action: string } | null;
  taskStatus: string | null;
  hiredAgents?: string[];
  onAgentClick?: (specialist: SpecialistType) => void;
}

// Specialist configurations
const SPECIALISTS: Record<SpecialistType, {
  name: string;
  description: string;
  icon: typeof Brain;
  color: string;
  glowColor: string;
}> = {
  dispatcher: {
    name: 'Dispatcher',
    description: 'Orchestrator',
    icon: Brain,
    color: '#00f5ff',
    glowColor: 'rgba(0, 245, 255, 0.6)',
  },
  aura: {
    name: 'Social Analyst',
    description: 'Sentiment',
    icon: Sparkles,
    color: '#a855f7',
    glowColor: 'rgba(168, 85, 247, 0.6)',
  },
  magos: {
    name: 'Market Oracle',
    description: 'Prediction',
    icon: LineChart,
    color: '#ec4899',
    glowColor: 'rgba(236, 72, 153, 0.6)',
  },
  bankr: {
    name: 'Bankr',
    description: 'Execution',
    icon: Wallet,
    color: '#22c55e',
    glowColor: 'rgba(34, 197, 94, 0.6)',
  },
  general: {
    name: 'General',
    description: 'Assistant',
    icon: Sparkles,
    color: '#F7B32B',
    glowColor: 'rgba(247, 179, 43, 0.6)',
  },
  alphahunter: {
    name: 'AlphaHunter',
    description: 'Discovery',
    icon: Target,
    color: '#fbbf24',
    glowColor: 'rgba(251, 191, 36, 0.6)',
  },
  riskbot: {
    name: 'RiskBot',
    description: 'Security',
    icon: Shield,
    color: '#ef4444',
    glowColor: 'rgba(239, 68, 68, 0.6)',
  },
  newsdigest: {
    name: 'NewsDigest',
    description: 'Intelligence',
    icon: Newspaper,
    color: '#22d3ee',
    glowColor: 'rgba(34, 211, 238, 0.6)',
  },
  whalespy: {
    name: 'WhaleSpy',
    description: 'Tracking',
    icon: Eye,
    color: '#8b5cf6',
    glowColor: 'rgba(139, 92, 246, 0.6)',
  },
  scribe: {
    name: 'Scribe',
    description: 'Documentation',
    icon: FileText,
    color: '#9CA3AF',
    glowColor: 'rgba(156, 163, 175, 0.6)',
  },
  seeker: {
    name: 'Seeker',
    description: 'Research',
    icon: Search,
    color: '#00F5FF',
    glowColor: 'rgba(0, 245, 255, 0.6)',
  },
};

// Custom Agent Node Component
function AgentNode({ data }: { data: { 
  specialist: SpecialistType; 
  isActive: boolean; 
  isCenter: boolean;
  status?: 'ready' | 'active' | 'complete' | 'idle';
  currentAction?: string;
  reputation?: number;
  erc8004Id?: string;
}}) {
  const config = SPECIALISTS[data.specialist];
  const Icon = config.icon;
  
  const isReady = data.status === 'ready';
  const isComplete = data.status === 'complete';
  const isActive = data.isActive || data.status === 'active';

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ 
        scale: 1, 
        opacity: 1,
        boxShadow: isActive 
          ? `0 0 30px ${config.glowColor}, 0 0 60px ${config.glowColor}`
          : isReady
            ? `0 0 15px ${config.glowColor}`
            : 'none'
      }}
      transition={{ 
        type: 'spring', 
        stiffness: 300, 
        damping: 20,
        boxShadow: { duration: 0.3 }
      }}
      className={`
        relative flex flex-col items-center justify-center
        ${data.isCenter ? 'w-32 h-32' : 'w-24 h-24'}
        rounded-full glass-panel cursor-pointer
        transition-all duration-300
        ${isReady ? 'border-dashed' : 'border-solid'}
      `}
      style={{
        borderColor: isActive ? config.color : isReady ? config.color : 'rgba(255,255,255,0.1)',
        borderWidth: isActive ? 3 : isReady ? 2 : 1,
      }}
    >
      {/* Pulse ring when active */}
      {isActive && (
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ borderColor: config.color, borderWidth: 2 }}
          animate={{
            scale: [1, 1.3, 1.3],
            opacity: [0.8, 0, 0],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeOut',
          }}
        />
      )}
      
      {/* Icon */}
      <motion.div
        animate={{ 
          rotate: isActive ? [0, 5, -5, 0] : 0,
        }}
        transition={{ 
          duration: 0.5, 
          repeat: isActive ? Infinity : 0,
          repeatDelay: 1
        }}
      >
        <Icon 
          size={data.isCenter ? 36 : 28} 
          style={{ color: config.color }}
        />
      </motion.div>
      
      {/* Name */}
      <span 
        className="mt-1 text-[10px] font-bold uppercase tracking-wider"
        style={{ color: config.color }}
      >
        {config.name}
      </span>

      {/* ERC-8004 ID Badge (if available) */}
      {!data.isCenter && (
        <div className="mt-0.5 px-1.5 py-0.5 rounded-full bg-black/40 border border-white/5 flex items-center gap-1">
          <Shield size={8} className="text-[var(--accent-cyan)]" />
          <span className="text-[8px] font-mono text-white/70">8004</span>
        </div>
      )}
      
      {/* Status indicator */}
      <div 
        className={`absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center border border-[var(--bg-primary)] ${
          isActive ? 'bg-green-500' : isReady ? 'bg-blue-500' : isComplete ? 'bg-green-600' : 'bg-gray-500'
        }`}
      >
        {isComplete ? (
          <span className="text-[8px] text-white">✓</span>
        ) : data.reputation ? (
          <span className="text-[8px] text-white font-bold">{data.reputation}</span>
        ) : null}
      </div>

      {/* Current action tooltip */}
      {isActive && data.currentAction && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute -bottom-8 whitespace-nowrap text-xs px-2 py-1 
            rounded-md glass-panel-subtle text-[var(--text-secondary)] z-50"
        >
          {data.currentAction}
        </motion.div>
      )}
    </motion.div>
  );
}

const nodeTypes = { agent: AgentNode };

// Calculate node positions in a circle around center
function getNodePositions(centerX: number, centerY: number, radius: number, extraAgents: string[] = []) {
  const baseSpecialists: SpecialistType[] = ['bankr', 'scribe', 'seeker'];
  const allSpecialists = [...baseSpecialists];
  
  // Add extra agents if they aren't already there
  extraAgents.forEach(id => {
    const agentId = id.toLowerCase() as SpecialistType;
    if (!allSpecialists.includes(agentId) && SPECIALISTS[agentId]) {
      allSpecialists.push(agentId);
    }
  });

  const angleOffset = -Math.PI / 2; // Start from top
  
  return allSpecialists.map((specialist, index) => {
    const angle = angleOffset + (2 * Math.PI * index) / allSpecialists.length;
    return {
      id: specialist,
      x: centerX + radius * Math.cos(angle) - 48, // Subtract half node width
      y: centerY + radius * Math.sin(angle) - 48,
    };
  });
}

export function SwarmGraph({ activeSpecialist, currentStep, taskStatus, hiredAgents = [], onAgentClick }: SwarmGraphProps) {
  const centerX = 200;
  const centerY = 150;
  const radius = 140;

  const positions = useMemo(() => getNodePositions(centerX, centerY, radius, hiredAgents), [hiredAgents]);
  
  const initialNodes: Node[] = useMemo(() => [
    {
      id: 'dispatcher',
      type: 'agent',
      position: { x: centerX - 64, y: centerY - 64 },
      data: { 
        specialist: 'dispatcher' as SpecialistType, 
        isActive: false, 
        isCenter: true,
        status: 'idle',
        currentAction: undefined,
      },
    },
    ...positions.map(pos => ({
      id: pos.id,
      type: 'agent',
      position: { x: pos.x, y: pos.y },
      data: { 
        specialist: pos.id as SpecialistType, 
        isActive: false, 
        isCenter: false,
        status: hiredAgents.includes(pos.id) ? 'ready' : 'idle',
        currentAction: undefined,
      },
    })),
  ], [positions, hiredAgents]);

  const initialEdges: Edge[] = useMemo(() => {
    const edges: Edge[] = [];
    positions.forEach(pos => {
      edges.push({ 
        id: `dispatcher-${pos.id}`, 
        source: 'dispatcher', 
        target: pos.id, 
        animated: false 
      });
    });
    
    // Connect outer nodes in a circle
    for (let i = 0; i < positions.length; i++) {
      const nextIndex = (i + 1) % positions.length;
      edges.push({
        id: `${positions[i].id}-${positions[nextIndex].id}`,
        source: positions[i].id,
        target: positions[nextIndex].id,
        animated: false
      });
    }
    
    return edges;
  }, [positions]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync nodes when positions/hiredAgents change
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // Update active states based on current step
  useEffect(() => {
    const activeId = currentStep?.specialist?.toLowerCase() || 
                     (taskStatus === 'planning' ? 'dispatcher' : null);
    
    setNodes(nds => nds.map(node => {
      const isCurrentActive = node.id === activeId || (taskStatus === 'executing' && node.id === 'dispatcher');
      let status = node.data.status;
      
      if (isCurrentActive) {
        status = 'active';
      } else if (taskStatus === 'completed' && node.data.status === 'active') {
        status = 'complete';
      } else if (hiredAgents.includes(node.id) && status !== 'complete' && status !== 'active') {
        status = 'ready';
      }

      return {
        ...node,
        data: {
          ...node.data,
          isActive: isCurrentActive,
          status,
          currentAction: node.id === activeId ? currentStep?.action : undefined,
        },
      };
    }));

    // Animate edges when there's an active specialist
    setEdges(eds => eds.map(edge => {
      const isTargetActive = edge.target === activeId;
      const isSourceDispatcher = edge.source === 'dispatcher';
      const shouldAnimate = activeId && (isTargetActive && (isSourceDispatcher || edge.source !== 'dispatcher'));

      return {
        ...edge,
        animated: !!shouldAnimate,
        style: {
          stroke: activeId && edge.target === activeId
            ? SPECIALISTS[activeId as SpecialistType]?.color || '#00f5ff'
            : 'var(--text-muted)',
          strokeWidth: activeId && edge.target === activeId ? 3 : 2,
        },
      };
    }));
  }, [currentStep, taskStatus, hiredAgents, setNodes, setEdges]);

  return (
    <div className="w-full h-full min-h-[300px] glass-panel overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--glass-border)]">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-[var(--accent-cyan)]" />
          <span className="text-sm font-medium text-[var(--text-primary)]">Swarm Network</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`status-dot ${taskStatus === 'executing' || taskStatus === 'planning' ? 'status-active' : 'status-idle'}`} />
          <span className="text-xs text-[var(--text-secondary)]">
            {taskStatus === 'executing' ? 'Active' : taskStatus === 'planning' ? 'Planning' : 'Idle'}
          </span>
        </div>
      </div>

      {/* Graph */}
      <div className="h-[calc(100%-48px)]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node) => {
            if (onAgentClick && node.data.specialist) {
              onAgentClick(node.data.specialist as SpecialistType);
            }
          }}
          fitView
          panOnDrag={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={true}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(255,255,255,0.05)" />
          <Controls showInteractive={false} position="bottom-right" />
        </ReactFlow>
      </div>
    </div>
  );
}
