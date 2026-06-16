'use client';

import React, { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

export const TerminalPanel: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Instantiate XTerm with a Vercel-style dark theme
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
      rows: 24,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(containerRef.current);
    fitAddon.fit();

    xtermRef.current = term;

    // Connect to Server-Sent Events output stream
    const eventSource = new EventSource('/api/terminal/stream');
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.output) {
          term.write(data.output);
        }
      } catch (err) {
        // ignore
      }
    };

    // Forward terminal input to backend POST route
    const onDataDisposable = term.onData((data) => {
      fetch('/api/terminal/input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: data })
      }).catch(err => console.error('Failed to send input:', err));
    });

    // Handle window resize event
    const handleResize = () => {
      try {
        fitAddon.fit();
      } catch {
        // ignore resize errors if container is hidden
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      term.dispose();
      eventSource.close();
      onDataDisposable.dispose();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className="h-full w-full bg-black flex flex-col min-h-0 border-t border-zinc-800">
      <div
        ref={containerRef}
        className="flex-1 w-full h-full p-3 overflow-hidden"
      />
    </div>
  );
};

export default TerminalPanel;
