'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, Bot } from 'lucide-react';
import { AgentType } from '../domain/models/types';
import { AgentProfile } from '../domain/models/agents';
import { McpServer } from '../domain/models/mcp';
import { MODEL_OPTIONS } from '../domain/models/modelOptions';

type AgentEditorModalProps = {
  isOpen: boolean;
  onClose: () => void;
  agent: AgentProfile | null; // null = creating a new agent
  mcpServers: McpServer[];
  onSave: (agent: AgentProfile) => void;
};

const newId = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `agent-${Date.now()}`);

const input =
  'w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded outline-none text-zinc-900 dark:text-white focus:border-zinc-400 dark:focus:border-zinc-700';
const labelCls = 'block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5';

export const AgentEditorModal: React.FC<AgentEditorModalProps> = ({ isOpen, onClose, agent, mcpServers, onSave }) => {
  const [name, setName] = useState('');
  const [agentType, setAgentType] = useState<AgentType>('claude');
  const [model, setModel] = useState('');
  const [agentPath, setAgentPath] = useState('');
  const [customCommand, setCustomCommand] = useState('');
  const [description, setDescription] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [serverIds, setServerIds] = useState<string[]>([]);

  useEffect(() => {
    setName(agent?.name || '');
    setAgentType(agent?.agentType || 'claude');
    setModel(agent?.model || '');
    setAgentPath(agent?.agentPath || '');
    setCustomCommand(agent?.customCommand || '');
    setDescription(agent?.description || '');
    setEnabled(agent?.enabled !== false);
    setServerIds(agent?.mcpServerIds || []);
  }, [agent, isOpen]);

  if (!isOpen) return null;

  const toggleServer = (id: string) =>
    setServerIds(prev => (prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]));

  const handleSave = () => {
    onSave({
      id: agent?.id || newId(),
      name: name.trim() || 'Untitled Agent',
      agentType,
      model: model.trim() || undefined,
      agentPath: agentPath.trim() || undefined,
      customCommand: customCommand.trim() || undefined,
      description: description.trim() || undefined,
      enabled,
      mcpServerIds: serverIds,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 w-full max-w-2xl h-[88vh] rounded-xl flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        <header className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg">
              <Bot size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white tracking-tight">
                {agent ? 'Edit Agent' : 'New Agent'}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">CLI profile and assigned MCP servers.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 dark:text-zinc-400 transition">
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Agent Name</label>
              <input className={input} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Claude (Default)" />
            </div>
            <div>
              <label className={labelCls}>Agent CLI</label>
              <select className={input} value={agentType} onChange={e => setAgentType(e.target.value as AgentType)}>
                <option value="claude">Claude CLI (Anthropic)</option>
                <option value="gemini">Gemini CLI (Google)</option>
                <option value="copilot">GitHub Copilot (ghcs)</option>
                <option value="openai">OpenAI Codex</option>
                <option value="custom">Custom Command</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Model (for cost pricing)</label>
              <input className={input} value={model} onChange={e => setModel(e.target.value)} placeholder="e.g. claude-sonnet-4-6" list="model-options" />
              <datalist id="model-options">
                {MODEL_OPTIONS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </datalist>
            </div>
            <div>
              <label className={labelCls}>Custom Binary Path (optional)</label>
              <input className={input} value={agentPath} onChange={e => setAgentPath(e.target.value)} placeholder="e.g. /usr/local/bin/claude" />
            </div>
          </div>

          <div>
            <label className={labelCls}>Custom Spawn Command {agentType !== 'custom' && '(custom CLI only)'}</label>
            <input
              className={`${input} font-mono disabled:opacity-50`}
              value={customCommand}
              disabled={agentType !== 'custom'}
              onChange={e => setCustomCommand(e.target.value)}
              placeholder="e.g. my-agent {{prompt}}"
            />
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea rows={2} className={`${input} resize-none`} value={description} onChange={e => setDescription(e.target.value)} placeholder="What this agent is for..." />
          </div>

          <div>
            <label className={labelCls}>Assigned MCP Servers</label>
            {mcpServers.length === 0 ? (
              <p className="text-xs text-zinc-500 italic">No MCP servers defined yet — add them in the MCP Tools section.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {mcpServers.map(s => (
                  <label key={s.id} className="flex items-center gap-2 p-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded cursor-pointer">
                    <input type="checkbox" checked={serverIds.includes(s.id)} onChange={() => toggleServer(s.id)} className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-500 focus:ring-0" />
                    <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">{s.name}</span>
                    <span className="ml-auto text-[9px] font-mono text-zinc-500 uppercase">{s.transport}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-500 focus:ring-0" />
            <span className="text-xs font-semibold text-zinc-900 dark:text-white">Enabled</span>
          </label>
        </div>

        <footer className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-3 bg-zinc-50 dark:bg-zinc-900/30">
          <button onClick={onClose} className="px-4 py-2 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold text-xs rounded-lg transition">
            Cancel
          </button>
          <button onClick={handleSave} className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold text-xs rounded-lg transition flex items-center gap-1.5">
            <Save size={14} /> <span>Save Agent</span>
          </button>
        </footer>
      </div>
    </div>
  );
};

export default AgentEditorModal;
