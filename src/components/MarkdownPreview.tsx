import React from 'react';

type MarkdownPreviewProps = {
  content: string;
  // When provided, checkbox list items become interactive (line index of the
  // toggled task is reported back).
  onToggleTask?: (lineIndex: number, checked: boolean) => void;
};

// Basic regex parser for inline code `code`, bold **bold**, italic *italic*.
export const parseInlineMarkdown = (text: string): React.ReactNode[] => {
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

export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({ content, onToggleTask }) => {
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
                    <td key={cIdx} className="border border-zinc-200 dark:border-zinc-800 px-4 py-2 text-zinc-700 dark:text-zinc-300">
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
            disabled={!onToggleTask}
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
        'text-2xl font-bold border-b border-zinc-200 dark:border-zinc-800 pb-1 mt-6 mb-3 text-zinc-900 dark:text-zinc-100', // h1
        'text-xl font-bold mt-5 mb-2.5 text-zinc-900 dark:text-zinc-100', // h2
        'text-lg font-semibold mt-4 mb-2 text-zinc-800 dark:text-zinc-200', // h3
        'text-base font-semibold mt-3 mb-2 text-zinc-800 dark:text-zinc-200', // h4
        'text-sm font-semibold mt-2.5 mb-1.5 text-zinc-800 dark:text-zinc-200', // h5
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

export default MarkdownPreview;
