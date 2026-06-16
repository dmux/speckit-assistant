import React from 'react';
import { WorkflowState, FeatureWorkflow, WorkflowPhase, PhaseState } from '../domain/models/types';
import { Play, Check, RotateCcw, AlertTriangle, CheckCircle2, ChevronRight, Trash2 } from 'lucide-react';

type KanbanBoardProps = {
  state: WorkflowState;
  onRunPhase: (phase: WorkflowPhase, featureName: string | null) => void;
  onApprovePhase: (phase: WorkflowPhase, featureName: string | null) => void;
  onDiscardPhase: (phase: WorkflowPhase, featureName: string | null) => void;
  onSelectFeature: (name: string) => void;
  onDeleteFeature: (name: string) => void;
  onSelectPhaseFile: (filePath: string | null) => void;
  onCardDrop?: (featureName: string, targetColKey: string) => void;
};

const PHASES: WorkflowPhase[] = [
  'specification',
  'clarification',
  'planning',
  'checklist',
  'analyze',
  'tasks',
  'taskstoissues',
  'implementation'
];
const COLUMN_HEADERS: Record<string, string> = {
  specification: 'Specification',
  clarification: 'Clarification',
  planning: 'Planning',
  checklist: 'Checklist',
  analyze: 'Analysis',
  tasks: 'Tasks',
  taskstoissues: 'Tasks to Issues',
  implementation: 'Implementation',
  completed: 'Completed'
};

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  state,
  onRunPhase,
  onApprovePhase,
  onDiscardPhase,
  onSelectFeature,
  onDeleteFeature,
  onSelectPhaseFile,
  onCardDrop
}) => {
  const [dragOverCol, setDragOverCol] = React.useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, featureName: string) => {
    e.dataTransfer.setData('text/plain', featureName);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragEnter = (e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    setDragOverCol(colKey);
  };

  const handleDragLeave = () => {
    setDragOverCol(null);
  };

  const handleDrop = (e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    setDragOverCol(null);
    const featureName = e.dataTransfer.getData('text/plain');
    if (featureName) {
      onCardDrop?.(featureName, colKey);
    }
  };
  
  // Helper to determine which column a feature belongs to
  const getFeatureColumn = (feature: FeatureWorkflow): string => {
    for (const phase of feature.phases) {
      if (phase.status !== 'approved') {
        return phase.phase;
      }
    }
    return 'completed';
  };

  // Helper to parse progress from tasks.md content
  const parseProgress = (feature: FeatureWorkflow) => {
    const tasksPhase = feature.phases.find(p => p.phase === 'tasks');
    if (!tasksPhase?.content) return null;
    const checkboxes = [...tasksPhase.content.matchAll(/^\s*(?:[-*]|\d+\.)\s+\[( |x|X)\]/gm)];
    if (checkboxes.length === 0) return null;
    const done = checkboxes.filter(c => c[1].toLowerCase() === 'x').length;
    return { done, total: checkboxes.length };
  };

  const getStatusBadge = (status: string, stale?: boolean) => {
    if (stale) {
      return (
        <span className="flex items-center gap-1 text-[10px] font-semibold text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
          <AlertTriangle size={10} />
          STALE
        </span>
      );
    }
    switch (status) {
      case 'running':
        return (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20 animate-pulse">
            RUNNING
          </span>
        );
      case 'awaiting_review':
        return (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
            REVIEW
          </span>
        );
      case 'approved':
        return (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded border border-green-500/20">
            APPROVED
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-semibold text-zinc-400 bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-800">
            IDLE
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-black overflow-y-auto">
      {/* Constitution Banner */}
      <div className="mx-6 my-4 p-4 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-950 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Project Constitution</h2>
            {getStatusBadge(state.constitutionPhase.status, state.constitutionPhase.stale)}
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Governing principles and rules that guide all subsequent planning and implementation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onSelectPhaseFile(state.constitutionPhase.filePath)}
            disabled={!state.constitutionPhase.filePath}
            className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded text-xs transition disabled:opacity-50"
          >
            View Constitution
          </button>
          {state.constitutionPhase.status !== 'approved' ? (
            <>
              <button
                onClick={() => onRunPhase('constitution', null)}
                disabled={state.constitutionPhase.status === 'running'}
                className="flex items-center gap-1 px-3 py-1.5 bg-black dark:bg-white text-white dark:text-black rounded text-xs font-semibold hover:opacity-90 transition disabled:opacity-50"
              >
                <Play size={10} fill="currentColor" /> Run
              </button>
              {state.constitutionPhase.status === 'awaiting_review' && (
                <button
                  onClick={() => onApprovePhase('constitution', null)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-green-650 hover:bg-green-700 text-white rounded text-xs font-semibold transition"
                >
                  <Check size={10} /> Approve
                </button>
              )}
            </>
          ) : (
            <button
              onClick={() => onDiscardPhase('constitution', null)}
              className="flex items-center gap-1 px-3 py-1.5 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded text-xs transition"
            >
              <RotateCcw size={10} /> Discard
            </button>
          )}
        </div>
      </div>

      {/* Columns wrapper */}
      <div className="flex-1 flex gap-4 px-6 pb-6 overflow-x-auto min-h-0">
        {(['specification', 'clarification', 'planning', 'checklist', 'analyze', 'tasks', 'taskstoissues', 'implementation', 'completed'] as const).map(colKey => {
          const colFeatures = state.features.filter(f => getFeatureColumn(f) === colKey);
          
          return (
            <div
              key={colKey}
              onDragOver={handleDragOver}
              onDragEnter={(e) => handleDragEnter(e, colKey)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, colKey)}
              className={`flex flex-col flex-shrink-0 w-72 h-full border rounded-lg overflow-hidden transition-all duration-200 ${
                dragOverCol === colKey
                  ? 'border-dashed border-zinc-400 dark:border-zinc-500 bg-zinc-100/70 dark:bg-zinc-900/40 ring-1 ring-zinc-400 dark:ring-zinc-500'
                  : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/20'
              }`}
            >
              {/* Header */}
              <div className="flex justify-between items-center px-3.5 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950/70">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  {COLUMN_HEADERS[colKey]}
                </span>
                <span className="text-xs text-zinc-400 bg-zinc-200 dark:bg-zinc-900 px-1.5 py-0.5 rounded-full font-semibold">
                  {colFeatures.length}
                </span>
              </div>

              {/* Cards area */}
              <div className="flex-1 p-3 overflow-y-auto space-y-3" style={{ scrollbarWidth: 'thin' }}>
                {colFeatures.length === 0 ? (
                  <div className="flex items-center justify-center h-24 border border-dashed border-zinc-200 dark:border-zinc-800 rounded bg-white dark:bg-black/10 text-xs text-zinc-400">
                    No features in this phase
                  </div>
                ) : (
                  colFeatures.map(feature => {
                    const progress = parseProgress(feature);
                    const activePhaseState = colKey === 'completed'
                      ? feature.phases[feature.phases.length - 1]
                      : feature.phases.find(p => p.phase === colKey)!;
                    
                    const isActive = state.activeFeatureName === feature.name;

                    return (
                      <div
                        key={feature.name}
                        draggable
                        onDragStart={(e) => handleDragStart(e, feature.name)}
                        onClick={() => onSelectFeature(feature.name)}
                        className={`p-3.5 border rounded-lg bg-white dark:bg-black transition-all cursor-pointer group flex flex-col justify-between hover:shadow-sm active:scale-[0.98] ${
                          isActive
                            ? 'border-black dark:border-white ring-1 ring-black dark:ring-white shadow-sm'
                            : 'border-zinc-200 dark:border-zinc-850 hover:border-zinc-350 dark:hover:border-zinc-700'
                        }`}
                      >
                        <div>
                          <div className="flex justify-between items-start gap-2">
                            <span className="text-xs font-bold text-zinc-850 dark:text-zinc-100 truncate group-hover:text-black dark:group-hover:text-white">
                              {feature.name}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteFeature(feature.name);
                              }}
                              className="text-zinc-400 hover:text-red-500 p-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded opacity-0 group-hover:opacity-100 transition"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>

                          {/* Action area based on status */}
                          {colKey !== 'completed' && (
                            <div className="flex justify-between items-center mt-3">
                              {getStatusBadge(activePhaseState.status, activePhaseState.stale)}

                              {progress && (
                                <span className="text-[10px] font-mono text-zinc-400 bg-zinc-100 dark:bg-zinc-900 px-1 py-0.5 rounded">
                                  {progress.done}/{progress.total} Tasks
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Interactive Phase Control buttons on cards */}
                        <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-900 flex justify-end items-center gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectPhaseFile(activePhaseState.filePath);
                            }}
                            disabled={!activePhaseState.filePath}
                            className="mr-auto text-[10px] hover:underline text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 disabled:opacity-0"
                          >
                            Open File
                          </button>

                          {colKey !== 'completed' ? (
                            activePhaseState.status !== 'approved' ? (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onRunPhase(colKey, feature.name);
                                  }}
                                  disabled={activePhaseState.status === 'running'}
                                  className="flex items-center gap-0.5 p-1 px-2 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-[10px] font-semibold rounded transition"
                                >
                                  <Play size={8} fill="currentColor" /> Run
                                </button>

                                {activePhaseState.status === 'awaiting_review' && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onApprovePhase(colKey, feature.name);
                                    }}
                                    className="flex items-center gap-0.5 p-1 px-2 bg-green-500 hover:bg-green-600 text-white text-[10px] font-semibold rounded transition"
                                  >
                                    <Check size={8} /> Approve
                                  </button>
                                )}
                              </>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDiscardPhase(colKey, feature.name);
                                }}
                                className="flex items-center gap-0.5 p-1 px-2 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-[10px] font-semibold rounded text-zinc-500 hover:text-zinc-700 transition"
                              >
                                <RotateCcw size={8} /> Reset
                              </button>
                            )
                          ) : (
                            <span className="flex items-center gap-0.5 text-green-500 font-bold text-[10px] uppercase">
                              <CheckCircle2 size={10} /> Complete
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
export default KanbanBoard;
