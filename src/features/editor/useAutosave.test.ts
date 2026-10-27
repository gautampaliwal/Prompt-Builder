import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutosave } from './useAutosave';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const ok = () => vi.fn((_v: string) => Promise.resolve());

function setup(save: (v: string) => Promise<unknown>, onAbandon?: (v: string) => void) {
  return renderHook(({ v }) => useAutosave(v, save, { delayMs: 800, onAbandon }), {
    initialProps: { v: 'a' },
  });
}

describe('useAutosave', () => {
  it('starts saved and debounces changes into one save of the latest value', async () => {
    const save = ok();
    const { result, rerender } = setup(save);
    expect(result.current.state).toBe('saved');

    rerender({ v: 'b' });
    rerender({ v: 'c' });
    expect(result.current.state).toBe('pending');

    await act(() => vi.advanceTimersByTimeAsync(799));
    expect(save).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('c');
    expect(result.current.state).toBe('saved');
  });

  it('does not save when the value returns to what was saved', async () => {
    const save = ok();
    const { result, rerender } = setup(save);
    rerender({ v: 'b' });
    rerender({ v: 'a' });
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(save).not.toHaveBeenCalled();
    expect(result.current.state).toBe('saved');
  });

  it('keeps the value on failure, reports the error, and saves it on retry', async () => {
    const save = vi
      .fn((_v: string) => Promise.resolve())
      .mockRejectedValueOnce(new Error('QuotaExceededError'));
    const { result, rerender } = setup(save);
    rerender({ v: 'important' });
    await act(() => vi.advanceTimersByTimeAsync(800));
    expect(result.current.state).toBe('error');
    expect(result.current.error).toBe('QuotaExceededError');

    let retried = false;
    await act(async () => {
      retried = await result.current.flush();
    });
    expect(retried).toBe(true);
    expect(save).toHaveBeenLastCalledWith('important');
    expect(result.current.state).toBe('saved');
    expect(result.current.error).toBeNull();
  });

  it('flush saves immediately without waiting for the delay', async () => {
    const save = ok();
    const { result, rerender } = setup(save);
    rerender({ v: 'b' });
    await act(async () => {
      await result.current.flush();
    });
    expect(save).toHaveBeenCalledWith('b');
    expect(result.current.state).toBe('saved');
  });

  it('flushes pending changes on unmount and reports a failed final save', async () => {
    const save = vi.fn((_v: string) => Promise.reject(new Error('disk full')));
    const onAbandon = vi.fn();
    const { rerender, unmount } = setup(save, onAbandon);
    rerender({ v: 'last words' });
    unmount();
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(save).toHaveBeenCalledWith('last words');
    expect(onAbandon).toHaveBeenCalledWith('last words');
  });

  it('asks before the page unloads only while there are unsaved changes', async () => {
    const save = ok();
    const { rerender } = setup(save);
    const unload = () => {
      const e = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(e);
      return e.defaultPrevented;
    };
    expect(unload()).toBe(false);
    rerender({ v: 'b' });
    expect(unload()).toBe(true);
    await act(() => vi.advanceTimersByTimeAsync(800));
    expect(unload()).toBe(false);
  });

  it('treats a recovered initial value as unsaved', async () => {
    const save = ok();
    const { result } = renderHook(() =>
      useAutosave('recovered', save, { delayMs: 800, initiallyDirty: true }),
    );
    expect(result.current.state).toBe('pending');
    await act(() => vi.advanceTimersByTimeAsync(800));
    expect(save).toHaveBeenCalledWith('recovered');
  });
});
