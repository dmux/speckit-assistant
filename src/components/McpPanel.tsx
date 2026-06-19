'use client';

import React, { useState } from 'react';
import { Plug, Plus, Pencil, Trash2 } from 'lucide-react';
import { McpFile, McpServer } from '../domain/models/mcp';
import { McpServerEditorModal } from './McpServerEditorModal';

type McpPanelProps = {
  mcpFile: McpFile;
  onSave: (file: McpFile) => void;
};

export const McpPanel: React.FC<McpPanelProps> = ({ mcpFile, onSave }) => {
  const [editing, setEditing] = useState<McpServer | null>(null);
  const [creating, setCreating] = useState(false);

  const servers = mcpFile.servers;

  const upsert = (s: McpServer) => {
    const exists = servers.some(x => x.id === s.id);
    onSave({ servers: exists ? servers.map(x => (x.id === s.id ? s : x)) : [...servers, s] });
    setEditing(null);
    setCreating(false);
  };

  const remove = (id: string) => {
    if (!confirm('Delete this MCP server?')) return;
    onSave({ servers: servers.filter(s => s.id !== id) });
  };

  const toggle = (id: string, enabled: boolean) =>
    onSave({ servers: servers.map(s => (s.id === id ? { ...s, enabled } : s)) });

  const summary = (s: McpServer) =>
    s.transport === 'stdio' ? `${s.command || ''} ${(s.args || []).join(' ')}`.trim() : s.url || '';

  return (
    <div className="w-full h-full overflow-y-auto px-8 py-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <Plug size={18} /> MCP Tools
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Define MCP servers once; assign them to agents and apply to each CLI's native config from the Agents section.
          </p>
        </div>
        <button
          onClick={() => { setCreating(true); setEditing(null); }}
          className="flex items-center gap-1.5 px-3 py-2 bg-black dark:bg-white text-white dark:text-black rounded-lg text-xs font-semibold hover:opacity-90 transition"
        >
          <Plus size={14} /> New Server
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {servers.map(s => (
          <div key={s.id} className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-zinc-900 dark:text-white font-mono truncate">{s.name}</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 uppercase">{s.transport}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => setEditing(s)} className="p-1.5 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition" title="Edit">
                  <Pencil size={13} />
                </button>
                <button onClick={() => remove(s.id)} className="p-1.5 rounded text-zinc-500 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition" title="Delete">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            <p className="mt-2 text-[10px] text-zinc-500 dark:text-zinc-400 font-mono break-words line-clamp-2">{summary(s)}</p>
            {s.description && <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2">{s.description}</p>}

            <label className="mt-3 flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={s.enabled} onChange={e => toggle(s.id, e.target.checked)} className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-500 focus:ring-0" />
              <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">Enabled</span>
            </label>
          </div>
        ))}
        {servers.length === 0 && <p className="text-xs text-zinc-500 italic">No MCP servers yet. Create one to get started.</p>}
      </div>

      <McpServerEditorModal
        isOpen={creating || editing !== null}
        onClose={() => { setEditing(null); setCreating(false); }}
        server={editing}
        onSave={upsert}
      />
    </div>
  );
};

export default McpPanel;
