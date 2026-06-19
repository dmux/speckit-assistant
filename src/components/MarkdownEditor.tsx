import React, { useState, useEffect, useRef } from 'react';
import { Edit2, Eye, Save, Columns, Maximize2, Minimize2, Bold, Italic, Heading, Link, Code, Table, CheckSquare } from 'lucide-react';
import { WorkflowState, PhaseFile } from '@/domain/models/types';
import { MarkdownPreview } from './MarkdownPreview';

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

  const normalizePath = (p: string) => p.replace(/\\/g, '/').toLowerCase();
  const pathsMatch = (a: string | null | undefined, b: string | null | undefined) => {
    if (!a || !b) return false;
    const na = normalizePath(a);
    const nb = normalizePath(b);
    return na === nb || na.endsWith(nb) || nb.endsWith(na);
  };

  // Files of the multi-file phase (e.g. a checklist/ directory) that the
  // currently selected file belongs to — drives the per-file sub-bar.
  const activePhaseFiles: PhaseFile[] | undefined = (() => {
    if (!filePath || !state?.activeFeatureName) return undefined;
    const activeFeature = state.features.find(f => f.name === state.activeFeatureName);
    return activeFeature?.phases.find(
      p => (p.files?.length ?? 0) > 1 && p.files!.some(f => pathsMatch(f.path, filePath))
    )?.files;
  })();

  // When the selected file changes, sync the editor to its content. Runs before
  // the initialContent effect below so that one sees no divergence and skips.
  useEffect(() => {
    setContent(initialContent || '');
    setExternalChange(false);
    lastInitialContentRef.current = initialContent;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filePath]);

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

  return (
    <div className="flex flex-col h-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black rounded-lg overflow-hidden">
      {/* File Tab Bar */}
      {state && onSelectFile && (
        <div className="flex items-center border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/30 overflow-x-auto scrollbar-none shrink-0">
          {TABS.map((tab) => {
            const tabPath = getTabPath(tab);
            const isDisabled = tab.phase !== 'constitution' && !state?.activeFeatureName;
            const status = getPhaseStatus(tab.phase);
            const tabFiles = state?.features
              .find(f => f.name === state?.activeFeatureName)
              ?.phases.find(p => p.phase === tab.phase)?.files;
            const isActive = !isDisabled && !!filePath && (
              pathsMatch(tabPath, filePath) ||
              (tabFiles?.some(f => pathsMatch(f.path, filePath)) ?? false)
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

      {/* Per-file sub-bar for phases that resolve to a directory of .md files */}
      {state && onSelectFile && activePhaseFiles && activePhaseFiles.length > 1 && (
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-950/20 overflow-x-auto scrollbar-none shrink-0">
          {activePhaseFiles.map((file) => {
            const isFileActive = pathsMatch(file.path, filePath);
            const name = file.path.replace(/\\/g, '/').split('/').pop();
            return (
              <button
                key={file.path}
                onClick={() => onSelectFile(file.path)}
                className={`px-2.5 py-1 text-[11px] font-mono rounded border transition shrink-0 ${
                  isFileActive
                    ? 'text-black dark:text-white border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900'
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 border-transparent hover:bg-zinc-100/50 dark:hover:bg-zinc-900/40'
                }`}
              >
                {name}
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
                <MarkdownPreview content={content} onToggleTask={onToggleTask} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default MarkdownEditor;
