import React, { useState, useEffect, useRef } from 'react';
import { Edit2, Eye, Save, Columns, Maximize2, Minimize2, Bold, Italic, Heading, Link, Code, Table, CheckSquare } from 'lucide-react';
import { WorkflowState } from '@/domain/models/types';

const TABS = [
  { phase: 'constitution', label: 'Constitution', file: 'constitution.md', defaultPath: () => '.specify/memory/constitution.md' },
  { phase: 'specification', label: 'Spec', file: 'spec.md', defaultPath: (f: string) => `specs/${f}/spec.md` },
  { phase: 'clarification', label: 'Clarification', file: 'clarification.md', defaultPath: (f: string) => `specs/${f}/clarification.md` },
  { phase: 'planning', label: 'Planning', file: 'plan.md', defaultPath: (f: string) => `specs/${f}/plan.md` },
  { phase: 'checklist', label: 'Checklist', file: 'checklist.md', defaultPath: (f: string) => `specs/${f}/checklist.md` },
  { phase: 'analyze', label: 'Analysis', file: 'analysis.md', defaultPath: (f: string) => `specs/${f}/analysis.md` },
  { phase: 'tasks', label: 'Tasks', file: 'tasks.md', defaultPath: (f: string) => `specs/${f}/tasks.md` },
] as const;

