import { useMemo, useState } from 'react';
import { formatDateTime, plural } from '../../components/format';
import { diffCounts, diffLines, withContext, type DiffOp } from '../../core/diff/line-diff';
import type { Version, VersionOrigin } from '../../core/schema/prompt';

const ORIGIN_LABEL: Record<VersionOrigin, string> = {
  manual: 'Saved',
  optimizer: 'Optimizer',
  import: 'Imported',
  restore: 'Restored',
};

const DRAFT = 'draft';
const selectClass =
  'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900';

/**
 * Version list with restore, plus a line diff between any two versions or the
 * current draft. Remount (via `key`) when the version count changes to reset
 * the comparison to the newest pair.
 */
export function VersionHistory({
  versions,
  draft,
  busy,
  onRestore,
}: {
  versions: readonly Version[];
  draft: string;
  busy: boolean;
  onRestore: (version: Version) => void;
}) {
  const latest = versions.at(-1);
  const previous = versions.at(-2);
  const [from, setFrom] = useState(() => String((previous ?? latest)?.number ?? DRAFT));
  const [to, setTo] = useState(() => (previous && latest ? String(latest.number) : DRAFT));

  const textOf = (sel: string) =>
    sel === DRAFT ? draft : (versions.find((v) => String(v.number) === sel)?.text ?? '');
  const fromText = textOf(from);
  const toText = textOf(to);
  const ops = useMemo(() => diffLines(fromText, toText), [fromText, toText]);

  const options = [
    <option key={DRAFT} value={DRAFT}>
      Current draft
    </option>,
    ...[...versions].reverse().map((v) => (
      <option key={v.id} value={String(v.number)}>
        v{v.number} · {formatDateTime(v.createdAt)}
      </option>
    )),
  ];

  return (
    <section aria-labelledby="history-title" className="space-y-4">
      <h2 id="history-title" className="text-lg font-semibold">
        Version history{' '}
        <span className="text-sm font-normal text-slate-500">
          ({plural(versions.length, 'version')})
        </span>
      </h2>

      <ol className="divide-y divide-slate-200 rounded-md border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
        {[...versions].reverse().map((v) => {
          const isCurrent = v === latest && v.text === draft;
          return (
            <li
              key={v.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm"
            >
              <span className="font-semibold">v{v.number}</span>
              <time dateTime={v.createdAt} className="text-slate-600 dark:text-slate-400">
                {formatDateTime(v.createdAt)}
              </time>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-800">
                {ORIGIN_LABEL[v.origin]}
              </span>
              {v.changeNote && (
                <span className="text-slate-600 dark:text-slate-400">{v.changeNote}</span>
              )}
              {isCurrent ? (
                <span className="ml-auto text-xs text-slate-500">Current</span>
              ) : (
                <button
                  type="button"
                  className="ml-auto rounded px-2 py-1 text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 dark:text-indigo-300 dark:hover:bg-indigo-950"
                  onClick={() => onRestore(v)}
                  disabled={busy}
                  aria-label={`Restore version ${v.number}`}
                >
                  Restore
                </button>
              )}
            </li>
          );
        })}
      </ol>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Compare</h3>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label htmlFor="compare-from" className="block text-xs font-medium">
              From
            </label>
            <select
              id="compare-from"
              className={selectClass}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            >
              {options}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="compare-to" className="block text-xs font-medium">
              To
            </label>
            <select
              id="compare-to"
              className={selectClass}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            >
              {options}
            </select>
          </div>
        </div>
        <DiffView ops={ops} />
      </div>
    </section>
  );
}

export function DiffView({ ops }: { ops: readonly DiffOp[] }) {
  const { added, removed } = diffCounts(ops);
  if (added === 0 && removed === 0) {
    return <p className="text-sm text-slate-600 dark:text-slate-400">No differences.</p>;
  }
  return (
    <div className="space-y-1">
      <p className="text-sm text-slate-600 dark:text-slate-400" data-testid="diff-summary">
        {plural(added, 'line')} added · {plural(removed, 'line')} removed
      </p>
      <div className="overflow-auto rounded-md border border-slate-200 font-mono text-sm dark:border-slate-800">
        {withContext(ops).map((row, i) =>
          row.type === 'skip' ? (
            <div key={i} className="bg-slate-50 px-3 py-1 text-xs text-slate-500 dark:bg-slate-900">
              … {plural(row.count, 'unchanged line')}
            </div>
          ) : (
            <div
              key={i}
              className={`whitespace-pre-wrap break-words px-3 ${
                row.type === 'add'
                  ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100'
                  : row.type === 'del'
                    ? 'bg-red-50 text-red-900 line-through decoration-red-400/60 dark:bg-red-950 dark:text-red-100'
                    : ''
              }`}
            >
              <span aria-hidden="true" className="mr-2 select-none text-slate-400">
                {row.type === 'add' ? '+' : row.type === 'del' ? '−' : ' '}
              </span>
              <span className="sr-only">
                {row.type === 'add' ? 'Added: ' : row.type === 'del' ? 'Removed: ' : ''}
              </span>
              {row.text || ' '}
            </div>
          ),
        )}
      </div>
    </div>
  );
}
