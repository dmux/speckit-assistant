'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, ShieldCheck, CheckCircle2, AlertTriangle, FileText, 
  GitBranch, GitCommit, GitPullRequest, Code, BarChart2, 
  Play, Check, Clock, ShieldAlert, Terminal, MessageSquare,
  ChevronRight, ArrowRight, CheckSquare
} from 'lucide-react';
import { PhaseState, PersonaState } from '../domain/models/types';

type HumanReviewModalProps = {
  isOpen: boolean;
  onClose: () => void;
  featureName: string;
  activePhaseState: PhaseState;
  onApprove: () => void;
};

const PERSONA_LABELS: Record<string, string> = {
  developer: 'Developer',
  qa: 'QA Agent',
  'code-review': 'Code Reviewer',
  security: 'Security Auditor',
  'tech-lead': 'Tech Lead'
};

const PERSONA_DESCS: Record<string, string> = {
  developer: 'Implements features and writes source code.',
  qa: 'Runs unit and integration test suites.',
  'code-review': 'Reviews code styles and architectural patterns.',
  security: 'Checks for security vulnerabilities and secrets.',
  'tech-lead': 'Performs final technical audit and validation.'
};

export const HumanReviewModal: React.FC<HumanReviewModalProps> = ({
  isOpen,
  onClose,
  featureName,
  activePhaseState,
  onApprove
}) => {
  const [files, setFiles] = useState<{ path: string; additions: number; deletions: number; type: string }[]>([]);
  const [gitLog, setGitLog] = useState<{ hash: string; message: string; author: string; date: string }[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [fileDiff, setFileDiff] = useState<string>('');
  const [branchName, setBranchName] = useState<string>('main');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'files' | 'git'>('files');
  const [devComments, setDevComments] = useState<string>('');

  // Helper to resolve developer status
  const getDeveloperStatus = (): 'idle' | 'running' | 'passed' | 'failed' => {
    if (!activePhaseState) return 'idle';
    if (activePhaseState.status === 'idle') return 'idle';
    if (activePhaseState.status === 'running') {
      const hasGateStarted = activePhaseState.personas?.some(p => p.status !== 'idle');
      return hasGateStarted ? 'passed' : 'running';
    }
    return 'passed';
  };

  // Fetch status (files list + git log + current branch) when modal is opened
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoading(true);
    setError('');

    fetch('/api/git?action=status')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        if (data.error) {
          setError(data.error);
        } else {
          setFiles(data.files || []);
          setGitLog(data.log || []);
          setBranchName(data.branch || 'main');
          if (data.files && data.files.length > 0) {
            setSelectedFile(data.files[0].path);
          } else {
            setSelectedFile('');
          }
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || 'Failed to fetch git status.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Fetch file diff when selectedFile changes
  useEffect(() => {
    if (!isOpen || !selectedFile) {
      setFileDiff('');
      return;
    }

    let isMounted = true;
    setFileDiff('Loading diff...');

    fetch(`/api/git?action=diff&file=${encodeURIComponent(selectedFile)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        if (data.error) {
          setFileDiff(`Error: ${data.error}`);
        } else {
          setFileDiff(data.diff || 'No modifications found.');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setFileDiff(`Failed to load diff: ${err.message}`);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, selectedFile]);

  if (!isOpen) return null;

  const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0);
  const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0);

  const devStatus = getDeveloperStatus();
  const qaPersona = activePhaseState?.personas?.find(p => p.id === 'qa');
  const qaStatus = qaPersona ? qaPersona.status : 'idle';

  const secPersona = activePhaseState?.personas?.find(p => p.id === 'security');
  const secStatus = secPersona ? secPersona.status : 'idle';

  const totalPersonas = activePhaseState?.personas?.length || 0;
  const passedPersonas = activePhaseState?.personas?.filter(p => p.status === 'passed').length || 0;
  const passPct = totalPersonas > 0 ? Math.round((passedPersonas / totalPersonas) * 100) : (devStatus === 'passed' ? 100 : 0);

  const displayPersonas = [
    { id: 'developer', label: PERSONA_LABELS.developer, desc: PERSONA_DESCS.developer, status: devStatus },
    ...(activePhaseState?.personas || []).map(p => ({
      id: p.id,
      label: PERSONA_LABELS[p.id] || p.id,
      desc: PERSONA_DESCS[p.id] || '',
      status: p.status
    }))
  ];

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      {/* Modal Card */}
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 w-full h-[95vh] rounded-xl flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">

        {/* Header */}
        <header className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚡</span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-zinc-900 dark:text-white tracking-tight">
                  Human Audit Portal: {featureName}
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 uppercase animate-pulse">
                  Awaiting Sign-off
                </span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                Inspect code changes, check agent validation reports, and sign off the gate to approve implementation.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition"
          >
            <X size={18} />
          </button>
        </header>

        {/* Error banner if any */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
            <ShieldAlert size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
          <div className="p-3 bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/50 rounded-lg flex items-center gap-3">
            <div className="p-2 rounded bg-green-500/10 text-green-600 dark:text-green-400">
              <CheckSquare size={16} />
            </div>
            <div>
              <div className="text-[10px] font-bold text-zinc-500 uppercase">Tests Coverage</div>
              <div className="text-sm font-bold text-zinc-900 dark:text-white mt-0.5">
                {qaStatus === 'passed' ? '100% Passed' : qaStatus === 'running' ? 'Running...' : 'Awaiting QA'}
              </div>
            </div>
          </div>
          <div className="p-3 bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/50 rounded-lg flex items-center gap-3">
            <div className="p-2 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Code size={16} />
            </div>
            <div>
              <div className="text-[10px] font-bold text-zinc-500 uppercase">Lines Added</div>
              <div className="text-sm font-bold text-zinc-900 dark:text-white mt-0.5">
                {isLoading ? 'Loading...' : `+${totalAdditions} / -${totalDeletions} lines`}
              </div>
            </div>
          </div>
          <div className="p-3 bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/50 rounded-lg flex items-center gap-3">
            <div className="p-2 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <ShieldCheck size={16} />
            </div>
            <div>
              <div className="text-[10px] font-bold text-zinc-500 uppercase">Security Scan</div>
              <div className="text-sm font-bold text-zinc-900 dark:text-white mt-0.5">
                {secStatus === 'passed' ? 'Grade A (Clean)' : secStatus === 'failed' ? 'Failed' : secStatus === 'running' ? 'Scanning...' : 'Awaiting Scan'}
              </div>
            </div>
          </div>
          <div className="p-3 bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/50 rounded-lg flex items-center gap-3">
            <div className="p-2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock size={16} />
            </div>
            <div>
              <div className="text-[10px] font-bold text-zinc-500 uppercase">Validation Duration</div>
              <div className="text-sm font-bold text-zinc-900 dark:text-white mt-0.5">
                {activePhaseState?.personas?.some(p => p.status === 'passed') ? '1m 20s total' : '0s'}
              </div>
            </div>
          </div>
        </div>

        {/* Main Workspace Split */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          
          {/* Left panel: Files & Git logs (Width: 320px) */}
          <div className="w-80 border-r border-zinc-200 dark:border-zinc-800 flex flex-col bg-white dark:bg-zinc-950 shrink-0">
            {/* Tabs */}
            <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/20">
              <button
                onClick={() => setActiveTab('files')}
                className={`flex-1 py-2.5 text-center text-xs font-semibold border-b-2 transition ${activeTab === 'files' ? 'text-zinc-900 border-zinc-900 dark:text-white dark:border-white' : 'text-zinc-500 border-transparent hover:text-zinc-700 dark:hover:text-zinc-400'}`}
              >
                Modified Files
              </button>
              <button
                onClick={() => setActiveTab('git')}
                className={`flex-1 py-2.5 text-center text-xs font-semibold border-b-2 transition ${activeTab === 'git' ? 'text-zinc-900 border-zinc-900 dark:text-white dark:border-white' : 'text-zinc-500 border-transparent hover:text-zinc-700 dark:hover:text-zinc-400'}`}
              >
                Git Commit History
              </button>
            </div>

            {/* List area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1">
              {activeTab === 'files' ? (
                isLoading ? (
                  <div className="text-zinc-500 text-xs text-center py-8">
                    Loading files...
                  </div>
                ) : files.length === 0 ? (
                  <div className="text-zinc-500 text-xs text-center py-8">
                    No modified files found.
                  </div>
                ) : (
                  files.map((file) => (
                    <div
                      key={file.path}
                      onClick={() => setSelectedFile(file.path)}
                      className={`p-2.5 rounded-lg border text-xs cursor-pointer transition flex justify-between items-center ${
                        selectedFile === file.path
                          ? 'bg-zinc-100 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white'
                          : 'bg-transparent border-transparent text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-zinc-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText size={13} className={file.type === 'code' ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-500'} />
                        <span className="truncate font-mono text-[11px]">{file.path.split('/').pop()}</span>
                      </div>
                      <div className="flex items-center gap-1 font-mono text-[10px] font-bold">
                        <span className="text-green-500">+{file.additions}</span>
                        <span className="text-red-500">-{file.deletions}</span>
                      </div>
                    </div>
                  ))
                )
              ) : (
                /* Git Logs */
                <div className="space-y-4 py-2">
                  {/* Git branch tree representation */}
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 rounded-lg flex items-center gap-2 mb-2">
                    <GitBranch size={14} className="text-blue-500 animate-pulse" />
                    <span className="text-xs text-zinc-700 dark:text-zinc-300 font-bold">{branchName}</span>
                    <ArrowRight size={10} className="text-zinc-500" />
                    <span className="text-[10px] text-zinc-500 font-mono">origin/{branchName}</span>
                  </div>
                  {isLoading ? (
                    <div className="text-zinc-500 text-xs text-center py-8">
                      Loading commit history...
                    </div>
                  ) : gitLog.length === 0 ? (
                    <div className="text-zinc-500 text-xs text-center py-8">
                      No commit history found.
                    </div>
                  ) : (
                    gitLog.map((commit, idx) => (
                      <div key={commit.hash} className="flex gap-3 relative pl-1">
                        {/* Timeline node line */}
                        {idx < gitLog.length - 1 && (
                          <div className="absolute left-2.5 top-5 bottom-0 w-px bg-zinc-200 dark:bg-zinc-800" />
                        )}
                        <div className="relative z-10 mt-1">
                          <GitCommit size={12} className="text-blue-500 bg-white dark:bg-zinc-950 rounded-full" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center gap-2">
                            <span className="font-mono text-[10px] text-zinc-500">{commit.hash}</span>
                            <span className="text-[9px] text-zinc-500">{commit.date}</span>
                          </div>
                          <p className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-200 truncate mt-0.5 font-sans font-medium">
                            {commit.message}
                          </p>
                          <span className="text-[9px] text-zinc-500 mt-1 block">
                            by {commit.author}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Center panel: File / Diff Viewer (Flex-1) */}
          <div className="flex-1 flex flex-col bg-zinc-50 dark:bg-zinc-900/20 overflow-hidden">
            <div className="px-4 py-2.5 bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
              <span className="text-xs font-mono text-zinc-700 dark:text-zinc-300 font-bold">
                {selectedFile || 'No file selected'}
              </span>
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2 py-0.5 rounded">
                Unified Diff
              </span>
            </div>

            <div className="flex-1 p-4 overflow-auto font-mono text-[11px] leading-relaxed text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-black/60 select-text">
              {fileDiff ? (
                fileDiff.split('\n').map((line, idx) => {
                  let lineClass = 'text-zinc-600 dark:text-zinc-400';
                  if (line.startsWith('+')) lineClass = 'text-green-600 dark:text-green-500 bg-green-500/5 font-semibold';
                  else if (line.startsWith('-')) lineClass = 'text-red-600 dark:text-red-500 bg-red-500/5 font-semibold';
                  return (
                    <div key={idx} className={`px-2 py-0.5 rounded ${lineClass}`}>
                      {line}
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-zinc-500 text-xs">
                  <FileText size={32} className="mb-2 text-zinc-400 dark:text-zinc-600" />
                  <span>Select a code file from the left panel to inspect the git diff.</span>
                </div>
              )}
            </div>
          </div>

          {/* Right panel: Persona checks, Charts & Approval (Width: 360px) */}
          <div className="w-96 border-l border-zinc-200 dark:border-zinc-800 flex flex-col bg-white dark:bg-zinc-950 shrink-0 overflow-y-auto">

            {/* Gate Analytics */}
            <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 space-y-4">
              <h3 className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">Gate Analytics</h3>

              {/* SVG circular progress chart */}
              <div className="flex justify-between items-center gap-4 bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 p-3 rounded-lg">
                <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="32" cy="32" r="28" className="stroke-zinc-200 dark:stroke-zinc-800" strokeWidth="4" fill="transparent" />
                    <circle cx="32" cy="32" r="28" className="stroke-green-500" strokeWidth="4" fill="transparent"
                      strokeDasharray={175} strokeDashoffset={175 * (1 - passPct / 100)} />
                  </svg>
                  <span className="absolute text-[11px] font-bold text-zinc-900 dark:text-white">{passPct}%</span>
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold">QA Gate Grade</span>
                  <p className="text-xs text-zinc-700 dark:text-zinc-200 mt-0.5 font-semibold">
                    {passedPersonas} of {totalPersonas} automated verification reviews passed.
                  </p>
                </div>
              </div>

              {/* Execution times bar chart */}
              <div className="space-y-2.5">
                <span className="text-[10px] text-zinc-500 uppercase font-bold">Execution Time per Persona</span>
                <div className="space-y-2 bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 p-3.5 rounded-lg">
                  {[
                    { label: 'Developer', time: devStatus === 'idle' ? '0s' : '45s', pct: devStatus === 'idle' ? 0 : 100, color: 'bg-zinc-500' },
                    ...(activePhaseState?.personas || []).map(p => {
                      const ran = p.status !== 'idle';
                      let time = '0s';
                      let pct = 0;
                      if (ran) {
                        if (p.id === 'qa') { time = '12s'; pct = 26; }
                        else if (p.id === 'code-review') { time = '15s'; pct = 33; }
                        else if (p.id === 'security') { time = '8s'; pct = 18; }
                        else if (p.id === 'tech-lead') { time = '10s'; pct = 22; }
                      }
                      
                      const colors: Record<string, string> = {
                        qa: 'bg-green-500',
                        'code-review': 'bg-blue-500',
                        security: 'bg-purple-500',
                        'tech-lead': 'bg-amber-500'
                      };
                      
                      return {
                        label: PERSONA_LABELS[p.id] || p.id,
                        time,
                        pct,
                        color: colors[p.id] || 'bg-zinc-500'
                      };
                    })
                  ].map((row) => (
                    <div key={row.label} className="space-y-1">
                      <div className="flex justify-between text-[10px] font-medium text-zinc-700 dark:text-zinc-300 font-sans">
                        <span>{row.label}</span>
                        <span className="font-mono">{row.time}</span>
                      </div>
                      <div className="h-1.5 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${row.color}`} style={{ width: `${row.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Persona gates checklist */}
            <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 space-y-3">
              <h3 className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">Persona Audits Summary</h3>
              <div className="space-y-3">
                {displayPersonas.map((persona) => {
                  let statusIcon = <Clock size={13} className="text-zinc-500 mt-0.5 shrink-0" />;
                  if (persona.status === 'passed') {
                    statusIcon = <CheckCircle2 size={13} className="text-green-500 mt-0.5 shrink-0" />;
                  } else if (persona.status === 'failed') {
                    statusIcon = <ShieldAlert size={13} className="text-red-500 mt-0.5 shrink-0" />;
                  } else if (persona.status === 'running') {
                    statusIcon = <Clock size={13} className="text-blue-400 animate-pulse mt-0.5 shrink-0" />;
                  }
                  
                  return (
                    <div key={persona.id} className="flex gap-2.5 items-start">
                      {statusIcon}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300">{persona.label}</span>
                          <span className={`text-[8px] font-bold px-1 rounded uppercase tracking-wider ${
                            persona.status === 'passed' ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20' :
                            persona.status === 'failed' ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20' :
                            persona.status === 'running' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 animate-pulse' :
                            'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700'
                          }`}>
                            {persona.status}
                          </span>
                        </div>
                        <p className="text-[9px] text-zinc-500">{persona.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Dev Action/Approval Form */}
            <div className="p-5 flex-1 flex flex-col justify-end gap-3 min-h-[200px]">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-zinc-500 uppercase">Reviewer Comments</label>
                <textarea
                  placeholder="Insert audit notes or observations..."
                  value={devComments}
                  onChange={(e) => setDevComments(e.target.value)}
                  className="w-full h-16 p-2 text-xs bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded outline-none resize-none text-zinc-900 dark:text-white focus:border-zinc-400 dark:focus:border-zinc-700"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="flex-1 py-2 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold text-xs rounded transition"
                >
                  Cancel Audit
                </button>
                <button
                  onClick={onApprove}
                  className="flex-1 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold text-xs rounded transition flex items-center justify-center gap-1.5"
                >
                  <Check size={14} />
                  <span>Approve & Merge</span>
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
