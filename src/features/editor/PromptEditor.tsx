import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useServices } from '../../app/services-context';
import { CopyButton } from '../../components/CopyButton';
import { FavoriteButton } from '../../components/FavoriteButton';
import { flash, LIBRARY_FLASH_KEY, promptFlashKey } from '../../components/flash';
import { categoryLabel, errorMessage, plural } from '../../components/format';
import { btn, field, label } from '../../components/styles';
import { estimateHeuristic } from '../../core/estimator/heuristic';
import { normalizeTags } from '../../core/library/fields';
import {
  PROMPT_TEXT_MAX,
  PROMPT_TITLE_MAX,
  type Prompt,
  type Version,
} from '../../core/schema/prompt';
import {
  TEMPLATE_CATEGORIES,
  type Template,
  type TemplateCategory,
} from '../../core/schema/template';
import { textStats } from '../../core/text-stats';
import type { PromptMetaPatch } from '../../services';
import { PromptPreview, TextStatsLine } from '../builder/PromptPreview';
import { TemplateFields } from '../builder/TemplateFields';
import { toFormValues, useTemplateForm } from '../builder/useTemplateForm';
import { RECOVERED_NOTICE, recovery, type DraftValue } from './recovery';
import { SaveStatus } from './SaveStatus';
import { useAutosave, type Autosave } from './useAutosave';
import { VersionHistory } from './VersionHistory';

export interface PromptEditorProps {
  prompt: Prompt;
  template: Template | undefined;
  autosaveDelayMs: number;
  /** Reload the prompt from storage and remount, showing `notice`. */
  onReload: (notice: string) => void;
  onDeleted: () => void;
  onDuplicated: (copy: Prompt) => void;
}

/**
 * Editor for a saved prompt. Template-bound prompts (with stored form values)
 * are edited through the template's form; others as plain text.
 */
export function PromptEditor(props: PromptEditorProps) {
  const { prompt, template } = props;
  return (
    <article aria-labelledby="page-title" className="space-y-6">
      <Link to="/library" className="text-sm text-indigo-700 hover:underline dark:text-indigo-300">
        ← Library
      </Link>
      <MetaHeader prompt={prompt} />
      {template && prompt.variableValues ? (
        <TemplateModeEditor {...props} template={template} />
      ) : (
        <>
          {prompt.variableValues && !template && (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950">
              This prompt's template isn't available, so you're editing its text directly.
            </p>
          )}
          <TextModeEditor {...props} />
        </>
      )}
    </article>
  );
}

function useRecovered(promptId: string) {
  const [recovered] = useState(() => recovery.peek(promptId));
  useEffect(() => recovery.clear(promptId), [promptId]);
  return recovered;
}

function TemplateModeEditor(props: PromptEditorProps & { template: Template }) {
  const { prompt, template, autosaveDelayMs } = props;
  const services = useServices();
  const recovered = useRecovered(prompt.id);
  const [initial] = useState(() =>
    toFormValues(template, recovered?.variableValues ?? prompt.variableValues),
  );
  const { form, values, result, stats, tokens } = useTemplateForm(template, initial);
  const value = useMemo<DraftValue>(
    () => ({ draft: result.text, variableValues: values }),
    [result.text, values],
  );
  const save = useCallback(
    (v: DraftValue) => services.prompts.saveDraft(prompt.id, v),
    [services, prompt.id],
  );
  const autosave = useAutosave(value, save, {
    delayMs: autosaveDelayMs,
    initiallyDirty: recovered !== null,
    onAbandon: (v) => recovery.keep(prompt.id, v),
  });

  return (
    <Workspace
      {...props}
      draft={result.text}
      autosave={autosave}
      canDetach
      recovered={recovered !== null}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <TemplateFields template={template} form={form} issues={result.issues} />
        <div className="lg:sticky lg:top-4 lg:self-start">
          <PromptPreview text={result.text} stats={stats} tokens={tokens} issues={result.issues} />
        </div>
      </div>
    </Workspace>
  );
}

function TextModeEditor(props: PromptEditorProps) {
  const { prompt, autosaveDelayMs } = props;
  const services = useServices();
  const recovered = useRecovered(prompt.id);
  const [draft, setDraft] = useState(() => recovered?.draft ?? prompt.draft);
  const value = useMemo<DraftValue>(() => ({ draft }), [draft]);
  const save = useCallback(
    (v: DraftValue) => services.prompts.saveDraft(prompt.id, v),
    [services, prompt.id],
  );
  const autosave = useAutosave(value, save, {
    delayMs: autosaveDelayMs,
    initiallyDirty: recovered !== null,
    onAbandon: (v) => recovery.keep(prompt.id, v),
  });
  const stats = useMemo(() => textStats(draft), [draft]);
  const tokens = useMemo(() => estimateHeuristic(draft), [draft]);

  return (
    <Workspace
      {...props}
      draft={draft}
      autosave={autosave}
      canDetach={false}
      recovered={recovered !== null}
    >
      <div className="space-y-2">
        <label htmlFor="prompt-text" className={label}>
          Prompt text
        </label>
        <textarea
          id="prompt-text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={14}
          maxLength={PROMPT_TEXT_MAX}
          className={`${field} font-mono`}
        />
        <TextStatsLine stats={stats} tokens={tokens} />
      </div>
    </Workspace>
  );
}

