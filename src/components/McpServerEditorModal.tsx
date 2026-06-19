'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, Plug } from 'lucide-react';
import { McpServer, McpTransport } from '../domain/models/mcp';

type McpServerEditorModalProps = {
  isOpen: boolean;
  onClose: () => void;
  server: McpServer | null; // null = creating
  onSave: (server: McpServer) => void;
};

const newId = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `mcp-${Date.now()}`);

const input =
  'w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded outline-none text-zinc-900 dark:text-white focus:border-zinc-400 dark:focus:border-zinc-700';
const labelCls = 'block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5';

const parseEnv = (s: string): Record<string, string> => {
  const env: Record<string, string> = {};
  for (const line of s.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    const i = t.indexOf('=');
    if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
};
const stringifyEnv = (env?: Record<string, string>) =>
  env ? Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n') : '';

export const McpServerEditorModal: React.FC<McpServerEditorModalProps> = ({ isOpen, onClose, server, onSave }) => {
  const [name, setName] = useState('');
  const [transport, setTransport] = useState<McpTransport>('stdio');
  const [command, setCommand] = useState('');
  const [argsStr, setArgsStr] = useState('');
  const [envStr, setEnvStr] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    setName(server?.name || '');
    setTransport(server?.transport || 'stdio');
    setCommand(server?.command || '');
    setArgsStr(Array.isArray(server?.args) ? server!.args!.join('\n') : '');
    setEnvStr(stringifyEnv(server?.env));
    setUrl(server?.url || '');
    setDescription(server?.description || '');
    setEnabled(server?.enabled !== false);
  }, [server, isOpen]);

  if (!isOpen) return null;

  const isStdio = transport === 'stdio';

  const handleSave = () => {
    const args = argsStr.split('\n').map(a => a.trim()).filter(Boolean);
    const env = parseEnv(envStr);
    onSave({
      id: server?.id || newId(),
      name: name.trim() || 'unnamed',
      transport,
      enabled,
      description: description.trim() || undefined,
      ...(isStdio
        ? { command: command.trim(), args: args.length ? args : undefined, env: Object.keys(env).length ? env : undefined }
        : { url: url.trim() }),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 w-full max-w-xl h-[85vh] rounded-xl flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        <header className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-lg">
              <Plug size={18} />
            </div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-white tracking-tight">{server ? 'Edit MCP Server' : 'New MCP Server'}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 dark:text-zinc-400 transition">
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Server Name</label>
              <input className={`${input} font-mono`} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. github" />
            </div>
            <div>
              <label className={labelCls}>Transport</label>
              <select className={input} value={transport} onChange={e => setTransport(e.target.value as McpTransport)}>
                <option value="stdio">stdio (command)</option>
                <option value="http">http (url)</option>
                <option value="sse">sse (url)</option>
              </select>
            </div>
          </div>

          {isStdio ? (
            <>
              <div>
                <label className={labelCls}>Command</label>
                <input className={`${input} font-mono`} value={command} onChange={e => setCommand(e.target.value)} placeholder="e.g. npx" />
              </div>
              <div>
                <label className={labelCls}>Args (one per line)</label>
                <textarea rows={3} className={`${input} font-mono`} value={argsStr} onChange={e => setArgsStr(e.target.value)} placeholder={'-y\n@modelcontextprotocol/server-github'} />
              </div>
              <div>
                <label className={labelCls}>Env (KEY=VALUE, one per line)</label>
                <textarea rows={3} className={`${input} font-mono`} value={envStr} onChange={e => setEnvStr(e.target.value)} placeholder="GITHUB_TOKEN=ghp_..." />
              </div>
            </>
          ) : (
            <div>
              <label className={labelCls}>URL</label>
              <input className={`${input} font-mono`} value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com/mcp" />
            </div>
          )}

          <div>
            <label className={labelCls}>Description</label>
            <textarea rows={2} className={`${input} resize-none`} value={description} onChange={e => setDescription(e.target.value)} />
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
          <button onClick={handleSave} className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white font-semibold text-xs rounded-lg transition flex items-center gap-1.5">
            <Save size={14} /> <span>Save Server</span>
          </button>
        </footer>
      </div>
    </div>
  );
};

export default McpServerEditorModal;
