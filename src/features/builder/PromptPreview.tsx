import type { ReactNode } from 'react';
import type { TokenEstimate } from '../../core/estimator/tokenizer';
import { hasErrors, type Issue } from '../../core/prompt-engine';
import type { TextStats } from '../../core/text-stats';

export function TextStatsLine({ stats, tokens }: { stats: TextStats; tokens: TokenEstimate }) {
  return (
    <>
      <p data-testid="prompt-stats" className="text-sm text-slate-600 dark:text-slate-400">
        {stats.characters.toLocaleString()} characters · {stats.words.toLocaleString()} words · ≈{' '}
        {tokens.count.toLocaleString()} tokens{' '}
        <span className="text-slate-500">{tokens.approximate ? '(approximate)' : ''}</span>
      </p>
      <p className="text-xs text-slate-500">{tokens.method}. Real counts vary by model.</p>
    </>
  );
}

export function PromptPreview({
  text,
  stats,
  tokens,
  issues,
  actions,
}: {
  text: string;
  stats: TextStats;
  tokens: TokenEstimate;
  issues: readonly Issue[];
  actions?: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <section aria-labelledby="preview-title" className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="preview-title" className="text-lg font-semibold">
            Preview
          </h2>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        <pre
          data-testid="prompt-preview"
          tabIndex={0}
          aria-label="Rendered prompt"
          className="min-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md border border-slate-200 bg-slate-50 p-4 font-mono text-sm dark:border-slate-800 dark:bg-slate-900"
        >
          {text || <span className="font-sans text-slate-500">Your prompt will appear here.</span>}
        </pre>
        <TextStatsLine stats={stats} tokens={tokens} />
      </section>
      <IssuesPanel issues={issues} />
    </div>
  );
}

export function IssuesPanel({ issues }: { issues: readonly Issue[] }) {
  if (issues.length === 0) {
    return (
      <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
        No issues found.
      </p>
    );
  }
  return (
    <section
      aria-labelledby="issues-title"
      className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950"
    >
      <h2 id="issues-title" className="text-sm font-semibold">
        {hasErrors(issues) ? 'Needs attention' : 'Warnings'} ({issues.length})
      </h2>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
        {issues.map((i, n) => (
          <li key={`${i.code}-${i.variable ?? i.sectionId ?? n}`}>
            <span className="sr-only">{i.severity}: </span>
            {i.message}
          </li>
        ))}
      </ul>
    </section>
  );
}
