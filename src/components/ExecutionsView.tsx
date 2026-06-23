'use client';

import React, { useState } from 'react';
import {
  Activity, Rocket, Radar, Wrench, Loader2, CheckCircle2, XCircle,
  Layers, ShieldCheck, X, FileText, List, Share2, Maximize2, Minimize2,
} from 'lucide-react';
import { WorkflowState } from '../domain/models/types';
import { ExecutionRecord, ExecutionKind, ExecutionStatus } from '../domain/models/executions';
import { DevOpsAgent, DevOpsCategory } from '../domain/models/devopsAgents';
import { fmtUSD, fmtTokens, fmtDuration, fmtClock } from '../lib/format';
import ExecutionGraph from './ExecutionGraph';

type ExecutionsViewProps = {
  state: WorkflowState;
  executions: ExecutionRecord[];
  devopsAgents: DevOpsAgent[];
  runningDevOps: string | null; // agent id currently being launched
  onRunDevOps: (agentId: string) => void;
  theme: 'light' | 'dark';
};

const statusChip = (status: ExecutionStatus): string => {
  switch (status) {
    case 'running': return 'text-blue-500 bg-blue-500/10 animate-pulse';
    case 'passed': return 'text-green-500 bg-green-500/10';
    case 'failed': return 'text-red-500 bg-red-500/10';
    default: return 'text-zinc-400 bg-zinc-100 dark:bg-zinc-900';
  }
};

const StatusIcon: React.FC<{ status: ExecutionStatus }> = ({ status }) => {
  if (status === 'running') return <Loader2 size={13} className="animate-spin" />;
  if (status === 'passed') return <CheckCircle2 size={13} />;
  if (status === 'failed') return <XCircle size={13} />;
  return null;
};

const kindMeta: Record<ExecutionKind, { label: string; icon: React.ReactNode }> = {
  phase: { label: 'Phase', icon: <Layers size={12} /> },
  persona: { label: 'Persona', icon: <ShieldCheck size={12} /> },
  devops: { label: 'DevOps', icon: <Rocket size={12} /> },
};

const devopsIcon = (category: DevOpsCategory) => {
  if (category === 'monitor') return <Radar size={13} />;
  if (category === 'troubleshoot') return <Wrench size={13} />;
  return <Rocket size={13} />;
};

