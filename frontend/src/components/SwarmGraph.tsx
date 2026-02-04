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
import { Brain, Sparkles, LineChart, Wallet, Activity } from 'lucide-react';
import type { SpecialistType } from '@/types';

interface SwarmGraphProps {
  activeSpecialist: string | null;
  currentStep: { specialist: string; action: string } | null;
  taskStatus: string | null;
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
    name: 'Aura',
    description: 'Sentiment',
    icon: Sparkles,
    color: '#a855f7',
    glowColor: 'rgba(168, 85, 247, 0.6)',
  },
  magos: {
    name: 'Magos',
    description: 'Prediction',
    icon: LineChart,
    color: '#ec4899',
    glowColor: 'rgba(236, 72, 153, 0.6)',
  },
  bankr: {
    name: 'bankr',
    description: 'Execution',
    icon: Wallet,
    color: '#22c55e',
    glowColor: 'rgba(34, 197, 94, 0.6)',
  },
};

// Custom Agent Node Component
function AgentNode({ data }: { data: { 
  specialist: SpecialistType; 
  isActive: boolean; 
  isCenter: boolean;
  currentAction?: string;
}}) {
  const config = SPECIALISTS[data.specialist];
  const Icon = config.icon;
  
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ 
        scale: 1, 
        opacity: 1,
        boxShadow: data.isActive 
          ? `0 0 30px ${config.glowColor}, 0 0 60px ${config.glowColor}`
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
      `}
      style={{
        borderColor: data.isActive ? config.color : 'rgba(255,255,255,0.1)',
        borderWidth: data.isActive ? 2 : 1,
      }}
    >
      {/* Pulse ring when active */}
      {data.isActive && (
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
          rotate: data.isActive ? [0, 5, -5, 0] : 0,
        }}
        transition={{ 
          duration: 0.5, 
          repeat: data.isActive ? Infinity : 0,
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
        className="mt-1 text-xs font-semibold"
        style={{ color: config.color }}
      >
        {config.name}
      </span>
      
      {/* Status indicator */}
      <div 
        className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${
          data.isActive ? 'status-active' : 'status-idle'
        }`}
      />

      {/* Current action tooltip */}
      {data.isActive && data.currentAction && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute -bottom-8 whitespace-nowrap text-xs px-2 py-1 
            rounded-md glass-panel-subtle text-[var(--text-secondary)]"
        >
          {data.currentAction}
        </motion.div>
      )}
    </motion.div>
  );
}

const nodeTypes = { agent: AgentNode };

// Calculate node positions in a circle around center
function getNodePositions(centerX: number, centerY: number, radius: number) {
  const specialists: SpecialistType[] = ['aura', 'magos', 'bankr'];
  const angleOffset = -Math.PI / 2; // Start from top
  
  return specialists.map((specialist, index) => {
    const angle = angleOffset + (2 * Math.PI * index) / specialists.length;
    return {
      id: specialist,
      x: centerX + radius * Math.cos(angle) - 48, // Subtract half node width
      y: centerY + radius * Math.sin(angle) - 48,
    };
  });
}

export function SwarmGraph({ activeSpecialist, currentStep, taskStatus, onAgentClick }: SwarmGraphProps) {
  const centerX = 200;
  const centerY = 150;
  const radius = 140;

  const positions = useMemo(() => getNodePositions(centerX, centerY, radius), []);
  
  const initialNodes: Node[] = useMemo(() => [
    {
      id: 'dispatcher',
      type: 'agent',
      position: { x: centerX - 64, y: centerY - 64 },
      data: { 
        specialist: 'dispatcher' as SpecialistType, 
        isActive: false, 
        isCenter: true,
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
        currentAction: undefined,
      },
    })),
  ], [positions]);

  const initialEdges: Edge[] = useMemo(() => [
    { id: 'dispatcher-aura', source: 'dispatcher', target: 'aura', animated: false },
    { id: 'dispatcher-magos', source: 'dispatcher', target: 'magos', animated: false },
    { id: 'dispatcher-bankr', source: 'dispatcher', target: 'bankr', animated: false },
    { id: 'aura-magos', source: 'aura', target: 'magos', animated: false },
    { id: 'magos-bankr', source: 'magos', target: 'bankr', animated: false },
  ], []);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update active states based on current step
  useEffect(() => {
    const activeId = currentStep?.specialist?.toLowerCase() || 
                     (taskStatus === 'planning' ? 'dispatcher' : null);
    
    setNodes(nds => nds.map(node => ({
      ...node,
      data: {
        ...node.data,
        isActive: node.id === activeId || (taskStatus === 'executing' && node.id === 'dispatcher'),
        currentAction: node.id === activeId ? currentStep?.action : undefined,
      },
    })));

    // Animate edges when there's an active specialist
    setEdges(eds => eds.map(edge => ({
      ...edge,
      animated: activeId ? (
        edge.source === 'dispatcher' && edge.target === activeId ||
        edge.target === activeId
      ) : false,
      style: {
        stroke: activeId && (edge.source === 'dispatcher' && edge.target === activeId || edge.target === activeId)
          ? SPECIALISTS[activeId as SpecialistType]?.color || '#00f5ff'
          : 'var(--text-muted)',
        strokeWidth: activeId && edge.target === activeId ? 3 : 2,
      },
    })));
  }, [currentStep, taskStatus, setNodes, setEdges]);

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
