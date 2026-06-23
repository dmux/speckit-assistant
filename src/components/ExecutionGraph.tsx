'use client';

import React, { useMemo, useRef, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  NodeProps,
  Node,
  Edge,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  forceSimulation, forceManyBody, forceLink, forceCenter, forceCollide,
  type SimulationNodeDatum, type SimulationLinkDatum,
} from 'd3-force';
import { ExecutionRecord, ExecutionKind, ExecutionStatus } from '../domain/models/executions';

// Agent-centric graph: agent/type hubs (QA, Security, Deploy, phases…) link to the
// features they ran against. An edge aggregates every run for that (agent, feature)
// pair — thickness ∝ run count, colour = the most recent run's status.

type ExecutionGraphProps = {
  executions: ExecutionRecord[];
  theme: 'light' | 'dark';
  onOpenLog: (id: string) => void;
};

const STATUS_HEX: Record<ExecutionStatus, string> = {
  running: '#3b82f6',
  passed: '#22c55e',
  failed: '#ef4444',
};
const KIND_HEX: Record<ExecutionKind, string> = {
  phase: '#6366f1',   // indigo
  persona: '#8b5cf6', // violet
  devops: '#0ea5e9',  // sky
};
const KIND_LABEL: Record<ExecutionKind, string> = { phase: 'Phase', persona: 'Persona', devops: 'DevOps' };

const radiusFor = (runs: number) => 16 + Math.min(22, Math.sqrt(runs) * 6);
const FEATURE_HEX = '#71717a'; // zinc-500
const WORKSPACE_KEY = '__workspace__';

type AgentMeta = { id: string; kind: ExecutionKind; label: string; runs: number; lastStatus: ExecutionStatus; lastAt: number; running: boolean };
type FeatureMeta = { id: string; label: string; runs: number; running: boolean };
type LinkMeta = { id: string; source: string; target: string; count: number; lastStatus: ExecutionStatus; lastAt: number; lastExecId: string; running: boolean };

// --- Custom nodes: a centered hidden handle makes ReactFlow draw straight edges
// from node centre to node centre; the node body (rendered above edges) hides the
// overlapping segment, giving the clean Obsidian-style center-to-center look. ---
const hiddenHandle: React.CSSProperties = {
  left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
  width: 1, height: 1, minWidth: 0, minHeight: 0, border: 'none', background: 'transparent', opacity: 0,
};

const Handles = () => (
  <>
    <Handle type="target" position={Position.Top} id="c" style={hiddenHandle} isConnectable={false} />
    <Handle type="source" position={Position.Top} id="c" style={hiddenHandle} isConnectable={false} />
  </>
);

const AgentNode: React.FC<NodeProps> = ({ data }) => {
  const d = data as unknown as AgentMeta;
  const size = radiusFor(d.runs) * 2;
  const color = KIND_HEX[d.kind];
  return (
    <div className="relative flex items-center justify-center rounded-full font-semibold text-white shadow-md"
      style={{
        width: size, height: size, background: color,
        boxShadow: d.running ? `0 0 0 4px ${color}55` : undefined,
      }}
      title={`${KIND_LABEL[d.kind]} · ${d.label} · ${d.runs} run(s)`}
    >
      <Handles />
      <span className="px-1 text-center leading-tight" style={{ fontSize: Math.max(8, size / 6) }}>{d.label}</span>
      {d.running && <span className="absolute inset-0 rounded-full animate-ping" style={{ boxShadow: `0 0 0 3px ${color}` }} />}
    </div>
  );
};

const FeatureNode: React.FC<NodeProps> = ({ data }) => {
  const d = data as unknown as FeatureMeta;
  return (
    <div className="relative flex items-center justify-center rounded-lg border-2 px-3 py-2 font-bold shadow-md bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100"
      style={{ borderColor: FEATURE_HEX, boxShadow: d.running ? `0 0 0 4px ${FEATURE_HEX}44` : undefined }}
      title={`${d.label} · ${d.runs} run(s)`}
    >
      <Handles />
      <span className="text-[11px] max-w-[140px] truncate">{d.label}</span>
    </div>
  );
};

const nodeTypes = { agent: AgentNode, feature: FeatureNode };

