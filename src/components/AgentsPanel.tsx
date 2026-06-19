'use client';

import React, { useState } from 'react';
import { Bot, Plus, Pencil, Trash2, CheckCircle2, Circle, UploadCloud, Shield } from 'lucide-react';
import { AgentsFile, AgentProfile } from '../domain/models/agents';
import { McpServer } from '../domain/models/mcp';
import { PersonaConfig } from '../domain/models/types';
import type { McpApplyResult } from '../domain/ports/out/McpConfigPort';
import { AgentEditorModal } from './AgentEditorModal';

type AgentsPanelProps = {
  agentsFile: AgentsFile;
  mcpServers: McpServer[];
  personaConfigs: PersonaConfig[];
  onSaveAgents: (file: AgentsFile) => void;
  onSavePersonas: (next: PersonaConfig[]) => void;
  onEditPersona: (p: PersonaConfig) => void;
  onApply: (agentId: string) => Promise<McpApplyResult & { error?: string }>;
};

export const AgentsPanel: React.FC<AgentsPanelProps> = ({
  agentsFile,
  mcpServers,
  personaConfigs,
  onSaveAgents,
  onSavePersonas,
  onEditPersona,
  onApply,
}) => {
  const [editing, setEditing] = useState<AgentProfile | null>(null);
  const [creating, setCreating] = useState(false);
  const [applyMsg, setApplyMsg] = useState<{ id: string; text: string; error?: boolean } | null>(null);
  const [applying, setApplying] = useState<string | null>(null);

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

      <AgentEditorModal
        isOpen={creating || editing !== null}
        onClose={() => { setEditing(null); setCreating(false); }}
        agent={editing}
        mcpServers={mcpServers}
        onSave={upsert}
      />
    </div>
  );
};

export default AgentsPanel;
