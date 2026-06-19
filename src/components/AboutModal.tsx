'use client';

import React from 'react';
import { X, Globe, Github } from 'lucide-react';

// Keep in sync with package.json "version".
export const APP_VERSION = '0.3.0';
export const CREATOR = {
  name: 'Rafael Sales',
  website: 'https://rfsales.dev',
  github: 'https://github.com/dmux/speckit-assistant',
};

type AboutModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 w-full max-w-sm rounded-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🌱</span>
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white tracking-tight">Spec Kit Assistant</h2>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">v{APP_VERSION}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 dark:text-zinc-400 transition">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Visual orchestrator for Spec-Driven Development (SDD).
          </p>

          <div>
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Created by</div>
            <div className="text-sm font-semibold text-zinc-900 dark:text-white mb-2">{CREATOR.name}</div>
            <div className="flex flex-col gap-1.5">
              <a
                href={CREATOR.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300 hover:text-black dark:hover:text-white transition"
              >
                <Globe size={13} /> {CREATOR.website.replace(/^https?:\/\//, '')}
              </a>
              <a
                href={CREATOR.github}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300 hover:text-black dark:hover:text-white transition"
              >
                <Github size={13} /> {CREATOR.github.replace(/^https?:\/\//, '')}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutModal;
