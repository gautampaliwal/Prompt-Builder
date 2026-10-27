import { useState } from 'react';
import { btn } from './styles';

export function CopyButton({ text, onCopied }: { text: string; onCopied?: () => void }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
      onCopied?.();
    } catch {
      setState('failed');
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void copy()}
        disabled={text === ''}
        className={btn.primary}
      >
        Copy
      </button>
      <span role="status" className="self-center text-sm text-slate-600 dark:text-slate-400">
        {state === 'copied' && 'Copied to clipboard.'}
        {state === 'failed' && 'Could not copy. Select the text and copy it manually.'}
      </span>
    </>
  );
}
