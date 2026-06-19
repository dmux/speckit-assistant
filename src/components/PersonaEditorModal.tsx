'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, Shield, Info } from 'lucide-react';
import { PersonaConfig } from '../domain/models/types';

type PersonaEditorModalProps = {
  isOpen: boolean;
  onClose: () => void;
  persona: PersonaConfig | null;
  onSave: (updated: PersonaConfig) => void;
};

const input =
  'w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded outline-none text-zinc-900 dark:text-white focus:border-zinc-400 dark:focus:border-zinc-700';
const labelCls = 'block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5';

export const PersonaEditorModal: React.FC<PersonaEditorModalProps> = ({
  isOpen,
  onClose,
  persona,
  onSave
}) => {
  const [label, setLabel] = useState('');
  const [command, setCommand] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [model, setModel] = useState('gemini-2.5-flash');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [capabilitiesStr, setCapabilitiesStr] = useState('');
  const [toolsStr, setToolsStr] = useState('');

  useEffect(() => {
    if (persona) {
      setLabel(persona.label || '');
      setCommand(persona.command || '');
      setEnabled(persona.enabled !== false);
      setModel(persona.model || 'gemini-2.5-flash');
      setDescription(persona.description || '');
      setSystemPrompt(persona.systemPrompt || '');
      setCapabilitiesStr(Array.isArray(persona.capabilities) ? persona.capabilities.join('\n') : '');
      setToolsStr(Array.isArray(persona.tools) ? persona.tools.join('\n') : '');
    }
  }, [persona, isOpen]);

  if (!isOpen || !persona) return null;

  const handleSave = () => {
    const capabilities = capabilitiesStr
      .split('\n')
      .map(c => c.trim())
      .filter(c => c.length > 0);
    const tools = toolsStr
      .split('\n')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    onSave({
      ...persona,
      label,
      command,
      enabled,
      model,
      description,
      systemPrompt,
      capabilities,
      tools
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      {/* Modal Card */}
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 w-full max-w-2xl h-[85vh] rounded-xl flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">

        {/* Header */}
        <header className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg">
              <Shield size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white tracking-tight">
                Configure Persona Agent: {persona.id.toUpperCase()}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Customize capabilities, core instructions, models, and slash command integration.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition"
          >
            <X size={18} />
          </button>
        </header>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Status & Basic settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Persona Name</label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className={input}
                placeholder="e.g. QA Agent"
              />
            </div>
            <div>
              <label className={labelCls}>LLM Model</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className={input}
              >
                <option value="gemini-2.5-flash">Gemini 2.5 Flash (Fast, Google)</option>
                <option value="gemini-2.5-pro">Gemini 2.5 Pro (Analytical, Google)</option>
                <option value="claude-3-5-sonnet">Claude 3.5 Sonnet (Coding, Anthropic)</option>
                <option value="gpt-4o">GPT-4o (Reasoning, OpenAI)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <div className="md:col-span-2">
              <label className={labelCls}>Slash Command / Execution Path</label>
              <input
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                className={`${input} font-mono`}
                placeholder="e.g. /speckit.review.qa"
              />
            </div>
            <div className="flex items-center h-full pt-4">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 bg-transparent text-blue-500 focus:ring-0 focus:ring-offset-0"
                />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-zinc-900 dark:text-white">Enable Agent Persona</span>
                  <span className="text-[10px] text-zinc-500">Run persona in review gate</span>
                </div>
              </label>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className={labelCls}>Agent Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`${input} resize-none`}
              placeholder="Provide a general summary of this agent's responsibilities..."
            />
          </div>

          {/* Prompt / Instructions */}
          <div className="space-y-1.5">
            <label className={labelCls}>System Prompt & Core Instructions</label>
            <textarea
              rows={5}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className={`${input} font-mono`}
              placeholder="System prompt instructions..."
            />
          </div>

          {/* Capabilities & Tools side-by-side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className={labelCls}>Capabilities (one per line)</label>
                <span className="text-[9px] text-zinc-500 flex items-center gap-0.5"><Info size={10} /> Environment injection</span>
              </div>
              <textarea
                rows={4}
                value={capabilitiesStr}
                onChange={(e) => setCapabilitiesStr(e.target.value)}
                className={`${input} font-mono`}
                placeholder="e.g. Runs Vitest suite"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className={labelCls}>Authorized Tools (one per line)</label>
                <span className="text-[9px] text-zinc-500 flex items-center gap-0.5"><Info size={10} /> CLI commands</span>
              </div>
              <textarea
                rows={4}
                value={toolsStr}
                onChange={(e) => setToolsStr(e.target.value)}
                className={`${input} font-mono`}
                placeholder="e.g. npm test"
              />
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <footer className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-3 bg-zinc-50 dark:bg-zinc-900/30">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold text-xs rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold text-xs rounded-lg transition flex items-center gap-1.5"
          >
            <Save size={14} />
            <span>Save Configuration</span>
          </button>
        </footer>

      </div>
    </div>
  );
};
