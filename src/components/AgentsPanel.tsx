'use client';

import React, { useState } from 'react';
import { Bot, Plus, Pencil, Trash2, CheckCircle2, Circle, UploadCloud, Shield, Users, ArrowUp, ArrowDown, Rocket } from 'lucide-react';
import { AgentsFile, AgentProfile } from '../domain/models/agents';
import { McpServer } from '../domain/models/mcp';
import { PersonaConfig } from '../domain/models/types';
import { SpecAgentsFile, SpecAgent } from '../domain/models/specAgents';
import { DevOpsAgentsFile, DevOpsAgent } from '../domain/models/devopsAgents';
import type { McpApplyResult } from '../domain/ports/out/McpConfigPort';
import type { SpecAgentApplyResult } from '../domain/ports/out/SpecAgentRepositoryPort';
import { AgentEditorModal } from './AgentEditorModal';
import { SpecAgentEditorModal } from './SpecAgentEditorModal';
import { DevOpsAgentEditorModal } from './DevOpsAgentEditorModal';

type AgentsPanelProps = {
  agentsFile: AgentsFile;
  mcpServers: McpServer[];
  personaConfigs: PersonaConfig[];
  specAgentsFile: SpecAgentsFile;
  devopsAgentsFile: DevOpsAgentsFile;
  onSaveAgents: (file: AgentsFile) => void;
  onSavePersonas: (next: PersonaConfig[]) => void;
  onSaveSpecAgents: (file: SpecAgentsFile) => void;
  onSaveDevOpsAgents: (file: DevOpsAgentsFile) => void;
  onEditPersona: (p: PersonaConfig) => void;
  onApply: (agentId: string) => Promise<McpApplyResult & { error?: string }>;
  onApplySpecAgents: () => Promise<SpecAgentApplyResult & { error?: string }>;
};

