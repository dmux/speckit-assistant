'use client';

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { Terminal as TerminalIcon, Trash2 } from 'lucide-react';

export interface AgentConsoleHandle {
  write: (data: string) => void;
  clear: () => void;
  focus: () => void;
}

type AgentConsoleProps = {
  // Whether this tab is currently visible. xterm needs a non-zero sized
  // container to lay out, so we refit + focus whenever it becomes active.
  active: boolean;
  running?: boolean;
  // Raw keystrokes from the terminal (arrow keys, Enter as '\r', etc.) so that
  // interactive agent prompts (e.g. the clarify Q&A picker) can be navigated.
  onInput?: (data: string) => void;
  onResize?: (cols: number, rows: number) => void;
};

export const AgentConsole = forwardRef<AgentConsoleHandle, AgentConsoleProps>(
  ({ active, running = false, onInput, onResize }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<XTerm | null>(null);
    const fitRef = useRef<FitAddon | null>(null);

    // Keep the latest callbacks in refs so the mount-once effect below never
    // captures stale closures (onInput/onResize change identity each render).
    const onInputRef = useRef(onInput);
    const onResizeRef = useRef(onResize);
    onInputRef.current = onInput;
    onResizeRef.current = onResize;

    useImperativeHandle(
      ref,
      () => ({
        write: (data: string) => xtermRef.current?.write(data),
        clear: () => xtermRef.current?.clear(),
        focus: () => xtermRef.current?.focus(),
      }),
      []
    );

    useEffect(() => {
      if (!containerRef.current) return;

      const term = new XTerm({
        cursorBlink: true,
        theme: {
          background: '#000000',
          foreground: '#a1a1aa',
          cursor: '#f4f4f5',
          selectionBackground: '#27272a',
        },
        fontFamily: 'Menlo, Monaco, Consolas, "Courier New", monospace',
        fontSize: 11,
      });

      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(containerRef.current);
      try {
        fit.fit();
      } catch {
        // container may not be laid out yet
      }

      xtermRef.current = term;
      fitRef.current = fit;

      const dataDisposable = term.onData((data) => onInputRef.current?.(data));
      const resizeDisposable = term.onResize(({ cols, rows }) =>
        onResizeRef.current?.(cols, rows)
      );
      // Sync the backend PTY to the initial size.
      onResizeRef.current?.(term.cols, term.rows);

      const resizeObserver = new ResizeObserver(() => {
        try {
          fit.fit();
        } catch {
          // ignore when hidden
        }
      });
      resizeObserver.observe(containerRef.current);

      return () => {
        resizeObserver.disconnect();
        dataDisposable.dispose();
        resizeDisposable.dispose();
        term.dispose();
        xtermRef.current = null;
        fitRef.current = null;
      };
    }, []);

    // Refit and focus when the tab becomes visible again.
    useEffect(() => {
      if (!active) return;
      const id = requestAnimationFrame(() => {
        try {
          fitRef.current?.fit();
        } catch {
          // ignore
        }
        xtermRef.current?.focus();
      });
      return () => cancelAnimationFrame(id);
    }, [active]);

    return (
      <div className="flex flex-col h-full bg-black border-t border-zinc-800">
        <div className="flex justify-between items-center px-4 py-2 border-b border-zinc-900 bg-zinc-950 shrink-0">
          <div className="flex items-center gap-2">
            <TerminalIcon size={14} className="text-zinc-500" />
            <span className="font-mono text-xs font-semibold tracking-wider text-zinc-400">
              CONSOLE OUTPUT
            </span>
            {running && (
              <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            )}
          </div>
          <button
            onClick={() => xtermRef.current?.clear()}
            title="Clear console"
            className="p-1 hover:bg-zinc-800 rounded transition text-zinc-500 hover:text-zinc-300"
          >
            <Trash2 size={14} />
          </button>
        </div>
        <div
          ref={containerRef}
          onClick={() => xtermRef.current?.focus()}
          className="flex-1 w-full min-h-0 p-2 overflow-hidden"
        />
      </div>
    );
  }
);

AgentConsole.displayName = 'AgentConsole';

export default AgentConsole;