export const ExecutionsView: React.FC<ExecutionsViewProps> = ({
  state, executions, devopsAgents, runningDevOps, onRunDevOps, theme,
}) => {
  const [logId, setLogId] = useState<string | null>(null);
  const [log, setLog] = useState<string>('');
  const [logLoading, setLogLoading] = useState(false);
  const [mode, setMode] = useState<'list' | 'graph'>('list');
  const [graphMax, setGraphMax] = useState(false);

  const activeFeature = state.activeFeatureName;
  const enabledDevOps = devopsAgents.filter(a => a.enabled);

  const openLog = async (id: string) => {
    setLogId(id);
    setLog('');
    setLogLoading(true);
    try {
      const res = await fetch(`/api/executions/log?id=${encodeURIComponent(id)}`);
      const data = await res.json();
      setLog(data.log || '(no output captured)');
    } catch (e: any) {
      setLog(`Failed to load log: ${e.message}`);
    } finally {
      setLogLoading(false);
    }
  };

  const modeToggle = (
    <div className="flex items-center bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md p-0.5">
      <button
        onClick={() => setMode('list')}
        className={`px-2 py-1 rounded transition text-[11px] flex items-center gap-1 font-semibold ${mode === 'list' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-sm' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
      >
        <List size={12} /> List
      </button>
      <button
        onClick={() => setMode('graph')}
        className={`px-2 py-1 rounded transition text-[11px] flex items-center gap-1 font-semibold ${mode === 'graph' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-sm' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
      >
        <Share2 size={12} /> Graph
      </button>
    </div>
  );

  const devopsToolbar = (
    <div className="mb-4 shrink-0">
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">DevOps — run on demand</h3>
        <span className="text-[10px] text-zinc-400">
          {activeFeature ? `Target: ${activeFeature}` : 'Workspace-wide (no active feature)'}
        </span>
      </div>
      {enabledDevOps.length === 0 ? (
        <p className="text-[11px] text-zinc-500 italic">
          No DevOps agents enabled. Enable them in <span className="font-semibold">Agents → DevOps</span>, and install the
          {' '}<span className="font-mono">DevOps Agents</span> extension from the Extensions panel.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {enabledDevOps.map(a => (
            <button
              key={a.id}
              onClick={() => onRunDevOps(a.id)}
              disabled={runningDevOps !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-black dark:bg-white text-white dark:text-black rounded-lg text-[11px] font-semibold hover:opacity-90 transition disabled:opacity-50"
              title={a.description || a.command}
            >
              {runningDevOps === a.id ? <Loader2 size={13} className="animate-spin" /> : devopsIcon(a.category)}
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const listBody = (
    executions.length === 0 ? (
      <div className="text-xs text-zinc-500 italic py-8 text-center">
        No executions recorded yet. Run a phase, the review gate, or a DevOps agent to see runs here.
        <div className="mt-1 text-[10px] not-italic text-zinc-400">
          Spec-agent hooks run inside the specify CLI and appear via the specification phase run.
        </div>
      </div>
    ) : (
      <div className="space-y-1.5">
        {executions.map(e => {
          const duration = e.completedAt && e.startedAt ? e.completedAt - e.startedAt : e.cost?.durationMs;
          return (
            <button
              key={e.id}
              onClick={() => openLog(e.id)}
              className="w-full flex items-center gap-3 p-2.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 transition text-left"
            >
              <span className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${statusChip(e.status)}`}>
                <StatusIcon status={e.status} />
                {e.status}
              </span>
              <span className="flex items-center gap-1 text-[9px] font-semibold text-zinc-500 uppercase shrink-0 w-16">
                {kindMeta[e.kind].icon}{kindMeta[e.kind].label}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-zinc-900 dark:text-white truncate">{e.label}</div>
                <div className="text-[10px] text-zinc-500 font-mono truncate">
                  {e.feature || 'workspace'}{e.command ? ` · ${e.command}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-zinc-500 shrink-0">
                <span title="started">{fmtClock(e.startedAt)}</span>
                {typeof duration === 'number' && <span title="duration">{fmtDuration(duration)}</span>}
                {e.cost?.costUSD !== undefined && <span title="cost">{fmtUSD(e.cost.costUSD)}</span>}
                {e.cost?.totalTokens !== undefined && <span title="tokens">{fmtTokens(e.cost.totalTokens)} tok</span>}
                {typeof e.exitCode === 'number' && <span className="font-mono" title="exit code">#{e.exitCode}</span>}
              </div>
            </button>
          );
        })}
      </div>
    )
  );

  return (
    <div className="w-full h-full flex flex-col px-6 py-5">
      {devopsToolbar}

      {/* Header + mode toggle */}
      <div className="flex items-center gap-2 mb-3 shrink-0">
        <Activity size={15} className="text-zinc-500" />
        <h3 className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">Agent executions</h3>
        <span className="text-[10px] text-zinc-400">{executions.length} run{executions.length !== 1 ? 's' : ''}</span>
        <div className="ml-auto flex items-center gap-2">
          {mode === 'graph' && (
            <button
              onClick={() => setGraphMax(true)}
              className="p-1.5 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition"
              title="Maximize graph (full screen)"
            >
              <Maximize2 size={14} />
            </button>
          )}
          {modeToggle}
        </div>
      </div>

      {/* Body */}
      <div className={mode === 'list' ? 'flex-1 min-h-0 overflow-y-auto' : 'flex-1 min-h-0 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden'}>
        {mode === 'list'
          ? listBody
          : graphMax
            ? <div className="flex items-center justify-center h-full text-xs text-zinc-500 italic">Graph maximized — full screen.</div>
            : <ExecutionGraph executions={executions} theme={theme} onOpenLog={openLog} />}
      </div>

      {/* Maximized graph overlay (full width + full height) */}
      {graphMax && (
        <div className="fixed inset-0 z-40 bg-white dark:bg-black flex flex-col">
          <div className="flex items-center gap-2 px-5 py-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/40 shrink-0">
            <Share2 size={14} className="text-zinc-500" />
            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-200 uppercase tracking-wider">Execution graph</span>
            <span className="text-[10px] text-zinc-400">{executions.length} runs</span>
            <button
              onClick={() => setGraphMax(false)}
              className="ml-auto p-1.5 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition"
              title="Restore"
            >
              <Minimize2 size={15} />
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <ExecutionGraph executions={executions} theme={theme} onOpenLog={openLog} />
          </div>
        </div>
      )}

      {/* Log drawer (above the maximized overlay) */}
      {logId && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setLogId(null)}>
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 w-full max-w-3xl h-[80vh] rounded-xl flex flex-col overflow-hidden shadow-2xl" onClick={ev => ev.stopPropagation()}>
            <header className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50">
              <div className="flex items-center gap-2 text-zinc-900 dark:text-white">
                <FileText size={15} /> <span className="text-sm font-bold">Execution log</span>
              </div>
              <button onClick={() => setLogId(null)} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 transition">
                <X size={16} />
              </button>
            </header>
            <pre className="flex-1 overflow-auto p-4 bg-black text-zinc-300 font-mono text-[11px] leading-relaxed whitespace-pre-wrap select-text">
              {logLoading ? 'Loading…' : log}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExecutionsView;
