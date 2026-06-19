'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

const TerminalPanel = dynamic(() => import('@/components/TerminalPanel'), {
  ssr: false,
});

import {
  WorkflowState,
  WorkflowPhase,
  AgentConfig,
  AgentType,
  PhaseStatus,
  PersonaConfig,
  PersonaId,
  PhaseState
} from '@/domain/models/types';
import { DEFAULT_PERSONAS } from '@/domain/models/personas';
import KanbanBoard from '@/components/KanbanBoard';
import DagMap from '@/components/DagMap';
import MarkdownEditor from '@/components/MarkdownEditor';
import AgentConsole, { type AgentConsoleHandle } from '@/components/AgentConsole';
import { PersonaEditorModal } from '@/components/PersonaEditorModal';
import { HumanReviewModal } from '@/components/HumanReviewModal';
import AgentsPanel from '@/components/AgentsPanel';
import McpPanel from '@/components/McpPanel';
import { AgentsFile, DEFAULT_AGENTS, toAgentConfig, activeAgent } from '@/domain/models/agents';
import { McpFile, DEFAULT_MCP } from '@/domain/models/mcp';
import {
  Sun,
  Moon,
  Plus,
  Play,
  RotateCcw,
  Check,
  LayoutGrid,
  GitFork,
  X,
  ChevronRight,
  ChevronLeft,
  Folder,
  Sparkles,
  Maximize2,
  Minimize2,
  ShieldCheck,
  Bot,
  Plug
} from 'lucide-react';

const PHASE_LABELS: Record<WorkflowPhase, string> = {
  constitution: 'Constitution',
  specification: 'Specification',
  clarification: 'Clarification',
  planning: 'Planning',
  checklist: 'Checklist',
  analyze: 'Analysis',
  tasks: 'Tasks',
  taskstoissues: 'Tasks to Issues',
  implementation: 'Implementation',
};

