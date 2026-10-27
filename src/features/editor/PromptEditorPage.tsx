import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useServices } from '../../app/services-context';
import { flash, promptFlashKey } from '../../components/flash';
import { errorMessage } from '../../components/format';
import { btn } from '../../components/styles';
import type { Prompt } from '../../core/schema/prompt';
import { PromptEditor } from './PromptEditor';
import { AUTOSAVE_DELAY_MS } from './useAutosave';

type Load = { id: string; token: number } & ({ prompt: Prompt | null } | { error: string });

/** Route `/prompts/:id`: loads a saved prompt and hosts its editor. */
export function PromptEditorPage({
  autosaveDelayMs = AUTOSAVE_DELAY_MS,
}: {
  autosaveDelayMs?: number;
}) {
  const { id = '' } = useParams();
  const services = useServices();
  const navigate = useNavigate();
  const [token, setToken] = useState(0);
  const [load, setLoad] = useState<Load | null>(null);

  useEffect(() => {
    let cancelled = false;
    services.prompts.get(id).then(
      (prompt) => !cancelled && setLoad({ id, token, prompt: prompt ?? null }),
      (e: unknown) => !cancelled && setLoad({ id, token, error: errorMessage(e) }),
    );
    return () => {
      cancelled = true;
    };
  }, [services, id, token]);

  const current = load && load.id === id ? load : null;

  if (!current) {
    return (
      <p role="status" className="text-slate-600 dark:text-slate-400">
        Loading prompt…
      </p>
    );
  }
  if ('error' in current) {
    return (
      <section aria-labelledby="page-title" className="space-y-3">
        <h1 id="page-title" className="text-2xl font-semibold">
          Couldn't open this prompt
        </h1>
        <p className="text-sm">{current.error}</p>
        <button type="button" className={btn.secondary} onClick={() => setToken((t) => t + 1)}>
          Try again
        </button>
      </section>
    );
  }
  if (!current.prompt) {
    return (
      <section aria-labelledby="page-title" className="space-y-3">
        <h1 id="page-title" className="text-2xl font-semibold">
          Prompt not found
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">It may have been deleted.</p>
        <Link to="/library" className={btn.secondary}>
          Back to the Library
        </Link>
      </section>
    );
  }

  const prompt = current.prompt;
  const template = prompt.sourceTemplateId
    ? services.templates.get(prompt.sourceTemplateId)
    : undefined;
  return (
    <PromptEditor
      // Remount after a reload (restore, convert) so editors start from stored state.
      key={`${prompt.id}:${current.token}`}
      prompt={prompt}
      template={template}
      autosaveDelayMs={autosaveDelayMs}
      onReload={(notice) => {
        flash.set(promptFlashKey(prompt.id), notice);
        setToken((t) => t + 1);
      }}
      onDeleted={() => void navigate('/library')}
      onDuplicated={(copy) => void navigate(`/prompts/${copy.id}`)}
    />
  );
}