export const ExecutionGraph: React.FC<ExecutionGraphProps> = ({ executions, theme, onOpenLog }) => {
  const posRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // 1. Aggregate executions into agent hubs, feature hubs, and weighted links.
  const graph = useMemo(() => {
    const agents = new Map<string, AgentMeta>();
    const features = new Map<string, FeatureMeta>();
    const links = new Map<string, LinkMeta>();

    for (const e of executions) {
      const featKey = e.feature || WORKSPACE_KEY;
      const featLabel = e.feature || 'Workspace';
      const agentKey = `${e.kind}:${e.agentId || e.phase || e.label}`;
      const running = e.status === 'running';

      const a = agents.get(agentKey) || { id: agentKey, kind: e.kind, label: e.label, runs: 0, lastStatus: e.status, lastAt: 0, running: false };
      a.runs += 1; a.running = a.running || running;
      if (e.startedAt >= a.lastAt) { a.lastAt = e.startedAt; a.lastStatus = e.status; a.label = e.label; }
      agents.set(agentKey, a);

      const f = features.get(featKey) || { id: featKey, label: featLabel, runs: 0, running: false };
      f.runs += 1; f.running = f.running || running;
      features.set(featKey, f);

      const linkKey = `${agentKey}__${featKey}`;
      const l = links.get(linkKey) || { id: linkKey, source: agentKey, target: featKey, count: 0, lastStatus: e.status, lastAt: 0, lastExecId: e.id, running: false };
      l.count += 1; l.running = l.running || running;
      if (e.startedAt >= l.lastAt) { l.lastAt = e.startedAt; l.lastStatus = e.status; l.lastExecId = e.id; }
      links.set(linkKey, l);
    }
    return { agents: [...agents.values()], features: [...features.values()], links: [...links.values()] };
  }, [executions]);

  // 2. Run a force layout when the topology (node/edge set) changes — NOT on mere
  // status/count updates — so live updates restyle without re-shuffling the graph.
  const layoutSig = useMemo(() => {
    const ids = [...graph.agents.map(a => a.id), ...graph.features.map(f => f.id)].sort().join('|');
    const ls = graph.links.map(l => `${l.source}>${l.target}`).sort().join('|');
    return `${ids}#${ls}`;
  }, [graph]);

  const positions = useMemo(() => {
    type SN = SimulationNodeDatum & { id: string; r: number };
    const allNodes: SN[] = [
      ...graph.agents.map(a => ({ id: a.id, r: radiusFor(a.runs) })),
      ...graph.features.map(f => ({ id: f.id, r: 28 })),
    ];
    // Seed from cached positions so existing nodes stay put across re-layouts.
    for (const n of allNodes) {
      const p = posRef.current.get(n.id);
      n.x = p?.x ?? (Math.random() - 0.5) * 400;
      n.y = p?.y ?? (Math.random() - 0.5) * 400;
    }
    const simLinks: SimulationLinkDatum<SN>[] = graph.links.map(l => ({ source: l.source, target: l.target }));
    const sim = forceSimulation(allNodes)
      .force('charge', forceManyBody().strength(-340))
      .force('link', forceLink<SN, SimulationLinkDatum<SN>>(simLinks).id(d => d.id).distance(130).strength(0.5))
      .force('center', forceCenter(0, 0))
      .force('collide', forceCollide<SN>().radius(d => d.r + 12))
      .stop();
    sim.tick(320);
    const map = new Map<string, { x: number; y: number }>();
    for (const n of allNodes) map.set(n.id, { x: n.x ?? 0, y: n.y ?? 0 });
    posRef.current = map;
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutSig]);

  // 3. Build ReactFlow nodes/edges (positions from the cached layout, styling fresh).
  const nodes: Node[] = useMemo(() => {
    const out: Node[] = [];
    for (const a of graph.agents) {
      const p = positions.get(a.id) || { x: 0, y: 0 };
      out.push({ id: a.id, type: 'agent', position: p, data: a as any, draggable: true });
    }
    for (const f of graph.features) {
      const p = positions.get(f.id) || { x: 0, y: 0 };
      out.push({ id: f.id, type: 'feature', position: p, data: f as any, draggable: true });
    }
    return out;
  }, [graph, positions]);

  const edges: Edge[] = useMemo(() => graph.links.map(l => ({
    id: l.id,
    source: l.source,
    target: l.target,
    sourceHandle: 'c',
    targetHandle: 'c',
    type: 'straight',
    animated: l.running,
    data: { lastExecId: l.lastExecId },
    style: { stroke: STATUS_HEX[l.lastStatus], strokeWidth: Math.min(5, 1.2 + l.count * 0.8), opacity: 0.85 },
  })), [graph.links]);

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    const id = (edge.data as any)?.lastExecId;
    if (id) onOpenLog(id);
  }, [onOpenLog]);

  if (executions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-zinc-500 italic">
        No executions yet — run a phase, the review gate, or a DevOps agent to populate the graph.
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onEdgeClick={onEdgeClick}
      fitView
      minZoom={0.2}
      maxZoom={2.5}
      proOptions={{ hideAttribution: true }}
      colorMode={theme}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color={theme === 'dark' ? '#27272a' : '#e4e4e7'} />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
};

export default ExecutionGraph;
