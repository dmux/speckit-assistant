import React, { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  NodeProps,
  Node,
  Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { WorkflowState, FeatureWorkflow, WorkflowPhase, PhaseStatus } from '../domain/models/types';
import { AlertTriangle, Play, Check, FileText } from 'lucide-react';

// Status styling mapping
const STATUS_COLOR: Record<PhaseStatus, string> = {
  idle: '#71717a',          // zinc-500
  running: '#3b82f6',       // blue-500
  awaiting_review: '#f59e0b', // amber-500
  approved: '#10b981',      // emerald-500
};

const STATUS_LABEL: Record<PhaseStatus, string> = {
  idle: 'Idle',
  running: 'Running',
  awaiting_review: 'Review',
  approved: 'Approved',
};

const PHASE_LABELS: Record<WorkflowPhase, string> = {
  constitution: 'Constitution',
  specification: 'Spec',
  clarification: 'Clarify',
  planning: 'Plan',
  checklist: 'Checklist',
  analyze: 'Analysis',
  tasks: 'Tasks',
  taskstoissues: 'Issues',
  implementation: 'Implementation',
};

type TaskProgress = { done: number; total: number };

// --- Custom Nodes ---

const ConstitutionNode: React.FC<NodeProps> = ({ data }: any) => {
  const color = STATUS_COLOR[data.status as PhaseStatus];
  const isRunning = data.status === 'running';

  return (
    <div
      className="bg-white dark:bg-black rounded-lg border px-3 py-2 text-center select-none shadow-sm min-w-[150px] transition-all"
      style={{
        borderColor: data.stale ? '#ef4444' : color,
        borderStyle: data.stale ? 'dashed' : 'solid',
        borderWidth: '2px',
      }}
    >
      <div className="text-xs font-bold text-zinc-950 dark:text-zinc-50 tracking-wide mb-1">
        Constitution
      </div>
      <div
        className={`flex items-center justify-center gap-1 text-[10px] font-semibold`}
        style={{
          color,
          animation: isRunning ? 'pulse 1.2s ease-in-out infinite' : 'none',
        }}
      >
        <span>{STATUS_LABEL[data.status as PhaseStatus]}</span>
      </div>

      {data.filePath && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            data.onOpenFile?.(data.filePath);
          }}
          className="mt-2 flex items-center justify-center gap-1 mx-auto text-[9px] font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition"
        >
          <FileText size={10} /> Open File
        </button>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="w-2 h-2 bg-zinc-400 dark:bg-zinc-650 border-0"
      />
    </div>
  );
};

