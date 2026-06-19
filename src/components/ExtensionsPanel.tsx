'use client';

import React, { useState } from 'react';
import { Package, Download, Trash2, Power, AlertTriangle, Terminal } from 'lucide-react';
import { InstalledExtension, BundledExtension } from '../domain/models/extensions';

export type ExtensionAction =
  | { action: 'install-bundled'; id: string }
  | { action: 'install-community'; id: string; fromUrl?: string; priority?: number }
  | { action: 'remove'; id: string }
  | { action: 'enable'; id: string }
  | { action: 'disable'; id: string }
  | { action: 'set-priority'; id: string; priority: number };

type ExtensionsPanelProps = {
  available: boolean;
  installed: InstalledExtension[];
  bundled: BundledExtension[];
  onAction: (a: ExtensionAction) => Promise<{ success?: boolean; output?: string; error?: string }>;
};

const input =
  'w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded outline-none text-zinc-900 dark:text-white focus:border-zinc-400 dark:focus:border-zinc-700';

export const ExtensionsPanel: React.FC<ExtensionsPanelProps> = ({ available, installed, bundled, onAction }) => {
  const [busy, setBusy] = useState<string | null>(null);
  const [output, setOutput] = useState<string>('');
  const [commId, setCommId] = useState('');
  const [commUrl, setCommUrl] = useState('');

  const installedIds = new Set(installed.map(e => e.id));

  const run = async (key: string, a: ExtensionAction) => {
    setBusy(key);
    setOutput('');
    try {
      const r = await onAction(a);
      setOutput(r.error ? `Error: ${r.error}` : (r.output || (r.success ? 'Done.' : 'Failed.')));
    } catch (e: any) {
      setOutput(`Error: ${e.message}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="w-full h-full overflow-y-auto px-8 py-6">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
          <Package size={18} /> Extensions
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
          Install and manage spec-kit extensions via the <span className="font-mono">specify</span> CLI.
        </p>
      </div>

      {!available && (
        <div className="mb-5 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">The <span className="font-mono">specify</span> CLI was not found.</p>
            <p className="mt-1">Install it to manage extensions:</p>
            <pre className="mt-1 font-mono text-[11px] whitespace-pre-wrap">uv tool install specify-cli --from git+https://github.com/github/spec-kit.git</pre>
          </div>
        </div>
      )}

      {/* This project's extensions */}
      <h3 className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-3">This project's extensions</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {bundled.map(b => {
          const isInstalled = installedIds.has(b.id);
          return (
            <div key={b.id} className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-zinc-900 dark:text-white">{b.label}</span>
                <span className="text-[9px] font-mono text-zinc-500">{b.id}</span>
                {isInstalled && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400 uppercase">installed</span>}
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">{b.description}</p>
              <button
                onClick={() => run(`bundled-${b.id}`, { action: 'install-bundled', id: b.id })}
                disabled={!available || busy === `bundled-${b.id}`}
                className="mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-black dark:bg-white text-white dark:text-black rounded-lg text-[11px] font-semibold hover:opacity-90 transition disabled:opacity-50"
              >
                <Download size={13} /> {busy === `bundled-${b.id}` ? 'Installing…' : isInstalled ? 'Reinstall' : 'Install'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Community / catalog */}
      <h3 className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-3">Community / catalog</h3>
      <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase mb-1">Extension ID</label>
            <input className={input} value={commId} onChange={e => setCommId(e.target.value)} placeholder="e.g. spec-kit-onboard" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase mb-1">Release / ZIP URL (optional)</label>
            <input className={`${input} font-mono`} value={commUrl} onChange={e => setCommUrl(e.target.value)} placeholder="https://github.com/dmux/spec-kit-onboard/releases/download/v2.1.0/..." />
          </div>
        </div>
        <button
          onClick={() => run('community', { action: 'install-community', id: commId.trim(), fromUrl: commUrl.trim() || undefined })}
          disabled={!available || !commId.trim() || busy === 'community'}
          className="mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-black dark:bg-white text-white dark:text-black rounded-lg text-[11px] font-semibold hover:opacity-90 transition disabled:opacity-50"
        >
          <Download size={13} /> {busy === 'community' ? 'Installing…' : 'Install'}
        </button>
        <p className="text-[10px] text-zinc-500 mt-2">Leave the URL empty to install from the configured catalog by ID. URLs must be HTTPS.</p>
      </div>

      {/* Installed */}
      <h3 className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-3">Installed</h3>
      <div className="space-y-2 mb-8">
        {installed.length === 0 && <p className="text-xs text-zinc-500 italic">No extensions installed.</p>}
        {installed.map(e => (
          <div key={e.id} className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg">
            <span className={`w-2 h-2 rounded-full shrink-0 ${e.enabled ? 'bg-green-500' : 'bg-zinc-400 dark:bg-zinc-600'}`} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-zinc-900 dark:text-white truncate">{e.name}</span>
                <span className="text-[9px] font-mono text-zinc-500">{e.id} · v{e.version}</span>
              </div>
              <div className="text-[10px] text-zinc-500 font-mono">
                {e.commandCount} cmd · {e.hookCount} hook{e.hookCount !== 1 ? 's' : ''}{typeof e.priority === 'number' ? ` · priority ${e.priority}` : ''}
              </div>
            </div>
            <button
              onClick={() => run(`toggle-${e.id}`, { action: e.enabled ? 'disable' : 'enable', id: e.id })}
              disabled={busy === `toggle-${e.id}`}
              className="flex items-center gap-1 text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white disabled:opacity-50"
              title={e.enabled ? 'Disable' : 'Enable'}
            >
              <Power size={13} /> {e.enabled ? 'Disable' : 'Enable'}
            </button>
            <button
              onClick={() => run(`remove-${e.id}`, { action: 'remove', id: e.id })}
              disabled={busy === `remove-${e.id}`}
              className="p-1.5 rounded text-zinc-500 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition disabled:opacity-50"
              title="Remove"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>

      {/* Output log */}
      {output && (
        <div>
          <h3 className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Terminal size={13} /> Output</h3>
          <pre className="p-3 bg-zinc-50 dark:bg-black/60 border border-zinc-200 dark:border-zinc-800 rounded-lg font-mono text-[11px] leading-relaxed text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap max-h-72 overflow-auto select-text">{output}</pre>
        </div>
      )}
    </div>
  );
};

export default ExtensionsPanel;
