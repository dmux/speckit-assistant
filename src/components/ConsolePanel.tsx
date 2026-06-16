import React, { useEffect, useRef, useState } from 'react';
import { Terminal, Trash2, Copy, Check } from 'lucide-react';

type ConsolePanelProps = {
  logs: string;
  onClear: () => void;
  running?: boolean;
  onSendInput?: (text: string) => void;
};

export const ConsolePanel: React.FC<ConsolePanelProps> = ({
  logs,
  onClear,
  running = false,
  onSendInput,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleCopy = async () => {
    if (!logs) return;
    try {
      await navigator.clipboard.writeText(logs);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy logs:', err);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !onSendInput) return;
    onSendInput(inputValue);
    setInputValue('');
  };

  return (
    <div className="flex flex-col h-full bg-black border-t border-zinc-800 text-zinc-300 font-mono text-xs">
      <div className="flex justify-between items-center px-4 py-2 border-b border-zinc-900 bg-zinc-950">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-zinc-500" />
          <span className="font-semibold tracking-wider text-zinc-400">CONSOLE OUTPUT</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            title="Copy logs"
            disabled={!logs}
            className="p-1 hover:bg-zinc-800 rounded transition text-zinc-500 hover:text-zinc-300 disabled:opacity-30 disabled:pointer-events-none"
          >
            {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
          </button>
          <button
            onClick={onClear}
            title="Clear console"
            className="p-1 hover:bg-zinc-800 rounded transition text-zinc-500 hover:text-zinc-300"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div
        ref={containerRef}
        className="flex-1 p-4 overflow-y-auto whitespace-pre-wrap selection:bg-zinc-800"
        style={{ scrollbarWidth: 'thin' }}
      >
        {logs ? logs : <span className="text-zinc-600">// Terminal logs will stream here...</span>}
      </div>
      {running && onSendInput && (
        <form onSubmit={handleSubmit} className="flex items-center gap-2 px-4 py-2 border-t border-zinc-900 bg-zinc-950 shrink-0">
          <span className="text-zinc-500 select-none">$</span>
          <input
            type="text"
            placeholder="Respond to agent prompt..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="flex-1 bg-transparent text-zinc-100 placeholder-zinc-600 outline-none border-none text-xs"
            autoFocus
          />
          <button
            type="submit"
            disabled={!inputValue.trim()}
            className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[10px] transition disabled:opacity-50 disabled:pointer-events-none"
          >
            Send
          </button>
        </form>
      )}
    </div>
  );
};
export default ConsolePanel;