const PhaseNode: React.FC<NodeProps> = ({ data }: any) => {
  const d = data;
  const color = STATUS_COLOR[d.status as PhaseStatus];
  const isRunning = d.status === 'running';

  return (
    <div
      className={`bg-white dark:bg-black rounded-lg border px-3 py-2 select-none shadow-sm min-w-[140px] transition-all ${
        d.isActive
          ? 'border-black dark:border-white ring-1 ring-black dark:ring-white'
          : ''
      }`}
      style={{
        borderColor: d.stale ? '#ef4444' : color,
        borderStyle: d.stale ? 'dashed' : 'solid',
        borderWidth: d.isActive ? '2px' : '1.5px',
      }}
    >
      {/* Input handles */}
      {d.isFirst && (
        <Handle
          type="target"
          position={Position.Top}
          id="top"
          className="w-2 h-2 bg-zinc-400 dark:bg-zinc-650 border-0"
        />
      )}
      {!d.isFirst && (
        <Handle
          type="target"
          position={Position.Left}
          id="left"
          className="w-2 h-2 bg-zinc-400 dark:bg-zinc-650 border-0"
        />
      )}

      {/* Label */}
      <div className="text-xs font-bold text-zinc-950 dark:text-zinc-50 mb-1">
        {d.label}
      </div>

      {/* Status */}
      <div
        className="flex items-center gap-1 text-[10px] font-semibold"
        style={{
          color,
          animation: isRunning ? 'pulse 1.2s ease-in-out infinite' : 'none',
        }}
      >
        <span>{STATUS_LABEL[d.status as PhaseStatus]}</span>
        {d.stale && (
          <span className="flex items-center gap-0.5 text-red-500 text-[8px] font-bold">
            <AlertTriangle size={8} /> STALE
          </span>
        )}
      </div>

      {/* Task progress indicator */}
      {d.taskProgress && d.taskProgress.total > 0 && (
        <div className="mt-2 space-y-1">
          {d.phase === 'implementation' && (
            <div className="h-1 bg-zinc-100 dark:bg-zinc-900 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.round((d.taskProgress.done / d.taskProgress.total) * 100)}%`,
                  backgroundColor: d.taskProgress.done === d.taskProgress.total ? '#10b981' : '#3b82f6',
                }}
              />
            </div>
          )}
          <div className="text-[9px] text-zinc-400 dark:text-zinc-500 font-mono">
            {d.phase === 'implementation'
              ? `${d.taskProgress.done}/${d.taskProgress.total} tasks`
              : `${d.taskProgress.total} task${d.taskProgress.total !== 1 ? 's' : ''}`}
          </div>
        </div>
      )}

      {d.filePath && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            d.onOpenFile?.(d.filePath);
          }}
          className="mt-2 flex items-center gap-1 text-[9px] font-medium text-zinc-500 hover:text-zinc-850 dark:hover:text-zinc-200 transition"
        >
          <FileText size={10} /> Open File
        </button>
      )}

      {/* Output handles */}
      {!d.isLast && (
        <Handle
          type="source"
          position={Position.Right}
          id="right"
          className="w-2 h-2 bg-zinc-400 dark:bg-zinc-650 border-0"
        />
      )}
    </div>
  );
};

// Plain text label for a feature row. A custom node (not ReactFlow's 'default'
// type) so it renders as text only — no connection handles — since a feature
// never derives from another.
const FeatureLabelNode: React.FC<NodeProps> = ({ data }: any) => {
  return (
    <div className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 text-right whitespace-nowrap select-none">
      {data.label}
    </div>
  );
};

// Node type registry
const nodeTypes = {
  constitution: ConstitutionNode,
  phase: PhaseNode,
  featureLabel: FeatureLabelNode,
};

type DagMapProps = {
  state: WorkflowState;
  onSelectFeature: (name: string) => void;
  onSelectPhaseFile: (filePath: string | null) => void;
};

