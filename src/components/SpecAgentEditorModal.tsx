'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, Users } from 'lucide-react';
import { SpecAgent } from '../domain/models/specAgents';
import { MODEL_OPTIONS } from '../domain/models/modelOptions';

type SpecAgentEditorModalProps = {
  isOpen: boolean;
  onClose: () => void;
  agent: SpecAgent | null; // null = creating a custom agent
  onSave: (agent: SpecAgent) => void;
};

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `agent-${Date.now()}`;

const input =
  'w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded outline-none text-zinc-900 dark:text-white focus:border-zinc-400 dark:focus:border-zinc-700';
const labelCls = 'block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5';

export const SpecAgentEditorModal: React.FC<SpecAgentEditorModalProps> = ({ isOpen, onClose, agent, onSave }) => {
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [model, setModel] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [optional, setOptional] = useState(true);
  const [priority, setPriority] = useState(50);

  const builtin = !!agent?.builtin;

  useEffect(() => {
    setLabel(agent?.label || '');
    setDescription(agent?.description || '');
    setModel(agent?.model || '');
    setSystemPrompt(agent?.systemPrompt || '');
    setOptional(agent?.optional !== false);
    setPriority(agent?.priority ?? 50);
  }, [agent, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    const id = agent?.id || slugify(label);
    const command = agent?.command || `speckit.spec-agents.${id}`;
    onSave({
      id,
      label: label.trim() || 'Untitled Agent',
      command,
      description: description.trim() || undefined,
      model: model.trim() || undefined,
      systemPrompt: builtin ? agent?.systemPrompt : systemPrompt.trim() || undefined,
      enabled: agent?.enabled ?? true,
      optional,
      priority: Number(priority) || 50,
      builtin: agent?.builtin,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 w-full max-w-2xl h-[88vh] rounded-xl flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        <header className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg">
              <Users size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white tracking-tight">
                {agent ? 'Edit Specification Agent' : 'New Specification Agent'}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Participates in the specification phase via spec-kit's after_specify hooks.
              </p>
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
              <input className={input} value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Product Owner" />
            </div>
            <div>
              <label className={labelCls}>Model (optional)</label>
              <input className={input} value={model} onChange={e => setModel(e.target.value)} placeholder="e.g. claude-sonnet-4-6" list="spec-model-options" />
              <datalist id="spec-model-options">
                {MODEL_OPTIONS.map(m => (<option key={m.value} value={m.value}>{m.label}</option>))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Slash Command</label>
              <input className={`${input} font-mono disabled:opacity-60`} value={agent?.command || (label ? `speckit.spec-agents.${slugify(label)}` : '')} disabled placeholder="speckit.spec-agents.<id>" />
            </div>
            <div>
              <label className={labelCls}>Priority (lower runs first)</label>
              <input type="number" className={input} value={priority} onChange={e => setPriority(Number(e.target.value))} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Description</label>
            <textarea rows={2} className={`${input} resize-none`} value={description} onChange={e => setDescription(e.target.value)} placeholder="What this agent contributes..." />
          </div>

          <div>
            <label className={labelCls}>System Prompt {builtin && '(provided by the bundled extension)'}</label>
            {builtin ? (
              <p className="text-[11px] text-zinc-500 italic">
                Built-in agents are backed by the <span className="font-mono">spec-kit-spec-agents</span> extension command file. Edit the extension to change its prompt.
              </p>
            ) : (
              <textarea rows={6} className={`${input} font-mono`} value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} placeholder="You are a ... reviewing the draft spec. Read $ARGUMENTS/spec.md and ..." />
            )}
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input type="checkbox" checked={!optional} onChange={e => setOptional(!e.target.checked)} className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-500 focus:ring-0" />
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-zinc-900 dark:text-white">Mandatory</span>
              <span className="text-[10px] text-zinc-500">Auto-executes after /speckit.specify (otherwise prompts the user)</span>
            </div>
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

export default SpecAgentEditorModal;