type Confirm =
  { kind: 'delete' } | { kind: 'detach' } | { kind: 'restore'; version: Version } | null;

type VersionsState = { token: number; list: Version[] } | { token: number; error: string } | null;

function Workspace({
  prompt,
  draft,
  autosave,
  canDetach,
  recovered,
  children,
  onReload,
  onDeleted,
  onDuplicated,
}: PromptEditorProps & {
  draft: string;
  autosave: Autosave;
  canDetach: boolean;
  recovered: boolean;
  children: ReactNode;
}) {
  const services = useServices();
  const [notice, setNotice] = useState(
    () => flash.peek(promptFlashKey(prompt.id)) ?? (recovered ? RECOVERED_NOTICE : null),
  );
  useEffect(() => flash.clear(promptFlashKey(prompt.id)), [prompt.id]);

  const [versionsToken, setVersionsToken] = useState(0);
  const [versions, setVersions] = useState<VersionsState>(null);
  useEffect(() => {
    let cancelled = false;
    services.prompts.listVersions(prompt.id).then(
      (list) => !cancelled && setVersions({ token: versionsToken, list }),
      (e: unknown) => !cancelled && setVersions({ token: versionsToken, error: errorMessage(e) }),
    );
    return () => {
      cancelled = true;
    };
  }, [services, prompt.id, versionsToken]);

  const list = versions && 'list' in versions ? versions.list : null;
  const latest = list?.at(-1);
  const unchanged = latest !== undefined && latest.text === draft;
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);

  async function act(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch (e) {
      setNotice(`Something went wrong: ${errorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  }

  /** Writes pending edits first so every action works on what's on screen. */
  async function flushFirst(): Promise<boolean> {
    const ok = await autosave.flush();
    if (!ok)
      setNotice("Your latest changes aren't saved yet, so nothing else was changed. Use Retry.");
    return ok;
  }

  const saveVersion = () =>
    act(async () => {
      if (!(await flushFirst())) return;
      const v = await services.prompts.saveVersion(prompt.id);
      setNotice(v ? `Saved version ${v.number}.` : 'No changes since the last version.');
      if (v) setVersionsToken((t) => t + 1);
    });

  const restore = (version: Version) =>
    act(async () => {
      if (!(await flushFirst())) return;
      const r = await services.prompts.restoreVersion(prompt.id, version.number);
      onReload(
        r.restored
          ? `Restored v${version.number} as version ${r.restored.number}.` +
              (r.savedDraft
                ? ` Your unsaved changes were kept as version ${r.savedDraft.number}.`
                : '')
          : `This prompt already has v${version.number}'s text.`,
      );
    });

  const detach = () =>
    act(async () => {
      if (!(await flushFirst())) return;
      await services.prompts.detachFromTemplate(prompt.id);
      onReload('Converted to plain text. Earlier versions keep their form values.');
    });

  const duplicate = () =>
    act(async () => {
      if (!(await flushFirst())) return;
      const copy = await services.prompts.duplicate(prompt.id);
      flash.set(promptFlashKey(copy.id), "Duplicated. You're editing the copy.");
      onDuplicated(copy);
    });

  const remove = () =>
    act(async () => {
      await services.prompts.remove(prompt.id);
      recovery.clear(prompt.id);
      flash.set(LIBRARY_FLASH_KEY, 'Prompt deleted.');
      onDeleted();
    });

  const confirmText =
    confirm?.kind === 'delete'
      ? `Delete this prompt and all ${list ? plural(list.length, 'version') : 'its versions'}? This can't be undone.`
      : confirm?.kind === 'detach'
        ? "Convert to plain text? You'll edit the text directly instead of the form. Earlier versions keep their form values, and restoring one brings the form back."
        : confirm?.kind === 'restore'
          ? `Restore v${confirm.version.number}? It becomes a new version, so nothing is lost.` +
            (latest && latest.text !== draft
              ? ' Your unsaved changes are kept as a version first.'
              : '') +
            (canDetach && !confirm.version.variableValues
              ? ' That version was edited as plain text, so the prompt switches to text editing.'
              : '')
          : '';

  function runConfirmed() {
    const c = confirm;
    setConfirm(null);
    if (c?.kind === 'delete') void remove();
    else if (c?.kind === 'detach') void detach();
    else if (c?.kind === 'restore') void restore(c.version);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <SaveStatus autosave={autosave} />
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <CopyButton
              text={draft}
              onCopied={() => void services.prompts.markUsed(prompt.id).catch(() => undefined)}
            />
            <button
              type="button"
              className={btn.secondary}
              onClick={() => void saveVersion()}
              disabled={busy || unchanged}
              title={latest && unchanged ? `No changes since v${latest.number}` : undefined}
            >
              Save version
            </button>
            <button
              type="button"
              className={btn.secondary}
              onClick={() => void duplicate()}
              disabled={busy}
            >
              Duplicate
            </button>
            {canDetach && (
              <button
                type="button"
                className={btn.secondary}
                onClick={() => setConfirm({ kind: 'detach' })}
                disabled={busy}
              >
                Convert to plain text
              </button>
            )}
            <button
              type="button"
              className={btn.danger}
              onClick={() => setConfirm({ kind: 'delete' })}
              disabled={busy}
            >
              Delete
            </button>
          </div>
        </div>
        {notice && (
          <p role="status" className="text-sm text-slate-700 dark:text-slate-300">
            {notice}
          </p>
        )}
        {confirm && (
          <div
            role="alertdialog"
            aria-labelledby="confirm-text"
            className="rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950"
          >
            <p id="confirm-text" className="text-sm">
              {confirmText}
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className={confirm.kind === 'delete' ? btn.dangerSolid : btn.primary}
                onClick={runConfirmed}
              >
                {confirm.kind === 'delete'
                  ? 'Delete prompt'
                  : confirm.kind === 'detach'
                    ? 'Convert'
                    : `Restore v${confirm.version.number}`}
              </button>
              <button
                type="button"
                className={btn.secondary}
                onClick={() => setConfirm(null)}
                autoFocus
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {children}

      {versions === null ? (
        <p className="text-sm text-slate-500">Loading history…</p>
      ) : 'error' in versions ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          Couldn't load version history: {versions.error}{' '}
          <button
            type="button"
            className="underline"
            onClick={() => setVersionsToken((t) => t + 1)}
          >
            Try again
          </button>
        </p>
      ) : (
        <VersionHistory
          key={versions.list.length}
          versions={versions.list}
          draft={draft}
          busy={busy}
          onRestore={(version) => setConfirm({ kind: 'restore', version })}
        />
      )}
    </div>
  );
}