export const AgentsPanel: React.FC<AgentsPanelProps> = ({
  agentsFile,
  mcpServers,
  personaConfigs,
  specAgentsFile,
  devopsAgentsFile,
  onSaveAgents,
  onSavePersonas,
  onSaveSpecAgents,
  onSaveDevOpsAgents,
  onEditPersona,
  onApply,
  onApplySpecAgents,
}) => {
  const [editing, setEditing] = useState<AgentProfile | null>(null);
  const [creating, setCreating] = useState(false);
  const [applyMsg, setApplyMsg] = useState<{ id: string; text: string; error?: boolean } | null>(null);
  const [applying, setApplying] = useState<string | null>(null);

  // Specification agents state
  const [editingSpec, setEditingSpec] = useState<SpecAgent | null>(null);
  const [creatingSpec, setCreatingSpec] = useState(false);
  const [specApplyMsg, setSpecApplyMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [specApplying, setSpecApplying] = useState(false);

  const specAgents = [...specAgentsFile.agents].sort((a, b) => a.priority - b.priority);

  const upsertSpec = (a: SpecAgent) => {
    const exists = specAgents.some(x => x.id === a.id);
    onSaveSpecAgents({ agents: exists ? specAgentsFile.agents.map(x => (x.id === a.id ? a : x)) : [...specAgentsFile.agents, a] });
    setEditingSpec(null);
    setCreatingSpec(false);
  };
  const removeSpec = (id: string) => {
    if (!confirm('Delete this specification agent?')) return;
    onSaveSpecAgents({ agents: specAgentsFile.agents.filter(a => a.id !== id) });
  };
  const toggleSpec = (id: string, patch: Partial<SpecAgent>) =>
    onSaveSpecAgents({ agents: specAgentsFile.agents.map(a => (a.id === id ? { ...a, ...patch } : a)) });
  const moveSpec = (id: string, dir: -1 | 1) => {
    const idx = specAgents.findIndex(a => a.id === id);
    const swap = idx + dir;
    if (swap < 0 || swap >= specAgents.length) return;
    const a = specAgents[idx], b = specAgents[swap];
    onSaveSpecAgents({ agents: specAgentsFile.agents.map(x => (x.id === a.id ? { ...x, priority: b.priority } : x.id === b.id ? { ...x, priority: a.priority } : x)) });
  };
  const applySpec = async () => {
    setSpecApplying(true);
    setSpecApplyMsg(null);
    try {
      const r = await onApplySpecAgents();
      if (r.error) setSpecApplyMsg({ text: r.error, error: true });
      else {
        const custom = r.customWritten?.length ? ` (+${r.customWritten.length} custom command file(s))` : '';
        setSpecApplyMsg({ text: `Wrote ${r.hookCount} hook(s) to ${r.path}${custom}` });
      }
    } catch (e: any) {
      setSpecApplyMsg({ text: e.message || 'Apply failed', error: true });
    } finally {
      setSpecApplying(false);
    }
  };

  // DevOps agents state
  const [editingDevops, setEditingDevops] = useState<DevOpsAgent | null>(null);
  const devopsAgents = devopsAgentsFile.agents;
  const upsertDevops = (a: DevOpsAgent) => {
    onSaveDevOpsAgents({ agents: devopsAgents.map(x => (x.id === a.id ? a : x)) });
    setEditingDevops(null);
  };
  const toggleDevops = (id: string, patch: Partial<DevOpsAgent>) =>
    onSaveDevOpsAgents({ agents: devopsAgents.map(a => (a.id === id ? { ...a, ...patch } : a)) });

  const agents = agentsFile.agents;

  const upsert = (a: AgentProfile) => {
    const exists = agents.some(x => x.id === a.id);
    const nextAgents = exists ? agents.map(x => (x.id === a.id ? a : x)) : [...agents, a];
    onSaveAgents({
      agents: nextAgents,
      activeAgentId: agentsFile.activeAgentId || nextAgents[0]?.id || null,
    });
    setEditing(null);
    setCreating(false);
  };

  const remove = (id: string) => {
    if (!confirm('Delete this agent?')) return;
    const nextAgents = agents.filter(a => a.id !== id);
    const activeAgentId = agentsFile.activeAgentId === id ? nextAgents[0]?.id || null : agentsFile.activeAgentId;
    onSaveAgents({ agents: nextAgents, activeAgentId });
  };

  const setActive = (id: string) => onSaveAgents({ ...agentsFile, activeAgentId: id });

  const apply = async (id: string) => {
    setApplying(id);
    setApplyMsg(null);
    try {
      const r = await onApply(id);
      if (r.error) {
        setApplyMsg({ id, text: r.error, error: true });
      } else {
        const notes = r.notes?.length ? ` — ${r.notes.join(' ')}` : '';
        setApplyMsg({ id, text: `Wrote ${r.serverCount} server(s) to ${r.path}${notes}` });
      }
    } catch (e: any) {
      setApplyMsg({ id, text: e.message || 'Apply failed', error: true });
    } finally {
      setApplying(null);
    }
  };

  return (
    <div className="w-full h-full overflow-y-auto px-8 py-6">
      {/* Agents */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <Bot size={18} /> Agents
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Manage CLI agent profiles. The active agent runs the workflow phases.
          </p>
        </div>
        <button
          onClick={() => { setCreating(true); setEditing(null); }}
          className="flex items-center gap-1.5 px-3 py-2 bg-black dark:bg-white text-white dark:text-black rounded-lg text-xs font-semibold hover:opacity-90 transition"
        >
          <Plus size={14} /> New Agent
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {agents.map(a => {
          const isActive = agentsFile.activeAgentId === a.id;
          const assigned = (a.mcpServerIds || []).length;
          return (
            <div
              key={a.id}
              className={`p-4 rounded-xl border transition bg-white dark:bg-zinc-950 ${
                isActive ? 'border-blue-500 ring-1 ring-blue-500/30' : 'border-zinc-200 dark:border-zinc-800'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-zinc-900 dark:text-white truncate">{a.name}</span>
                    {isActive && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 uppercase">Active</span>}
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-0.5 font-mono">
                    {a.agentType}{a.model ? ` · ${a.model}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setEditing(a)} className="p-1.5 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition" title="Edit">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => remove(a.id)} className="p-1.5 rounded text-zinc-500 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition" title="Delete">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {a.description && <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2 line-clamp-2">{a.description}</p>}

              <div className="mt-3 text-[10px] text-zinc-500 font-mono">{assigned} MCP server{assigned !== 1 ? 's' : ''} assigned</div>

              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => setActive(a.id)}
                  disabled={isActive}
                  className="flex items-center gap-1 text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white disabled:opacity-40"
                >
                  {isActive ? <CheckCircle2 size={13} className="text-blue-500" /> : <Circle size={13} />} Set active
                </button>
                <button
                  onClick={() => apply(a.id)}
                  disabled={applying === a.id}
                  className="ml-auto flex items-center gap-1 px-2.5 py-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition disabled:opacity-50"
                  title="Write this agent's MCP servers into its CLI's native config"
                >
                  <UploadCloud size={12} /> {applying === a.id ? 'Applying…' : 'Apply MCP to CLI'}
                </button>
              </div>

              {applyMsg?.id === a.id && (
                <div className={`mt-2 text-[10px] rounded p-2 break-words ${applyMsg.error ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-green-500/10 text-green-700 dark:text-green-400'}`}>
                  {applyMsg.text}
                </div>
              )}
            </div>
          );
        })}
        {agents.length === 0 && <p className="text-xs text-zinc-500 italic">No agents yet. Create one to get started.</p>}
      </div>

      {/* Review personas */}
      <div className="mt-10">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
          <Shield size={18} /> Review Personas
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 mb-4">
          Sub-agents that run sequentially in the implementation review gate.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {personaConfigs.map((p, idx) => (
            <div key={p.id} className="flex flex-col justify-between p-3.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg">
              <div className="flex justify-between items-start mb-2">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={p.enabled}
                    onChange={e => {
                      const next = [...personaConfigs];
                      next[idx] = { ...p, enabled: e.target.checked };
                      onSavePersonas(next);
                    }}
                    className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-500 focus:ring-0"
                  />
                  <div>
                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{p.label}</span>
                    <span className="ml-1.5 text-[9px] font-mono px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900 text-zinc-500 uppercase font-semibold">{p.id}</span>
                  </div>
                </label>
                <button onClick={() => onEditPersona(p)} className="px-2 py-0.5 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-[10px] font-bold rounded text-blue-500 dark:text-blue-400 transition">
                  Configure
                </button>
              </div>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 line-clamp-1 mb-2 font-medium">{p.description || 'No description provided.'}</p>
              <div className="flex justify-between items-center text-[9px] text-zinc-500 font-mono">
                <span className="truncate max-w-[150px] font-semibold">{p.command}</span>
                <span className="shrink-0 px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900 font-semibold">{p.model || 'N/A'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Specification agents */}
      <div className="mt-10">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <Users size={18} /> Specification Agents
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={applySpec}
              disabled={specApplying}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition disabled:opacity-50"
              title="Write the enabled agents as after_specify hooks in .specify/extensions.yml"
            >
              <UploadCloud size={13} /> {specApplying ? 'Applying…' : 'Apply to spec-kit'}
            </button>
            <button
              onClick={() => { setCreatingSpec(true); setEditingSpec(null); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-black dark:bg-white text-white dark:text-black rounded-lg text-[11px] font-semibold hover:opacity-90 transition"
            >
              <Plus size={13} /> New Agent
            </button>
          </div>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
          Participants that run (in order) after <span className="font-mono">/speckit.specify</span>; each writes to <span className="font-mono">specs/&lt;feature&gt;/spec-reviews/</span>.
        </p>

        {specApplyMsg && (
          <div className={`mb-3 text-[11px] rounded p-2 break-words ${specApplyMsg.error ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-green-500/10 text-green-700 dark:text-green-400'}`}>
            {specApplyMsg.text}
          </div>
        )}

        <div className="space-y-2">
          {specAgents.map((a, idx) => (
            <div key={a.id} className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg">
              <div className="flex flex-col">
                <button onClick={() => moveSpec(a.id, -1)} disabled={idx === 0} className="text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 disabled:opacity-30"><ArrowUp size={12} /></button>
                <button onClick={() => moveSpec(a.id, 1)} disabled={idx === specAgents.length - 1} className="text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 disabled:opacity-30"><ArrowDown size={12} /></button>
              </div>
              <input type="checkbox" checked={a.enabled} onChange={e => toggleSpec(a.id, { enabled: e.target.checked })} className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-500 focus:ring-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-zinc-900 dark:text-white truncate">{a.label}</span>
                  <span className="text-[9px] font-mono text-zinc-500">{a.command}</span>
                  {a.builtin && <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900 text-zinc-500 uppercase">built-in</span>}
                </div>
                {a.description && <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">{a.description}</p>}
              </div>
              <button
                onClick={() => toggleSpec(a.id, { optional: !a.optional })}
                className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase border ${a.optional ? 'bg-zinc-100 dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-800' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'}`}
                title="Toggle optional / mandatory"
              >
                {a.optional ? 'optional' : 'mandatory'}
              </button>
              <button onClick={() => setEditingSpec(a)} className="p-1.5 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition" title="Edit"><Pencil size={13} /></button>
              {!a.builtin && (
                <button onClick={() => removeSpec(a.id)} className="p-1.5 rounded text-zinc-500 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition" title="Delete"><Trash2 size={13} /></button>
              )}
            </div>
          ))}
          {specAgents.length === 0 && <p className="text-xs text-zinc-500 italic">No specification agents.</p>}
        </div>
      </div>

      {/* DevOps agents */}
      <div className="mt-10">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
          <Rocket size={18} /> DevOps Agents
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 mb-3">
          Operational agents run on demand from the <span className="font-semibold">Executions</span> view (Deploy, Monitor,
          Troubleshoot). Requires the <span className="font-mono">DevOps Agents</span> extension installed.
        </p>

        <div className="space-y-2">
          {devopsAgents.map(a => (
            <div key={a.id} className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg">
              <input type="checkbox" checked={a.enabled} onChange={e => toggleDevops(a.id, { enabled: e.target.checked })} className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-500 focus:ring-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-zinc-900 dark:text-white truncate">{a.label}</span>
                  <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-900 text-zinc-500 uppercase">{a.category}</span>
                  <span className="text-[9px] font-mono text-zinc-500">{a.command}</span>
                </div>
                {a.description && <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">{a.description}</p>}
              </div>
              <span className="text-[9px] font-mono text-zinc-500 shrink-0">{a.model || 'default model'}</span>
              <button onClick={() => setEditingDevops(a)} className="p-1.5 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition" title="Edit"><Pencil size={13} /></button>
            </div>
          ))}
          {devopsAgents.length === 0 && <p className="text-xs text-zinc-500 italic">No DevOps agents.</p>}
        </div>
      </div>

      <AgentEditorModal
        isOpen={creating || editing !== null}
        onClose={() => { setEditing(null); setCreating(false); }}
        agent={editing}
        mcpServers={mcpServers}
        onSave={upsert}
      />

      <SpecAgentEditorModal
        isOpen={creatingSpec || editingSpec !== null}
        onClose={() => { setEditingSpec(null); setCreatingSpec(false); }}
        agent={editingSpec}
        onSave={upsertSpec}
      />

      <DevOpsAgentEditorModal
        isOpen={editingDevops !== null}
        onClose={() => setEditingDevops(null)}
        agent={editingDevops}
        onSave={upsertDevops}
      />
    </div>
  );
};

export default AgentsPanel;