export default function Dashboard() {
  const [state, setState] = useState<WorkflowState | null>(null);
  const agentConsoleRef = React.useRef<AgentConsoleHandle | null>(null);
  const [selectedFile, setSelectedFile] = useState<{ path: string; content: string } | null>(null);
  
  const [viewMode, setViewMode] = useState<'kanban' | 'dag'>('kanban');
  const [section, setSection] = useState<'workflow' | 'agents' | 'mcp'>('workflow');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [agentConfig, setAgentConfig] = useState<AgentConfig>({
    agentType: 'claude',
    customCommand: '',
    agentPath: '',
  });
  const [agentsFile, setAgentsFile] = useState<AgentsFile>(DEFAULT_AGENTS);
  const [mcpFile, setMcpFile] = useState<McpFile>(DEFAULT_MCP);
  const [prompt, setPrompt] = useState<string>('');
  const [personaConfigs, setPersonaConfigs] = useState<PersonaConfig[]>(DEFAULT_PERSONAS);
  const [editingPersona, setEditingPersona] = useState<PersonaConfig | null>(null);
  const [auditingFeature, setAuditingFeature] = useState<{ name: string; phaseState: PhaseState } | null>(null);
  const [newFeatureName, setNewFeatureName] = useState<string>('');
  const [running, setRunning] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'console' | 'terminal'>('editor');
  const [runningPhase, setRunningPhase] = useState<{ phase: WorkflowPhase; featureName: string | null } | null>(null);
  const [isEditorMaximized, setIsEditorMaximized] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed(prev => {
      const nextVal = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('isSidebarCollapsed', String(nextVal));
      }
      return nextVal;
    });
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('isSidebarCollapsed');
      if (saved === 'true') {
        setIsSidebarCollapsed(true);
      }
    }
  }, []);

  // Ref to track current file for SSE listener
  const selectedFileRef = React.useRef(selectedFile);
  useEffect(() => {
    selectedFileRef.current = selectedFile;
  }, [selectedFile]);

  // Initialize
  useEffect(() => {
    fetchState();
    fetchPersonas();
    fetchAgents();
    fetchMcp();

    // Default to light mode
    const root = window.document.documentElement;
    root.classList.remove('dark');

    // Live file observer
    const eventSource = new EventSource('/api/state/watch');
    eventSource.addEventListener('update', (event) => {
      const payload = JSON.parse(event.data);
      const newState = payload.state || payload;
      const changedFile = payload.changedFile || null;

      setState(newState);

      if (selectedFileRef.current && changedFile) {
        const currentPath = selectedFileRef.current.path.replace(/\\/g, '/');
        const normChangedFile = changedFile.replace(/\\/g, '/');
        if (currentPath === normChangedFile) {
          handleLoadFile(selectedFileRef.current.path);
        }
      }
    });

    return () => {
      eventSource.close();
    };
  }, []);

  const fetchState = async () => {
    try {
      const res = await fetch('/api/state');
      const data = await res.json();
      setState(data);
    } catch (err) {
      console.error('Failed to fetch state:', err);
    }
  };

  const fetchPersonas = async () => {
    try {
      const res = await fetch('/api/personas');
      if (res.ok) {
        const data = await res.json();
        setPersonaConfigs(data);
      }
    } catch (err) {
      console.error('Failed to fetch personas:', err);
    }
  };

  const fetchAgents = async () => {
    try {
      const res = await fetch('/api/agents');
      if (res.ok) setAgentsFile(await res.json());
    } catch (err) {
      console.error('Failed to fetch agents:', err);
    }
  };

  const fetchMcp = async () => {
    try {
      const res = await fetch('/api/mcp');
      if (res.ok) setMcpFile(await res.json());
    } catch (err) {
      console.error('Failed to fetch MCP servers:', err);
    }
  };

  // Keep the runner's AgentConfig in sync with the active agent profile.
  useEffect(() => {
    const a = activeAgent(agentsFile);
    if (a) setAgentConfig(toAgentConfig(a));
  }, [agentsFile]);

  const handleSaveAgents = async (file: AgentsFile) => {
    setAgentsFile(file);
    try {
      await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(file),
      });
    } catch (err) {
      console.error('Failed to save agents:', err);
    }
  };

  const handleSaveMcp = async (file: McpFile) => {
    setMcpFile(file);
    try {
      await fetch('/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(file),
      });
    } catch (err) {
      console.error('Failed to save MCP servers:', err);
    }
  };

  const handleApplyMcp = async (agentId: string) => {
    const res = await fetch('/api/mcp/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId }),
    });
    return res.json();
  };

  const handleSavePersonasList = async (next: PersonaConfig[]) => {
    setPersonaConfigs(next);
    try {
      await fetch('/api/personas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
    } catch (err) {
      console.error('Failed to save personas:', err);
    }
  };

  const handleSavePersona = async (updated: PersonaConfig) => {
    const next = personaConfigs.map(p => p.id === updated.id ? updated : p);
    setPersonaConfigs(next);
    setEditingPersona(null);

    try {
      await fetch('/api/personas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next)
      });
    } catch (err) {
      console.error('Failed to save persona config:', err);
    }
  };

  const handleToggleTheme = () => {
    const root = window.document.documentElement;
    if (theme === 'light') {
      root.classList.add('dark');
      setTheme('dark');
    } else {
      root.classList.remove('dark');
      setTheme('light');
    }
  };

  const handleSelectFeature = async (name: string) => {
    try {
      const res = await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeFeatureName: name }),
      });
      const data = await res.json();
      setState(data);

      // Auto load the spec.md of the selected feature if it exists
      const feature = data.features.find((f: any) => f.name === name);
      const specPhase = feature?.phases.find((p: any) => p.phase === 'specification');
      if (specPhase?.filePath) {
        handleLoadFile(specPhase.filePath);
      } else {
        setSelectedFile(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateFeature = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFeatureName.trim()) return;
    try {
      const res = await fetch('/api/feature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFeatureName.trim() }),
      });
      const data = await res.json();
      setState(data);
      setNewFeatureName('');
      
      // Select the newly created feature's spec phase
      const specPath = `specs/${newFeatureName.trim()}/spec.md`;
      setSelectedFile({ path: specPath, content: '' });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteFeature = async (name: string) => {
    if (!confirm(`Are you sure you want to delete feature "${name}"?`)) return;
    try {
      const res = await fetch('/api/feature', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      setState(data);
      if (state?.activeFeatureName === name) {
        setSelectedFile(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleLoadFile = async (path: string) => {
    try {
      const res = await fetch(`/api/file?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      setSelectedFile(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveFile = async (content: string) => {
    if (!selectedFile) return;
    try {
      const res = await fetch('/api/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: selectedFile.path, content }),
      });
      const data = await res.json();
      setSelectedFile({ path: selectedFile.path, content });
      if (data.state) {
        setState(data.state);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleTask = async (lineIndex: number, checked: boolean) => {
    if (!state?.activeFeatureName) return;
    try {
      const res = await fetch('/api/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          featureName: state.activeFeatureName,
          lineIndex,
          checked
        }),
      });
      const data = await res.json();
      setState(data);
      
      // Reload the tasks file content to show updated preview
      const activeFeature = data.features.find((f: any) => f.name === data.activeFeatureName);
      const tasksPhase = activeFeature?.phases.find((p: any) => p.phase === 'tasks');
      if (tasksPhase?.filePath && selectedFile?.path === tasksPhase.filePath) {
        handleLoadFile(tasksPhase.filePath);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Consumes the SSE stream from a phase 'run' / 'run-gate' request, piping log
  // chunks to the xterm console and applying the final state.
  const consumePhaseStream = async (
    response: Response,
    phase: WorkflowPhase,
    featureName: string | null
  ) => {
    const reader = response.body?.getReader();
    if (!reader) {
      setRunning(false);
      setRunningPhase(null);
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value);
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('event: log')) {
          const dataLine = line.split('\n').find(l => l.startsWith('data: '));
          if (dataLine) {
            const data = JSON.parse(dataLine.substring(6));
            agentConsoleRef.current?.write(data.text);
          }
        } else if (line.startsWith('event: done')) {
          const dataLine = line.split('\n').find(l => l.startsWith('data: '));
          if (dataLine) {
            const data = JSON.parse(dataLine.substring(6));
            setState(data.state);
            const targetFeature = featureName || data.state.activeFeatureName;
            const feat = data.state.features.find((f: any) => f.name === targetFeature);
            const activePhase = feat?.phases.find((p: any) => p.phase === phase);
            if (activePhase?.filePath) {
              handleLoadFile(activePhase.filePath);
            }
          }
          setRunning(false);
          setRunningPhase(null);
          setPrompt('');
        } else if (line.startsWith('event: error')) {
          const dataLine = line.split('\n').find(l => l.startsWith('data: '));
          if (dataLine) {
            const data = JSON.parse(dataLine.substring(6));
            agentConsoleRef.current?.write(`\r\n\x1b[31mError: ${data.message}\x1b[0m\r\n`);
          }
          setRunning(false);
          setRunningPhase(null);
        }
      }
    }

    fetchState();
  };

  const handleRunPhase = async (phase: WorkflowPhase, featureName: string | null) => {
    agentConsoleRef.current?.clear();
    setRunning(true);
    setActiveTab('console');
    setRunningPhase({ phase, featureName: featureName || state?.activeFeatureName || null });

    try {
      const response = await fetch('/api/phase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'run',
          phase,
          featureName: featureName || state?.activeFeatureName,
          agentConfig,
          prompt,
          // The implementation phase runs the persona review gate after the
          // /speckit.implement step. Other phases ignore this field.
          ...(phase === 'implementation' ? { personas: personaConfigs } : {})
        })
      });
      await consumePhaseStream(response, phase, featureName);
    } catch (err: any) {
      agentConsoleRef.current?.write(`\r\n\x1b[31mExecution failed: ${err.message}\x1b[0m\r\n`);
      setRunning(false);
      setRunningPhase(null);
    }
  };

  // Re-runs only the implementation review gate (personas), without re-running
  // /speckit.implement.
  const handleRerunGate = async (featureName: string | null) => {
    const feature = featureName || state?.activeFeatureName || null;
    agentConsoleRef.current?.clear();
    setRunning(true);
    setActiveTab('console');
    setRunningPhase({ phase: 'implementation', featureName: feature });

    try {
      const response = await fetch('/api/phase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'run-gate',
          phase: 'implementation',
          featureName: feature,
          agentConfig,
          personas: personaConfigs
        })
      });
      await consumePhaseStream(response, 'implementation', feature);
    } catch (err: any) {
      agentConsoleRef.current?.write(`\r\n\x1b[31mExecution failed: ${err.message}\x1b[0m\r\n`);
      setRunning(false);
      setRunningPhase(null);
    }
  };

  // The persona currently executing (if any), so terminal input/resize is routed
  // to its PTY rather than the implement step's.
  const activePersonaId = (): PersonaId | undefined => {
    if (runningPhase?.phase !== 'implementation') return undefined;
    const feat = state?.features.find(f => f.name === runningPhase.featureName);
    const impl = feat?.phases.find(p => p.phase === 'implementation');
    return impl?.personas?.find(p => p.status === 'running')?.id;
  };

  // Forward raw terminal keystrokes to the running agent's PTY so interactive
  // prompts (e.g. the clarify Q&A picker) can be navigated with arrow keys.
  const handleAgentInput = (data: string) => {
    if (!runningPhase) return;
    fetch('/api/phase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'input',
        phase: runningPhase.phase,
        featureName: runningPhase.featureName,
        text: data,
        personaId: activePersonaId()
      })
    }).catch((err) => console.error('Failed to send input:', err));
  };

  // Keep the backend PTY sized to the visible terminal so wrapping and
  // full-screen prompts render correctly.
  const handleAgentResize = (cols: number, rows: number) => {
    if (!runningPhase) return;
    fetch('/api/phase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'resize',
        phase: runningPhase.phase,
        featureName: runningPhase.featureName,
        cols,
        rows,
        personaId: activePersonaId()
      })
    }).catch(() => {});
  };

  const handleStopPhase = async (phase: WorkflowPhase, featureName: string | null) => {
    try {
      const targetFeature = featureName || state?.activeFeatureName || null;
      const personaId = activePersonaId();
      await fetch('/api/phase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'stop',
          phase,
          featureName: targetFeature,
          personaId
        })
      });
      setRunning(false);
      setRunningPhase(null);
      fetchState();
    } catch (err) {
      console.error('Failed to stop phase:', err);
    }
  };

  const handleApprovePhase = async (phase: WorkflowPhase, featureName: string | null) => {
    try {
      const res = await fetch('/api/phase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          phase,
          featureName: featureName || state?.activeFeatureName
        })
      });
      const data = await res.json();
      setState(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDiscardPhase = async (phase: WorkflowPhase, featureName: string | null) => {
    try {
      const res = await fetch('/api/phase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'discard',
          phase,
          featureName: featureName || state?.activeFeatureName
        })
      });
      const data = await res.json();
      setState(data);
      if (selectedFile?.path && selectedFile.path.includes(phase)) {
        setSelectedFile(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCardDrop = async (featureName: string, targetColKey: string) => {
    if (!state) return;
    const feature = state.features.find(f => f.name === featureName);
    if (!feature) return;

    const phasesOrder: WorkflowPhase[] = [
      'specification',
      'clarification',
      'planning',
      'checklist',
      'analyze',
      'tasks',
      'taskstoissues',
      'implementation'
    ];

    const getActivePhase = (): WorkflowPhase | 'completed' => {
      for (const p of feature.phases) {
        if (p.status !== 'approved') return p.phase;
      }
      return 'completed';
    };

    const currentPhase = getActivePhase();
    if (currentPhase === targetColKey) return;

    const currentIndex = currentPhase === 'completed' ? phasesOrder.length : phasesOrder.indexOf(currentPhase);
    const targetIndex = targetColKey === 'completed' ? phasesOrder.length : phasesOrder.indexOf(targetColKey as WorkflowPhase);

    if (state.activeFeatureName !== featureName) {
      await handleSelectFeature(featureName);
    }

    if (targetIndex > currentIndex) {
      // Progressing FORWARD
      for (let i = currentIndex; i < targetIndex; i++) {
        const phaseToApprove = phasesOrder[i];
        const res = await fetch('/api/phase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'approve',
            phase: phaseToApprove,
            featureName
          })
        });
        const updatedState = await res.json();
        setState(updatedState);
      }

      if (targetColKey !== 'completed') {
        const targetPhase = targetColKey as WorkflowPhase;
        handleRunPhase(targetPhase, featureName);
      }
    } else {
      // Progressing BACKWARD
      const targetPhase = targetColKey as WorkflowPhase;
      const res = await fetch('/api/phase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'discard',
          phase: targetPhase,
          featureName
        })
      });
      const updatedState = await res.json();
      setState(updatedState);

      if (selectedFile?.path && selectedFile.path.includes(targetPhase)) {
        setSelectedFile(null);
      }
    }
  };

  // Helper: Find current active phase for Prompt input box
  const getActivePhaseForExecution = (): { phase: WorkflowPhase; label: string } => {
    if (!state) return { phase: 'constitution', label: 'Constitution' };
    if (state.constitutionPhase.status !== 'approved') {
      return { phase: 'constitution', label: 'Constitution' };
    }
    const feat = state.features.find(f => f.name === state.activeFeatureName);
    if (!feat) return { phase: 'specification', label: 'Specification' };
    
    for (const p of feat.phases) {
      if (p.status !== 'approved') {
        return { phase: p.phase, label: PHASE_LABELS[p.phase] };
      }
    }
    return { phase: 'specification', label: 'Specification' };
  };

  const activeExec = getActivePhaseForExecution();

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-black text-zinc-900 dark:text-zinc-50 overflow-hidden font-sans">
      
      {/* Top Header Navigation */}
      <header className="flex justify-between items-center px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black z-10 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xl">🌱</span>
          <div>
            <h1 className="text-sm font-bold tracking-tight">Spec Kit Assistant</h1>
            <p className="text-[10px] text-zinc-400 font-mono">WORKSPACE: {state ? 'ACTIVE' : 'CONNECTING...'}</p>
          </div>
        </div>

        {/* Top Control Bar */}
        <div className="flex items-center gap-3">
          {/* Section Selector */}
          <div className="flex items-center bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-0.5">
            {([
              { id: 'workflow', label: 'Workflow', icon: <LayoutGrid size={13} /> },
              { id: 'agents', label: 'Agents', icon: <Bot size={13} /> },
              { id: 'mcp', label: 'MCP Tools', icon: <Plug size={13} /> },
            ] as const).map(s => (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className={`px-2.5 py-1.5 rounded-md transition text-xs flex items-center gap-1.5 font-semibold ${section === s.id ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-sm' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
              >
                {s.icon}
                <span>{s.label}</span>
              </button>
            ))}
          </div>

          {section === 'workflow' && (
            <>
              {/* Mode Selector */}
              <div className="flex items-center bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode('kanban')}
                  className={`p-1.5 rounded-md transition text-xs flex items-center gap-1.5 ${viewMode === 'kanban' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-sm' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
                >
                  <LayoutGrid size={13} />
                  <span>Kanban</span>
                </button>
                <button
                  onClick={() => setViewMode('dag')}
                  className={`p-1.5 rounded-md transition text-xs flex items-center gap-1.5 ${viewMode === 'dag' ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-sm' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
                >
                  <GitFork size={13} />
                  <span>DAG Map</span>
                </button>
              </div>

              {/* Review Portal / Audit Trigger */}
              <button
                onClick={() => {
                  const activeFeatureName = state?.activeFeatureName;
                  const activeFeature = state?.features.find(f => f.name === activeFeatureName);
                  const implPhase = activeFeature?.phases.find(p => p.phase === 'implementation') || {
                    phase: 'implementation',
                    status: 'idle',
                    filePath: null,
                    content: null
                  };
                  setAuditingFeature({
                    name: activeFeatureName || 'Workspace',
                    phaseState: implPhase
                  });
                }}
                className="p-2 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition hover:bg-zinc-100 dark:hover:bg-zinc-900 flex items-center gap-1.5 text-xs font-semibold"
                title="Open Human Review Portal"
              >
                <ShieldCheck size={14} className="text-blue-500" />
                <span className="hidden sm:inline">Review Portal</span>
              </button>
            </>
          )}

          {/* Theme Switcher */}
          <button
            onClick={handleToggleTheme}
            className="p-2 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
          </button>
        </div>
      </header>

      {/* Main body split container */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {section === 'agents' && (
          <AgentsPanel
            agentsFile={agentsFile}
            mcpServers={mcpFile.servers}
            personaConfigs={personaConfigs}
            onSaveAgents={handleSaveAgents}
            onSavePersonas={handleSavePersonasList}
            onEditPersona={setEditingPersona}
            onApply={handleApplyMcp}
          />
        )}

        {section === 'mcp' && (
          <McpPanel mcpFile={mcpFile} onSave={handleSaveMcp} />
        )}

        {section === 'workflow' && (
        <>
        {/* Left Sidebar: Feature Manager */}
        <aside className={`border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20 flex flex-col shrink-0 transition-all duration-300 ${isSidebarCollapsed ? 'w-12 items-center justify-between py-4' : 'w-64'}`}>
          {isSidebarCollapsed ? (
            <>
              {/* Collapsed Top: Expand Toggle */}
              <button
                onClick={handleToggleSidebar}
                className="p-1.5 hover:bg-zinc-150 dark:hover:bg-zinc-900 rounded text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition"
                title="Expand Sidebar"
              >
                <ChevronRight size={16} />
              </button>

              {/* Collapsed Middle: Features Indicator */}
              <div
                onClick={handleToggleSidebar}
                className="relative group cursor-pointer p-2 rounded hover:bg-zinc-150 dark:hover:bg-zinc-900 transition text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                title="Click to view Features list"
              >
                <Folder size={18} />
                {state?.features && state.features.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-black dark:bg-white text-white dark:text-black text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                    {state.features.length}
                  </span>
                )}
              </div>

              {/* Collapsed Bottom: Agent Prompt Indicator */}
              <div
                onClick={handleToggleSidebar}
                className="group cursor-pointer p-2 rounded hover:bg-zinc-150 dark:hover:bg-zinc-900 transition text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                title={`Trigger Agent: ${activeExec.label}`}
              >
                <Sparkles size={16} />
              </div>
            </>
          ) : (
            <>
              {/* Expanded Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Features Manager</span>
                <button
                  onClick={handleToggleSidebar}
                  className="p-1 hover:bg-zinc-150 dark:hover:bg-zinc-900 rounded text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition"
                  title="Collapse Sidebar"
                >
                  <ChevronLeft size={14} />
                </button>
              </div>

              {/* Create feature form */}
              <form onSubmit={handleCreateFeature} className="p-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="New feature name..."
                    value={newFeatureName}
                    onChange={(e) => setNewFeatureName(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-md text-xs outline-none focus:border-zinc-400 dark:focus:border-zinc-650"
                  />
                  <button
                    type="submit"
                    className="p-2 bg-black dark:bg-white text-white dark:text-black rounded-md hover:opacity-90 transition"
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </form>

              {/* Features list */}
              <div className="flex-1 overflow-y-auto p-3 space-y-1" style={{ scrollbarWidth: 'thin' }}>
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  Features
                </div>
                {state?.features.map((feat) => {
                  const isActive = state.activeFeatureName === feat.name;
                  return (
                    <div
                      key={feat.name}
                      onClick={() => handleSelectFeature(feat.name)}
                      className={`group flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium cursor-pointer transition ${isActive ? 'bg-zinc-100 dark:bg-zinc-900 text-zinc-950 dark:text-zinc-50' : 'text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-950'}`}
                    >
                      <span className="truncate">{feat.name}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFeature(feat.name);
                        }}
                        className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded text-zinc-400 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  );
                })}
                {state?.features.length === 0 && (
                  <p className="text-xs text-zinc-400 italic p-2">No features created yet.</p>
                )}
              </div>

              {/* Agent execution prompt box */}
              <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black shrink-0">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    Trigger Agent: {activeExec.label}
                  </span>
                  <Sparkles size={10} className="text-zinc-400" />
                </div>
                <textarea
                  placeholder="Refinements or prompts..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  disabled={running || !state}
                  className="w-full h-16 p-2 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md outline-none resize-none disabled:opacity-50"
                />
                {running ? (
                  <button
                    onClick={() => {
                      if (runningPhase) {
                        handleStopPhase(runningPhase.phase, runningPhase.featureName);
                      }
                    }}
                    className="w-full mt-2 py-1.5 bg-red-650 hover:bg-red-700 text-white rounded-md text-xs font-semibold transition flex items-center justify-center gap-1"
                  >
                    <X size={10} /> Stop Execution
                  </button>
                ) : (
                  <button
                    onClick={() => handleRunPhase(activeExec.phase, null)}
                    disabled={!state}
                    className="w-full mt-2 py-1.5 bg-black dark:bg-white text-white dark:text-black rounded-md text-xs font-semibold hover:opacity-90 transition flex items-center justify-center gap-1 disabled:opacity-50"
                  >
                    <Play size={10} fill="currentColor" /> Run {activeExec.label}
                  </button>
                )}
              </div>
            </>
          )}
        </aside>

        {/* Central visual panel (Kanban/DAG) and editor split */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-white dark:bg-black relative">
          
          {/* Split Area: Top (Visual Board), Bottom (Editor or Console) */}
          <div className="flex-1 flex flex-col min-h-0">
            {/* Visualizer Area (Kanban / DAG Map) */}
            {!isEditorMaximized && (
              <div className="flex-1 min-h-[50%] relative">
                {state ? (
                  viewMode === 'kanban' ? (
                    <KanbanBoard
                      state={state}
                      onRunPhase={handleRunPhase}
                      onApprovePhase={handleApprovePhase}
                      onDiscardPhase={handleDiscardPhase}
                      onSelectFeature={handleSelectFeature}
                      onDeleteFeature={handleDeleteFeature}
                      onSelectPhaseFile={handleLoadFile}
                      onCardDrop={handleCardDrop}
                      onRerunGate={handleRerunGate}
                      onOpenReview={(name, phaseState) => setAuditingFeature({ name, phaseState })}
                      onStopPhase={handleStopPhase}
                    />
                  ) : (
                    <DagMap
                      state={state}
                      onSelectFeature={handleSelectFeature}
                      onSelectPhaseFile={handleLoadFile}
                    />
                  )
                ) : (
                  <div className="flex items-center justify-center h-full text-zinc-400 text-xs">
                    Loading Spec-Driven Development workspace state...
                  </div>
                )}
              </div>
            )}

            {/* Split panel: Content Editor, Terminal log console, or Full Terminal */}
            <div className={`flex flex-col min-h-0 bg-white dark:bg-black transition-all duration-300 ${isEditorMaximized ? 'flex-1 h-full' : 'h-[40%] border-t border-zinc-200 dark:border-zinc-800'}`}>
              {/* Tab Header for lower split */}
              <div className="flex justify-between items-center px-4 py-2 border-b border-zinc-150 dark:border-zinc-900 bg-zinc-50/70 dark:bg-zinc-950/20 shrink-0">
                <div className="flex gap-4">
                  <button
                    onClick={() => setActiveTab('editor')}
                    className={`text-xs font-bold tracking-wide transition pb-1 border-b-2 ${activeTab === 'editor' ? 'text-black dark:text-white border-black dark:border-white' : 'text-zinc-400 border-transparent'}`}
                  >
                    MARKDOWN EDITOR
                  </button>
                  <button
                    onClick={() => setActiveTab('console')}
                    className={`text-xs font-bold tracking-wide transition pb-1 border-b-2 ${activeTab === 'console' ? 'text-black dark:text-white border-black dark:border-white' : 'text-zinc-400 border-transparent'}`}
                  >
                    AGENT RUN CONSOLE {running && <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse ml-1" />}
                  </button>
                  <button
                    onClick={() => setActiveTab('terminal')}
                    className={`text-xs font-bold tracking-wide transition pb-1 border-b-2 ${activeTab === 'terminal' ? 'text-black dark:text-white border-black dark:border-white' : 'text-zinc-400 border-transparent'}`}
                  >
                    WORKSPACE TERMINAL
                  </button>
                </div>
                <button
                  onClick={() => setIsEditorMaximized(!isEditorMaximized)}
                  className="p-1.5 rounded text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition"
                  title={isEditorMaximized ? "Restore Layout" : "Maximize Panel"}
                >
                  {isEditorMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                </button>
              </div>

              {/* Lower split content */}
              <div className="flex-1 min-h-0 overflow-hidden">
                {activeTab === 'editor' && (
                  <div className="h-full p-3 bg-white dark:bg-black">
                    <MarkdownEditor
                      filePath={selectedFile?.path || null}
                      initialContent={selectedFile?.content || null}
                      onSave={handleSaveFile}
                      onToggleTask={handleToggleTask}
                      state={state}
                      isMaximized={isEditorMaximized}
                      onToggleMaximize={() => setIsEditorMaximized(!isEditorMaximized)}
                      onSelectFile={handleLoadFile}
                    />
                  </div>
                )}
                {/* Kept mounted (hidden when inactive) so streamed agent output
                    and the xterm scrollback survive tab switches mid-run. */}
                <div className={activeTab === 'console' ? 'h-full' : 'hidden'}>
                  <AgentConsole
                    ref={agentConsoleRef}
                    active={activeTab === 'console'}
                    running={running}
                    onInput={handleAgentInput}
                    onResize={handleAgentResize}
                  />
                </div>
                {activeTab === 'terminal' && (
                  <TerminalPanel />
                )}
              </div>
            </div>
          </div>
        </main>
        </>
        )}
      </div>
      {editingPersona && (
        <PersonaEditorModal
          isOpen={true}
          onClose={() => setEditingPersona(null)}
          persona={editingPersona}
          onSave={handleSavePersona}
        />
      )}
      {auditingFeature && (
        <HumanReviewModal
          isOpen={true}
          onClose={() => setAuditingFeature(null)}
          featureName={auditingFeature.name}
          activePhaseState={auditingFeature.phaseState}
          theme={theme}
          onApprove={() => {
            handleApprovePhase('implementation', auditingFeature.name);
            setAuditingFeature(null);
          }}
        />
      )}
    </div>
  );
}
export type { WorkflowPhase, AgentConfig, AgentType, PhaseStatus };
