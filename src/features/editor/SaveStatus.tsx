import { btn } from '../../components/styles';
import type { Autosave } from './useAutosave';

const TEXT = {
  saved: 'All changes saved',
  pending: 'Unsaved changes',
  saving: 'Saving…',
} as const;

export function SaveStatus({ autosave }: { autosave: Autosave }) {
  const { state, error, flush } = autosave;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm" data-testid="save-status">
      <span
        role="status"
        className={
          state === 'error'
            ? 'font-medium text-red-700 dark:text-red-300'
            : 'text-slate-600 dark:text-slate-400'
        }
      >
        {state === 'error'
          ? `Couldn't save: ${error ?? 'unknown error'}. Your text is kept on this page.`
          : TEXT[state]}
      </span>
      {state === 'error' && (
        <button type="button" className={btn.secondary} onClick={() => void flush()}>
          Retry
        </button>
      )}
    </div>
  );
}
