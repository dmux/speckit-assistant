'use client';

import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileText, FileCode } from 'lucide-react';

export type TreeNode = {
  name: string;
  path: string;
  type: 'dir' | 'file';
  children?: TreeNode[];
};

const CODE_EXTS = new Set(['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'json', 'css', 'scss', 'py', 'go', 'rs', 'java', 'sql', 'yml', 'yaml', 'sh']);

function isCodeFile(name: string): boolean {
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
  return CODE_EXTS.has(ext);
}

type NodeProps = {
  node: TreeNode;
  depth: number;
  selectedPath: string;
  onSelectFile: (path: string) => void;
};

const TreeNodeView: React.FC<NodeProps> = ({ node, depth, selectedPath, onSelectFile }) => {
  const [expanded, setExpanded] = useState<boolean>(depth < 1);
  const pad = { paddingLeft: `${depth * 12 + 8}px` };

  if (node.type === 'dir') {
    return (
      <div>
        <button
          onClick={() => setExpanded((e) => !e)}
          style={pad}
          className="w-full flex items-center gap-1.5 py-1 pr-2 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-zinc-200 rounded transition"
        >
          {expanded ? <ChevronDown size={12} className="shrink-0" /> : <ChevronRight size={12} className="shrink-0" />}
          {expanded ? <FolderOpen size={13} className="shrink-0 text-amber-500" /> : <Folder size={13} className="shrink-0 text-amber-500" />}
          <span className="truncate font-medium">{node.name}</span>
        </button>
        {expanded && node.children && node.children.length > 0 && (
          <div>
            {node.children.map((child) => (
              <TreeNodeView
                key={child.path}
                node={child}
                depth={depth + 1}
                selectedPath={selectedPath}
                onSelectFile={onSelectFile}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const isSelected = selectedPath === node.path;
  return (
    <button
      onClick={() => onSelectFile(node.path)}
      style={pad}
      className={`w-full flex items-center gap-1.5 py-1 pr-2 text-xs rounded transition ${
        isSelected
          ? 'bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-white'
          : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-zinc-200'
      }`}
    >
      <span className="w-3 shrink-0" />
      {isCodeFile(node.name)
        ? <FileCode size={13} className="shrink-0 text-blue-500 dark:text-blue-400" />
        : <FileText size={13} className="shrink-0 text-zinc-500" />}
      <span className="truncate font-mono text-[11px]">{node.name}</span>
    </button>
  );
};

type FileTreeProps = {
  nodes: TreeNode[];
  selectedPath: string;
  onSelectFile: (path: string) => void;
};

export const FileTree: React.FC<FileTreeProps> = ({ nodes, selectedPath, onSelectFile }) => {
  if (nodes.length === 0) {
    return <div className="text-zinc-500 text-xs text-center py-8">No files found.</div>;
  }
  return (
    <div className="space-y-0.5">
      {nodes.map((node) => (
        <TreeNodeView
          key={node.path}
          node={node}
          depth={0}
          selectedPath={selectedPath}
          onSelectFile={onSelectFile}
        />
      ))}
    </div>
  );
};

export default FileTree;