type MarkdownEditorProps = {
  filePath: string | null;
  initialContent: string | null;
  onSave: (content: string) => Promise<void>;
  onToggleTask?: (lineIndex: number, checked: boolean) => void;
  state?: WorkflowState | null;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
  onSelectFile?: (path: string) => void;
};

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  filePath,
  initialContent,
  onSave,
  onToggleTask,
  state,
  isMaximized = false,
  onToggleMaximize,
  onSelectFile,
}) => {
  const [content, setContent] = useState<string>('');
  const [mode, setMode] = useState<'edit' | 'preview' | 'split'>('split');
  const [saving, setSaving] = useState<boolean>(false);
  const [externalChange, setExternalChange] = useState<boolean>(false);
  const lastInitialContentRef = useRef<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const insertMarkdown = (type: 'bold' | 'italic' | 'heading' | 'link' | 'code' | 'table' | 'checkbox') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selected = text.substring(start, end);

    let replacement = '';
    let selectionOffsetStart = 0;
    let selectionOffsetEnd = 0;

    switch (type) {
      case 'bold':
        replacement = `**${selected || 'bold text'}**`;
        selectionOffsetStart = 2;
        selectionOffsetEnd = replacement.length - 2;
        break;
      case 'italic':
        replacement = `*${selected || 'italic text'}*`;
        selectionOffsetStart = 1;
        selectionOffsetEnd = replacement.length - 1;
        break;
      case 'heading':
        const isNewLineHead = start === 0 || text.charAt(start - 1) === '\n';
        replacement = `${isNewLineHead ? '' : '\n'}### ${selected || 'Heading'}`;
        selectionOffsetStart = isNewLineHead ? 4 : 5;
        selectionOffsetEnd = replacement.length;
        break;
      case 'link':
        replacement = `[${selected || 'link text'}](https://example.com)`;
        selectionOffsetStart = 1;
        selectionOffsetEnd = (selected || 'link text').length + 1;
        break;
      case 'code':
        replacement = `\n\`\`\`\n${selected || 'code here'}\n\`\`\`\n`;
        selectionOffsetStart = 5;
        selectionOffsetEnd = replacement.length - 5;
        break;
      case 'table':
        replacement = `\n| Header 1 | Header 2 |\n| -------- | -------- |\n| Cell 1   | Cell 2   |\n`;
        selectionOffsetStart = 2;
        selectionOffsetEnd = replacement.length - 1;
        break;
      case 'checkbox':
        const checkboxNewLine = start === 0 || text.charAt(start - 1) === '\n';
        replacement = `${checkboxNewLine ? '' : '\n'}- [ ] ${selected || 'New Task'}`;
        selectionOffsetStart = checkboxNewLine ? 6 : 7;
        selectionOffsetEnd = replacement.length;
        break;
    }

    const newContent = text.substring(0, start) + replacement + text.substring(end);
    setContent(newContent);
    
    // Refocus and select
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + selectionOffsetStart, start + selectionOffsetEnd);
    }, 50);
  };

  const getTabPath = (tab: typeof TABS[number]) => {
    if (tab.phase === 'constitution') {
      return state?.constitutionPhase?.filePath || '.specify/memory/constitution.md';
    }
    if (!state?.activeFeatureName) return null;
    const activeFeature = state.features.find(f => f.name === state.activeFeatureName);
    const phaseState = activeFeature?.phases.find(p => p.phase === tab.phase);
    return phaseState?.filePath || tab.defaultPath(state.activeFeatureName);
  };

  const getPhaseStatus = (phase: string) => {
    if (phase === 'constitution') {
      return state?.constitutionPhase?.status || 'idle';
    }
    if (!state?.activeFeatureName) return 'idle';
    const activeFeature = state.features.find(f => f.name === state.activeFeatureName);
    const phaseState = activeFeature?.phases.find(p => p.phase === phase);
    return phaseState?.status || 'idle';
  };

  useEffect(() => {
    if (initialContent !== lastInitialContentRef.current) {
      if (initialContent === content) {
        // User's own changes were saved/written to disk, or they typed and match the disk
        setExternalChange(false);
      } else if (content === lastInitialContentRef.current || lastInitialContentRef.current === null) {
        // Safe to auto-update since editor has no unsaved changes
        setContent(initialContent || '');
        setExternalChange(false);
      } else {
        // Remote content has diverged from local content!
        setExternalChange(true);
      }
      lastInitialContentRef.current = initialContent;
    }
  }, [initialContent, content]);

  const handleSave = async () => {
    if (!filePath) return;
    setSaving(true);
    try {
      await onSave(content);
    } finally {
      setSaving(false);
    }
  };

  const handleReloadFromDisk = () => {
    setContent(initialContent || '');
    setExternalChange(false);
  };

  const handleKeepChanges = () => {
    setExternalChange(false);
  };

  const parseInlineMarkdown = (text: string): React.ReactNode[] => {
    // Basic regex parser for inline code `code`, bold **bold**, italic *italic*
    const parts: React.ReactNode[] = [];
    let currentText = text;
    let key = 0;

    while (currentText.length > 0) {
      const boldMatch = currentText.match(/^([^\*]*)\*\*([^\*]+)\*\*(.*)/);
      const codeMatch = currentText.match(/^([^`]*)`([^`]+)`(.*)/);

      if (codeMatch && (!boldMatch || codeMatch[1].length < boldMatch[1].length)) {
        if (codeMatch[1]) {
          parts.push(<span key={key++}>{codeMatch[1]}</span>);
        }
        parts.push(
          <code key={key++} className="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded font-mono text-xs text-red-500 dark:text-red-400">
            {codeMatch[2]}
          </code>
        );
        currentText = codeMatch[3];
      } else if (boldMatch) {
        if (boldMatch[1]) {
          parts.push(<span key={key++}>{boldMatch[1]}</span>);
        }
        parts.push(<strong key={key++} className="font-semibold text-zinc-900 dark:text-zinc-100">{boldMatch[2]}</strong>);
        currentText = boldMatch[3];
      } else {
        parts.push(<span key={key++}>{currentText}</span>);
        break;
      }
    }

    return parts.length > 0 ? parts : [text];
  };

  const renderPreview = () => {
    if (!content) {
      return <p className="text-zinc-400 italic text-sm">No content to display.</p>;
    }

    const lines = content.split('\n');
    let insideCodeBlock = false;
    let codeBlockContent: string[] = [];

    const elements: React.ReactNode[] = [];

    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];

      // Handle code blocks ```
      if (line.trim().startsWith('```')) {
        if (insideCodeBlock) {
          insideCodeBlock = false;
          elements.push(
            <pre key={`code-${idx}`} className="p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded font-mono text-xs overflow-x-auto text-zinc-800 dark:text-zinc-200 my-3">
              <code>{codeBlockContent.join('\n')}</code>
            </pre>
          );
          codeBlockContent = [];
        } else {
          insideCodeBlock = true;
        }
        continue;
      }

      if (insideCodeBlock) {
        codeBlockContent.push(line);
        continue;
      }

      // Check if we are starting a table (header row + separator row)
      if (
        line.trim().startsWith('|') &&
        idx + 1 < lines.length &&
        lines[idx + 1].trim().match(/^\|?\s*(:?-+:?\s*\|?)+$/)
      ) {
        // We found a table!
        const headers = line.split('|').map(s => s.trim()).filter((s, hIndex, arr) => {
          if (hIndex === 0 && s === '') return false;
          if (hIndex === arr.length - 1 && s === '') return false;
          return true;
        });

        const rows: string[][] = [];
        const startIdx = idx;
        idx += 2; // skip header and separator lines

        while (idx < lines.length && lines[idx].trim().startsWith('|')) {
          const rowCells = lines[idx].split('|').map(s => s.trim()).filter((s, rIndex, arr) => {
            if (rIndex === 0 && s === '') return false;
            if (rIndex === arr.length - 1 && s === '') return false;
            return true;
          });
          rows.push(rowCells);
          idx++;
        }
        // Adjust idx since the outer loop will do idx++
        idx--;

        elements.push(
          <div key={`table-${startIdx}`} className="overflow-x-auto my-4">
            <table className="min-w-full border-collapse border border-zinc-200 dark:border-zinc-800 text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-900/50">
                <tr>
                  {headers.map((h, hIdx) => (
                    <th key={hIdx} className="border border-zinc-200 dark:border-zinc-800 px-4 py-2 text-left font-bold text-zinc-900 dark:text-zinc-100">
                      {parseInlineMarkdown(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/10 odd:bg-zinc-50/10 dark:odd:bg-zinc-950/10">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="border border-zinc-200 dark:border-zinc-800 px-4 py-2 text-zinc-700 dark:text-zinc-350">
                        {parseInlineMarkdown(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }

      // Checkbox list
      const checkboxMatch = line.match(/^(\s*(?:[-*]|\d+\.)\s+\[)( |x|X)(\])(.*)/);
      if (checkboxMatch) {
        const isChecked = checkboxMatch[2].toLowerCase() === 'x';
        const text = checkboxMatch[4];
        const indent = line.search(/\S/);
        elements.push(
          <div
            key={idx}
            className="flex items-start gap-2.5 py-1"
            style={{ paddingLeft: `${indent * 12}px` }}
          >
            <input
              type="checkbox"
              checked={isChecked}
              onChange={(e) => onToggleTask?.(idx, e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 bg-transparent text-black dark:text-white focus:ring-0 cursor-pointer"
            />
            <span className={`text-sm leading-relaxed ${isChecked ? 'line-through text-zinc-400 dark:text-zinc-500' : 'text-zinc-800 dark:text-zinc-200'}`}>
              {parseInlineMarkdown(text)}
            </span>
          </div>
        );
        continue;
      }

      // Headers
      const headerMatch = line.match(/^(#{1,6})\s+(.*)/);
      if (headerMatch) {
        const level = headerMatch[1].length;
        const text = headerMatch[2];
        const classes = [
          '',
          'text-2xl font-bold border-b border-zinc-200 dark:border-zinc-850 pb-1 mt-6 mb-3 text-zinc-900 dark:text-zinc-100', // h1
          'text-xl font-bold mt-5 mb-2.5 text-zinc-900 dark:text-zinc-100', // h2
          'text-lg font-semibold mt-4 mb-2 text-zinc-800 dark:text-zinc-200', // h3
          'text-base font-semibold mt-3 mb-2 text-zinc-800 dark:text-zinc-200', // h4
          'text-sm font-semibold mt-2.5 mb-1.5 text-zinc-850 dark:text-zinc-250', // h5
          'text-xs font-semibold mt-2 mb-1 text-zinc-900 dark:text-zinc-300' // h6
        ];
        elements.push(
          React.createElement(
            `h${level}`,
            { key: idx, className: classes[level] },
            parseInlineMarkdown(text)
          )
        );
        continue;
      }

      // Blockquote / GitHub Alerts
      const alertMatch = line.match(/^>\s+\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](.*)/i);
      if (alertMatch) {
        const type = alertMatch[1].toUpperCase();
        const text = alertMatch[2];
        const bgColors = {
          NOTE: 'bg-zinc-50 dark:bg-zinc-950 border-blue-500 text-zinc-800 dark:text-zinc-200',
          TIP: 'bg-zinc-50 dark:bg-zinc-950 border-green-500 text-zinc-800 dark:text-zinc-200',
          IMPORTANT: 'bg-zinc-50 dark:bg-zinc-950 border-purple-500 text-zinc-800 dark:text-zinc-200',
          WARNING: 'bg-zinc-50 dark:bg-zinc-950 border-amber-500 text-zinc-800 dark:text-zinc-200',
          CAUTION: 'bg-zinc-50 dark:bg-zinc-950 border-red-500 text-zinc-800 dark:text-zinc-200'
        };
        elements.push(
          <div key={idx} className={`p-3.5 border-l-4 my-3 rounded-r text-sm font-medium ${bgColors[type as keyof typeof bgColors]}`}>
            <div className="font-bold text-xs tracking-wider mb-1 text-zinc-400">{type}</div>
            <div>{parseInlineMarkdown(text)}</div>
          </div>
        );
        continue;
      }

      if (line.startsWith('>')) {
        elements.push(
          <blockquote key={idx} className="border-l-4 border-zinc-200 dark:border-zinc-800 pl-4 py-1.5 my-3 text-zinc-500 italic text-sm">
            {parseInlineMarkdown(line.substring(1).trim())}
          </blockquote>
        );
        continue;
      }

      // Horizontal line
      if (line.trim() === '---') {
        elements.push(<hr key={idx} className="my-6 border-zinc-200 dark:border-zinc-800" />);
        continue;
      }

      // Bullet points
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        const text = line.trim().substring(2);
        elements.push(
          <li key={idx} className="ml-4 list-disc text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 my-0.5">
            {parseInlineMarkdown(text)}
          </li>
        );
        continue;
      }

      // Empty line
      if (line.trim() === '') {
        elements.push(<div key={idx} className="h-2" />);
        continue;
      }

      // Regular paragraph
      elements.push(
        <p key={idx} className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 my-1">
          {parseInlineMarkdown(line)}
        </p>
      );
    }

    return <div className="space-y-1">{elements}</div>;
  };

  return (
    <div className="flex flex-col h-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black rounded-lg overflow-hidden">
      {/* File Tab Bar */}
      {state && onSelectFile && (
        <div className="flex items-center border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/30 overflow-x-auto scrollbar-none shrink-0">
          {TABS.map((tab) => {
            const tabPath = getTabPath(tab);
            const isDisabled = tab.phase !== 'constitution' && !state?.activeFeatureName;
            const status = getPhaseStatus(tab.phase);
            const isActive = !isDisabled && tabPath && filePath && (
              tabPath.replace(/\\/g, '/').toLowerCase() === filePath.replace(/\\/g, '/').toLowerCase() ||
              filePath.replace(/\\/g, '/').toLowerCase().endsWith(tabPath.replace(/\\/g, '/').toLowerCase()) ||
              tabPath.replace(/\\/g, '/').toLowerCase().endsWith(filePath.replace(/\\/g, '/').toLowerCase())
            );

            // Dot classes
            let dotColor = 'bg-zinc-300 dark:bg-zinc-700';
            if (status === 'approved') dotColor = 'bg-emerald-500';
            if (status === 'awaiting_review') dotColor = 'bg-amber-500';
            if (status === 'running') dotColor = 'bg-blue-500 animate-pulse';

            return (
              <button
                key={tab.phase}
                disabled={isDisabled}
                onClick={() => tabPath && onSelectFile(tabPath)}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition shrink-0 ${
                  isDisabled
                    ? 'text-zinc-300 dark:text-zinc-800 cursor-not-allowed border-transparent'
                    : isActive
                    ? 'text-black dark:text-white border-black dark:border-white bg-white dark:bg-zinc-900/50'
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 border-transparent hover:bg-zinc-100/30 dark:hover:bg-zinc-900/30'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {!filePath ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-zinc-400 bg-zinc-50 dark:bg-zinc-950/10">
          <p className="text-sm">Select a tab or a phase to start editing or viewing markdown.</p>
        </div>
      ) : (
        <>
          {/* Editor toolbar */}
          <div className="flex justify-between items-center px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 shrink-0">
            <span className="text-xs font-mono text-zinc-500 truncate max-w-[200px] sm:max-w-md">
              {filePath.split('/').pop()}
            </span>
            <div className="flex items-center gap-1.5">
              <div className="flex items-center bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded p-0.5">
                <button
                  onClick={() => setMode('edit')}
                  className={`p-1.5 rounded transition text-xs flex items-center gap-1 ${mode === 'edit' ? 'bg-white dark:bg-zinc-800 text-zinc-850 dark:text-zinc-50 shadow-sm' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
                >
                  <Edit2 size={12} />
                  <span className="hidden sm:inline">Edit</span>
                </button>
                <button
                  onClick={() => setMode('preview')}
                  className={`p-1.5 rounded transition text-xs flex items-center gap-1 ${mode === 'preview' ? 'bg-white dark:bg-zinc-800 text-zinc-850 dark:text-zinc-50 shadow-sm' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
                >
                  <Eye size={12} />
                  <span className="hidden sm:inline">Preview</span>
                </button>
                <button
                  onClick={() => setMode('split')}
                  className={`p-1.5 rounded transition text-xs flex items-center gap-1 ${mode === 'split' ? 'bg-white dark:bg-zinc-800 text-zinc-850 dark:text-zinc-50 shadow-sm' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}
                >
                  <Columns size={12} />
                  <span className="hidden sm:inline">Split</span>
                </button>
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1 px-3 py-1.5 bg-black dark:bg-white text-white dark:text-black rounded text-xs font-medium hover:bg-zinc-800 dark:hover:bg-zinc-100 transition disabled:opacity-50"
              >
                <Save size={12} />
                <span>{saving ? 'Saving...' : 'Save'}</span>
              </button>

              {onToggleMaximize && (
                <>
                  <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-800 mx-1" />
                  <button
                    onClick={onToggleMaximize}
                    className="p-1.5 rounded text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition"
                    title={isMaximized ? "Restore Layout" : "Maximize Editor"}
                  >
                    {isMaximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* WYSIWYG Formatting Bar */}
          {(mode === 'edit' || mode === 'split') && (
            <div className="flex items-center gap-1.5 px-4 py-1.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/35 dark:bg-zinc-950/20 overflow-x-auto scrollbar-none shrink-0">
              <button
                onClick={() => insertMarkdown('bold')}
                className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition"
                title="Bold"
              >
                <Bold size={13} />
              </button>
              <button
                onClick={() => insertMarkdown('italic')}
                className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition"
                title="Italic"
              >
                <Italic size={13} />
              </button>
              <button
                onClick={() => insertMarkdown('heading')}
                className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition"
                title="Heading"
              >
                <Heading size={13} />
              </button>
              <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-800 mx-1" />
              <button
                onClick={() => insertMarkdown('link')}
                className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition"
                title="Insert Link"
              >
                <Link size={13} />
              </button>
              <button
                onClick={() => insertMarkdown('code')}
                className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded text-zinc-650 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition"
                title="Insert Code Block"
              >
                <Code size={13} />
              </button>
              <button
                onClick={() => insertMarkdown('table')}
                className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded text-zinc-650 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition"
                title="Insert Table"
              >
                <Table size={13} />
              </button>
              <button
                onClick={() => insertMarkdown('checkbox')}
                className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded text-zinc-650 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition"
                title="Add Task"
              >
                <CheckSquare size={13} />
              </button>
            </div>
          )}

          {/* External Change Alert Banner */}
          {externalChange && (
            <div className="flex items-center justify-between px-4 py-2 bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-300 transition-all shrink-0">
              <div className="flex items-center gap-1.5 font-medium">
                <span>⚠️ External changes detected. The file on disk has been modified.</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleReloadFromDisk}
                  className="px-2 py-1 bg-amber-600 dark:bg-amber-700 text-white rounded hover:bg-amber-700 dark:hover:bg-amber-600 transition font-semibold"
                >
                  Reload from disk
                </button>
                <button
                  onClick={handleKeepChanges}
                  className="px-2 py-1 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded hover:bg-zinc-300 dark:hover:bg-zinc-750 transition font-semibold"
                >
                  Keep my changes
                </button>
              </div>
            </div>
          )}

          {/* Editor Body */}
          <div className="flex-1 flex overflow-hidden min-h-0">
            {/* Edit Panel */}
            {(mode === 'edit' || mode === 'split') && (
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className={`flex-1 p-4 bg-transparent resize-none border-0 outline-none focus:ring-0 text-zinc-800 dark:text-zinc-100 font-mono text-xs leading-relaxed ${mode === 'split' ? 'border-r border-zinc-200 dark:border-zinc-800' : ''}`}
                placeholder="Write markdown here..."
              />
            )}

            {/* Preview Panel */}
            {(mode === 'preview' || mode === 'split') && (
              <div className="flex-1 p-5 overflow-y-auto bg-transparent prose dark:prose-invert max-w-none">
                {renderPreview()}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default MarkdownEditor;