export const DagMap: React.FC<DagMapProps> = ({
  state,
  onSelectFeature,
  onSelectPhaseFile,
}) => {
  
  // Custom graph building logic
  const { nodes, edges } = useMemo(() => {
    const nodesList: Node[] = [];
    const edgesList: Edge[] = [];

    const NODE_W = 160;
    const NODE_H = 75;
    const GAP_X = 50;
    const CONST_GAP_Y = 100;
    const ROW_GAP_Y = 55;

    const rowWidth = 8 * NODE_W + 7 * GAP_X;
    const constitutionX = rowWidth / 2 - NODE_W / 2;

    const activeFeature = state.features.find((f) => f.name === state.activeFeatureName);
    const constitutionApproved = state.constitutionPhase.status === 'approved';
    const activePhase = !constitutionApproved
      ? state.constitutionPhase
      : activeFeature?.phases.find((p) => p.status !== 'approved') ?? null;

    // 1. Add Constitution Node
    nodesList.push({
      id: 'constitution',
      type: 'constitution',
      position: { x: constitutionX, y: 15 },
      data: {
        status: state.constitutionPhase.status,
        stale: state.constitutionPhase.stale ?? false,
        filePath: state.constitutionPhase.filePath,
        onOpenFile: onSelectPhaseFile,
      },
      style: { width: NODE_W },
    });

    // 2. Add Feature Nodes & Edges
    state.features.forEach((feature, fi) => {
      const rowY = NODE_H + CONST_GAP_Y + fi * (NODE_H + ROW_GAP_Y);

      // Parse task progress
      const tasksPhase = feature.phases.find(p => p.phase === 'tasks');
      let taskProgress: TaskProgress | null = null;
      if (tasksPhase?.content) {
        const checkboxes = [...tasksPhase.content.matchAll(/^\s*(?:[-*]|\d+\.)\s+\[( |x|X)\]/gm)];
        if (checkboxes.length > 0) {
          taskProgress = {
            done: checkboxes.filter(c => c[1].toLowerCase() === 'x').length,
            total: checkboxes.length
          };
        }
      }

      feature.phases.forEach((phase, pi) => {
        const nodeId = `${feature.name}::${phase.phase}`;
        const isFirst = pi === 0;
        const isLast = pi === feature.phases.length - 1;
        const isActive =
          activePhase?.phase === phase.phase &&
          feature.name === state.activeFeatureName;

        const showProgress = phase.phase === 'tasks' || phase.phase === 'implementation';

        nodesList.push({
          id: nodeId,
          type: 'phase',
          position: { x: pi * (NODE_W + GAP_X), y: rowY },
          data: {
            label: PHASE_LABELS[phase.phase],
            phase: phase.phase,
            status: phase.status,
            stale: phase.stale ?? false,
            filePath: phase.filePath,
            featureName: feature.name,
            isFirst,
            isLast,
            isActive,
            taskProgress: showProgress ? taskProgress : null,
            onOpenFile: onSelectPhaseFile,
          },
          style: { width: NODE_W },
        });

        // Edge styling based on state
        const statusColor = STATUS_COLOR[phase.status] || '#71717a';
        const edgeStyle = {
          stroke: statusColor,
          strokeWidth: phase.status === 'approved' ? 2 : 1.5,
          strokeDasharray: phase.status === 'awaiting_review' ? '5 3' : undefined,
        };
        const edgeAnimated = phase.status === 'running' || phase.status === 'awaiting_review';

        // Edge: Constitution -> first phase of each feature
        if (isFirst) {
          edgesList.push({
            id: `constitution-->${nodeId}`,
            source: 'constitution',
            sourceHandle: 'bottom',
            target: nodeId,
            targetHandle: 'top',
            type: 'smoothstep',
            animated: edgeAnimated,
            style: edgeStyle,
          });
        }

        // Edge: previous phase -> this phase
        if (!isFirst) {
          const prevId = `${feature.name}::${feature.phases[pi - 1].phase}`;
          edgesList.push({
            id: `${prevId}-->${nodeId}`,
            source: prevId,
            sourceHandle: 'right',
            target: nodeId,
            targetHandle: 'left',
            type: 'smoothstep',
            animated: edgeAnimated,
            style: edgeStyle,
          });
        }
      });

      // Side label node for Feature name (plain text, no handles/edges)
      nodesList.push({
        id: `${feature.name}::label`,
        type: 'featureLabel',
        position: { x: -140, y: rowY + NODE_H / 2 - 10 },
        data: { label: feature.name },
        style: { width: 120, pointerEvents: 'none' },
        selectable: false,
        draggable: false,
      });
    });

    return { nodes: nodesList, edges: edgesList };
  }, [state, onSelectPhaseFile]);

  const onNodeClick = (_: any, node: Node) => {
    if (node.id.includes('::')) {
      const parts = node.id.split('::');
      const featureName = parts[0];
      onSelectFeature(featureName);
    }
  };

  return (
    <div className="w-full h-full bg-zinc-50 dark:bg-black">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        fitView
        minZoom={0.5}
        maxZoom={1.5}
      >
        <Background gap={16} size={1} color="#e4e4e7" className="dark:opacity-10" />
        <Controls showInteractive={false} className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 rounded shadow-md" />
      </ReactFlow>
    </div>
  );
};
export default DagMap;
