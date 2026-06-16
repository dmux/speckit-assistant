import React, { useEffect, useRef } from 'react';
import { Terminal, Trash2 } from 'lucide-react';

type ConsolePanelProps = {
  logs: string;
  onClear: () => void;
};

export const ConsolePanel: React.FC<ConsolePanelProps> = ({ logs, onClear }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="flex flex-col h-full bg-black border-t border-zinc-800 text-zinc-300 font-mono text-xs">
      <div className="flex justify-between items-center px-4 py-2 border-b border-zinc-900 bg-zinc-950">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-zinc-500" />
          <span className="font-semibold tracking-wider text-zinc-400">CONSOLE OUTPUT</span>
        </div>
        <button
          onClick={onClear}
          title="Clear console"
          className="p-1 hover:bg-zinc-800 rounded transition text-zinc-500 hover:text-zinc-300"
        >
          <Trash2 size={14} />
        </button>
      </div>
      <div
        ref={containerRef}
        className="flex-1 p-4 overflow-y-auto whitespace-pre-wrap selection:bg-zinc-800"
        style={{ scrollbarWidth: 'thin' }}
      >
        {logs ? logs : <span className="text-zinc-600">// Terminal logs will stream here...</span>}
      </div>
    </div>
  );
};
export default ConsolePanel;
