'use client';

import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

// Map common file extensions to Prism language identifiers.
const EXT_LANGUAGE: Record<string, string> = {
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  jsx: 'jsx',
  mjs: 'javascript',
  cjs: 'javascript',
  json: 'json',
  css: 'css',
  scss: 'scss',
  html: 'markup',
  xml: 'markup',
  svg: 'markup',
  md: 'markdown',
  markdown: 'markdown',
  yml: 'yaml',
  yaml: 'yaml',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  py: 'python',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  java: 'java',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  sql: 'sql',
  toml: 'toml',
  dockerfile: 'docker',
  env: 'bash',
};

export function languageForPath(filePath: string): string {
  const base = filePath.split('/').pop()?.toLowerCase() || '';
  if (base === 'dockerfile') return 'docker';
  const ext = base.includes('.') ? base.split('.').pop()! : '';
  return EXT_LANGUAGE[ext] || 'text';
}

type CodeViewerProps = {
  content: string;
  filePath: string;
  theme?: 'light' | 'dark';
};

export const CodeViewer: React.FC<CodeViewerProps> = ({ content, filePath, theme = 'dark' }) => {
  const language = languageForPath(filePath);

  return (
    <SyntaxHighlighter
      language={language}
      style={theme === 'dark' ? oneDark : oneLight}
      showLineNumbers
      wrapLongLines={false}
      customStyle={{
        margin: 0,
        background: 'transparent',
        fontSize: '11px',
        lineHeight: '1.6',
        padding: '1rem',
      }}
      codeTagProps={{ style: { fontFamily: 'var(--font-mono, monospace)' } }}
      lineNumberStyle={{ minWidth: '2.5em', opacity: 0.4, userSelect: 'none' }}
    >
      {content}
    </SyntaxHighlighter>
  );
};

export default CodeViewer;
