// @vitest-environment jsdom
import React from 'react';
import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HumanReviewModal } from './HumanReviewModal';
import { PhaseState } from '../domain/models/types';

// --- Mock payloads mirroring /api/git responses ---
const STATUS_PAYLOAD = {
  branch: 'feature-auth',
  files: [
    { path: 'src/index.ts', additions: 10, deletions: 5, type: 'code' },
    { path: 'README.md', additions: 3, deletions: 1, type: 'doc' },
  ],
  log: [
    { hash: 'abc1234', message: 'add auth flow', author: 'Jane Dev', date: '2 hours ago' },
  ],
};

const DIFF_INDEX = 'diff --git a/src/index.ts b/src/index.ts\n+added line\n-removed line\n context line';
const DIFF_README = '+new readme line';

// Route the mocked fetch based on the requested action/file.
function installFetchMock() {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    let body: unknown;
    if (url.includes('action=status')) {
      body = STATUS_PAYLOAD;
    } else if (url.includes('action=diff')) {
      body = url.includes('README.md') ? { diff: DIFF_README } : { diff: DIFF_INDEX };
    } else {
      body = {};
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(body),
    } as Response);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const basePhaseState: PhaseState = {
  phase: 'implementation',
  status: 'awaiting_review',
  filePath: null,
  content: null,
  personas: [],
};

function renderModal(overrides: Partial<React.ComponentProps<typeof HumanReviewModal>> = {}) {
  const onClose = vi.fn();
  const onApprove = vi.fn();
  const utils = render(
    <HumanReviewModal
      isOpen
      onClose={onClose}
      onApprove={onApprove}
      featureName="001-user-auth"
      activePhaseState={basePhaseState}
      {...overrides}
    />
  );
  return { onClose, onApprove, ...utils };
}

describe('HumanReviewModal', () => {
  beforeEach(() => {
    installFetchMock();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('renders nothing when closed', () => {
    const { container } = render(
      <HumanReviewModal
        isOpen={false}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        featureName="001-user-auth"
        activePhaseState={basePhaseState}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the portal title and fetches git status on open', async () => {
    const fetchMock = installFetchMock();
    renderModal();

    expect(screen.getByText(/Human Audit Portal: 001-user-auth/)).toBeInTheDocument();
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/git?action=status')
    );
  });

  it('renders the modified files list (file tree) and auto-selects the first file', async () => {
    renderModal();

    // Both files show up by their basename.
    expect(await screen.findByText('index.ts')).toBeInTheDocument();
    expect(screen.getByText('README.md')).toBeInTheDocument();

    // Additions/deletions are rendered.
    expect(screen.getByText('+10')).toBeInTheDocument();
    expect(screen.getByText('-5')).toBeInTheDocument();

    // First file is auto-selected -> shown in the diff viewer header.
    expect(await screen.findByText('src/index.ts')).toBeInTheDocument();
  });

  it('loads the diff for the auto-selected file with +/- line highlighting', async () => {
    renderModal();

    const added = await screen.findByText('+added line');
    const removed = await screen.findByText('-removed line');
    expect(added).toHaveClass('text-green-600');
    expect(removed).toHaveClass('text-red-600');
  });

  it('fetches a new diff when a different file is selected', async () => {
    const fetchMock = installFetchMock();
    renderModal();

    const readmeItem = await screen.findByText('README.md');
    fireEvent.click(readmeItem);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('action=diff&file=README.md')
      )
    );
    expect(await screen.findByText('+new readme line')).toBeInTheDocument();
  });

  it('switches to the git history tab and shows commit log + branch', async () => {
    renderModal();
    await screen.findByText('index.ts'); // wait for initial load

    fireEvent.click(screen.getByRole('button', { name: 'Git Commit History' }));

    expect(await screen.findByText('add auth flow')).toBeInTheDocument();
    expect(screen.getByText('abc1234')).toBeInTheDocument();
    expect(screen.getByText(/Jane Dev/)).toBeInTheDocument();
    expect(screen.getByText('feature-auth')).toBeInTheDocument();
  });

  it('shows empty state when there are no modified files', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ branch: 'main', files: [], log: [] }),
        } as Response)
      )
    );
    renderModal();
    expect(await screen.findByText('No modified files found.')).toBeInTheDocument();
  });

  it('shows an error banner when the status payload reports an error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ error: 'Git repository not found in workspace.' }),
        } as Response)
      )
    );
    renderModal();
    expect(
      await screen.findByText('Git repository not found in workspace.')
    ).toBeInTheDocument();
  });

  it('invokes onApprove and onClose from the action buttons', async () => {
    const { onApprove, onClose } = renderModal();
    await screen.findByText('index.ts');

    fireEvent.click(screen.getByRole('button', { name: /Approve & Merge/ }));
    expect(onApprove).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Cancel Audit/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders persona audit badges from activePhaseState', async () => {
    renderModal({
      activePhaseState: {
        ...basePhaseState,
        personas: [
          { id: 'qa', status: 'passed' },
          { id: 'security', status: 'running' },
        ],
      },
    });
    // Each persona label appears both in the execution-time chart and the audit summary.
    expect((await screen.findAllByText('QA Agent')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Security Auditor').length).toBeGreaterThan(0);
  });

  // Regression: every zinc shade must be a real Tailwind shade. Non-standard
  // shades (e.g. zinc-850/650/350) compile to nothing — borders then fall back
  // to currentColor and the dark theme renders wrong. Tailwind's zinc palette is
  // 50,100,200,...,900,950 only.
  it('only uses valid Tailwind zinc shades (regression)', () => {
    const source = fs.readFileSync(path.join(__dirname, 'HumanReviewModal.tsx'), 'utf-8');
    const VALID = new Set(['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950']);
    const offenders = Array.from(source.matchAll(/zinc-(\d+)/g))
      .map((m) => m[1])
      .filter((shade) => !VALID.has(shade));
    expect(offenders).toEqual([]);
  });

  // Regression for the theming bug: the dashboard must be theme-aware
  // (light defaults + dark: overrides), not dark-only.
  it('uses theme-aware classes on the modal card (regression)', async () => {
    renderModal();
    const title = await screen.findByText(/Human Audit Portal/);
    // Walk up to the modal card and assert it carries both a light default
    // background and a dark: override.
    const card = title.closest('div.rounded-xl');
    expect(card).not.toBeNull();
    expect(card!.className).toContain('bg-white');
    expect(card!.className).toContain('dark:bg-zinc-950');
  });
});
