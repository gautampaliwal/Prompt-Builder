import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { errorMessage } from '../../components/format';
import { useBeforeUnload } from '../../components/useBeforeUnload';

export const AUTOSAVE_DELAY_MS = 800;

export type SaveState = 'saved' | 'pending' | 'saving' | 'error';

export interface Autosave {
  state: SaveState;
  error: string | null;
  /** Saves now if there are unsaved changes. Resolves false if the save failed. */
  flush: () => Promise<boolean>;
}

export interface AutosaveOptions<T> {
  delayMs?: number;
  /** Treat the initial value as unsaved (e.g. recovered changes). */
  initiallyDirty?: boolean;
  /** Called with the value if the final save on unmount fails, so it can be recovered. */
  onAbandon?: (value: T) => void;
}

/**
 * Debounced autosave (brief §6). Saves run one at a time, newest value last.
 * On failure the value stays in memory, the state becomes `error`, and the
 * next change or `flush()` retries. Leaving the page with unsaved changes asks
 * for confirmation; unmounting flushes, and reports the value via `onAbandon`
 * if that last save fails.
 */
export function useAutosave<T>(
  value: T,
  save: (value: T) => Promise<unknown>,
  { delayMs = AUTOSAVE_DELAY_MS, initiallyDirty = false, onAbandon }: AutosaveOptions<T> = {},
): Autosave {
  const key = useMemo(() => JSON.stringify(value), [value]);
  const [savedKey, setSavedKey] = useState(() => (initiallyDirty ? null : key));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const latest = useRef({ value, key, save, onAbandon });
  const savedKeyRef = useRef(initiallyDirty ? null : key);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    latest.current = { value, key, save, onAbandon };
  });

  const run = useCallback((abandoning: boolean): Promise<boolean> => {
    const attempt = async (): Promise<boolean> => {
      const current = latest.current;
      if (current.key === savedKeyRef.current) return true;
      setSaving(true);
      try {
        await current.save(current.value);
        savedKeyRef.current = current.key;
        setSavedKey(current.key);
        setError(null);
        return true;
      } catch (e) {
        setError(errorMessage(e));
        if (abandoning) current.onAbandon?.(current.value);
        return false;
      } finally {
        setSaving(false);
      }
    };
    const result = queue.current.then(attempt, attempt);
    queue.current = result.catch(() => undefined);
    return result;
  }, []);

  const flush = useCallback(() => run(false), [run]);

  useEffect(() => {
    if (key === savedKeyRef.current) return;
    const timer = setTimeout(() => void run(false), delayMs);
    return () => clearTimeout(timer);
  }, [key, delayMs, run]);

  useEffect(() => () => void run(true), [run]);

  const dirty = key !== savedKey;
  useBeforeUnload(dirty || saving);

  const state: SaveState = saving
    ? 'saving'
    : error !== null && dirty
      ? 'error'
      : dirty
        ? 'pending'
        : 'saved';
  return { state, error, flush };
}