function MetaHeader({ prompt }: { prompt: Prompt }) {
  const services = useServices();
  const [saved, setSaved] = useState(prompt);
  const [title, setTitle] = useState(prompt.title);
  const [tags, setTags] = useState(prompt.tags.join(', '));
  const [error, setError] = useState<string | null>(null);

  async function commit(patch: PromptMetaPatch) {
    try {
      const next = await services.prompts.updateMeta(prompt.id, patch);
      setSaved(next);
      setTitle(next.title);
      setTags(next.tags.join(', '));
      setError(null);
    } catch (e) {
      setError(`Couldn't save: ${errorMessage(e)}`);
    }
  }

  function commitTitle() {
    const t = title.trim();
    if (t === saved.title) return setTitle(saved.title);
    if (!t) {
      setTitle(saved.title);
      return setError('A title is required, so the previous one was kept.');
    }
    void commit({ title: t });
  }

  function commitTags() {
    if (normalizeTags(tags).join('\n') === saved.tags.join('\n'))
      return setTags(saved.tags.join(', '));
    void commit({ tags });
  }

  return (
    <header className="space-y-3">
      <h1 id="page-title" className="sr-only">
        Edit prompt: {saved.title}
      </h1>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <label htmlFor="prompt-title" className="sr-only">
            Title
          </label>
          <input
            id="prompt-title"
            value={title}
            maxLength={PROMPT_TITLE_MAX}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-2xl font-semibold hover:border-slate-300 focus:border-indigo-500 dark:hover:border-slate-700"
          />
        </div>
        <FavoriteButton
          favorite={saved.favorite}
          label="Favorite"
          onToggle={() => void commit({ favorite: !saved.favorite })}
        />
      </div>
      <div className="flex flex-wrap gap-4 px-2">
        <div className="space-y-1">
          <label htmlFor="prompt-category" className={label}>
            Category
          </label>
          <select
            id="prompt-category"
            value={saved.category}
            onChange={(e) => void commit({ category: e.target.value as TemplateCategory })}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            {TEMPLATE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {categoryLabel(c)}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-60 flex-1 space-y-1">
          <label htmlFor="prompt-tags" className={label}>
            Tags <span className="font-normal text-slate-500">(comma-separated)</span>
          </label>
          <input
            id="prompt-tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            onBlur={commitTags}
            placeholder="e.g. work, email"
            className={field}
          />
        </div>
      </div>
      {error && (
        <p role="alert" className="px-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </header>
  );
}
