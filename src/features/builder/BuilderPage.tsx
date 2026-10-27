import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useServices } from '../../app/services-context';
import { CopyButton } from '../../components/CopyButton';
import { flash, promptFlashKey } from '../../components/flash';
import { errorMessage } from '../../components/format';
import { btn, field, label } from '../../components/styles';
import { useBeforeUnload } from '../../components/useBeforeUnload';
import { deriveTitle } from '../../core/library/fields';
import { PROMPT_TITLE_MAX } from '../../core/schema/prompt';
import type { Template } from '../../core/schema/template';
import { BUILT_IN_TEMPLATES, DEFAULT_TEMPLATE_ID } from '../../data/templates';
import { PromptPreview } from './PromptPreview';
import { TemplateFields } from './TemplateFields';
import { toFormValues, useTemplateForm, type FormValues } from './useTemplateForm';

/**
 * In-progress Builder input per template, kept in memory for the session so
 * moving between screens doesn't lose it. A page reload asks first (beforeunload).
 */
const scratch = new Map<string, FormValues>();

export function clearBuilderScratch() {
  scratch.clear();
}

export function BuilderPage({
  templates = BUILT_IN_TEMPLATES,
}: {
  templates?: readonly Template[];
}) {
  const [templateId, setTemplateId] = useState(
    templates.some((t) => t.id === DEFAULT_TEMPLATE_ID) ? DEFAULT_TEMPLATE_ID : templates[0]?.id,
  );
  const template = templates.find((t) => t.id === templateId);

  return (
    <section aria-labelledby="page-title" className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 id="page-title" className="text-2xl font-semibold">
            Builder
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Fill in the fields; the prompt updates as you type. Nothing leaves your browser.
          </p>
        </div>
        <div className="space-y-1">
          <label htmlFor="template-picker" className={label}>
            Template
          </label>
          <select
            id="template-picker"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </header>
      {template ? (
        // Remount on template change so the form starts from that template's values.
        <BuilderForm key={template.id} template={template} />
      ) : (
        <p>No templates available.</p>
      )}
    </section>
  );
}

interface SaveDraft {
  title: string;
  busy: boolean;
  error: string | null;
}

function BuilderForm({ template }: { template: Template }) {
  const services = useServices();
  const navigate = useNavigate();
  const { form, values, result, stats, tokens } = useTemplateForm(
    template,
    scratch.get(template.id),
  );
  const pristine = useMemo(() => JSON.stringify(toFormValues(template)), [template]);
  const dirty = JSON.stringify(values) !== pristine;
  const [saveDraft, setSaveDraft] = useState<SaveDraft | null>(null);

  useEffect(() => {
    if (dirty) scratch.set(template.id, values);
    else scratch.delete(template.id);
  }, [template.id, values, dirty]);
  useBeforeUnload(dirty);

  function suggestedTitle(): string {
    const first = template.variables.find(
      (v) => v.required && (values[v.name] ?? '').trim() !== '',
    );
    return deriveTitle(first ? (values[first.name] ?? '') : result.text);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!saveDraft) return;
    const title = saveDraft.title.trim();
    if (!title) {
      setSaveDraft({ ...saveDraft, error: 'Give the prompt a title.' });
      return;
    }
    setSaveDraft({ title, busy: true, error: null });
    try {
      const prompt = await services.prompts.create({
        title,
        text: result.text,
        category: template.category,
        sourceTemplateId: template.id,
        variableValues: values,
      });
      scratch.delete(template.id);
      flash.set(promptFlashKey(prompt.id), 'Saved as version 1.');
      void navigate(`/prompts/${prompt.id}`);
    } catch (err) {
      setSaveDraft({
        title,
        busy: false,
        error: `Couldn't save: ${errorMessage(err)}. Your input is still here.`,
      });
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <TemplateFields template={template} form={form} issues={result.issues} />

      <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        {saveDraft && (
          <form
            onSubmit={(e) => void save(e)}
            aria-label="Save prompt"
            className="space-y-2 rounded-md border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-900 dark:bg-indigo-950"
          >
            <label htmlFor="save-title" className={label}>
              Title
            </label>
            <input
              id="save-title"
              className={field}
              value={saveDraft.title}
              maxLength={PROMPT_TITLE_MAX}
              onChange={(e) => setSaveDraft({ ...saveDraft, title: e.target.value, error: null })}
              autoFocus
            />
            {saveDraft.error && (
              <p role="alert" className="text-sm text-red-700 dark:text-red-300">
                {saveDraft.error}
              </p>
            )}
            <div className="flex gap-2">
              <button type="submit" className={btn.primary} disabled={saveDraft.busy}>
                {saveDraft.busy ? 'Saving…' : 'Save prompt'}
              </button>
              <button type="button" className={btn.secondary} onClick={() => setSaveDraft(null)}>
                Cancel
              </button>
            </div>
          </form>
        )}
        <PromptPreview
          text={result.text}
          stats={stats}
          tokens={tokens}
          issues={result.issues}
          actions={
            <>
              <CopyButton text={result.text} />
              <button
                type="button"
                className={btn.secondary}
                disabled={result.text === '' || saveDraft !== null}
                onClick={() => setSaveDraft({ title: suggestedTitle(), busy: false, error: null })}
              >
                Save
              </button>
              <button
                type="button"
                disabled
                title="The optimizer arrives in M3"
                className={btn.secondary}
              >
                Optimize
              </button>
            </>
          }
        />
      </div>
    </div>
  );
}
