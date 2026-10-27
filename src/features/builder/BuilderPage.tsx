import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { estimateHeuristic } from '../../core/estimator/heuristic';
import { defaultValues, hasErrors, render, type Issue } from '../../core/prompt-engine';
import type { Template } from '../../core/schema/template';
import { textStats } from '../../core/text-stats';
import { BUILT_IN_TEMPLATES, DEFAULT_TEMPLATE_ID } from '../../data/templates';
import { VariableField, type FormValues } from './VariableField';

function toFormValues(template: Template): FormValues {
  const values: FormValues = {};
  for (const [k, v] of Object.entries(defaultValues(template)))
    values[k] = v === undefined ? '' : String(v);
  return values;
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
          <label htmlFor="template-picker" className="block text-sm font-medium">
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
        // Remount on template change so the form starts from that template's defaults.
        <BuilderForm key={template.id} template={template} />
      ) : (
        <p>No templates available.</p>
      )}
    </section>
  );
}

type CopyState = 'idle' | 'copied' | 'failed';

function BuilderForm({ template }: { template: Template }) {
  const { register, control, formState } = useForm<FormValues>({
    defaultValues: toFormValues(template),
    mode: 'onTouched',
  });
  const values = useWatch({ control }) as FormValues;
  const { touchedFields } = formState;

  const result = useMemo(() => render(template, values), [template, values]);
  const stats = useMemo(() => textStats(result.text), [result.text]);
  const tokens = useMemo(() => estimateHeuristic(result.text), [result.text]);
  const [copyState, setCopyState] = useState<CopyState>('idle');

  const fieldErrors = new Map<string, string>();
  for (const issue of result.issues) {
    if (issue.variable && issue.severity === 'error' && touchedFields[issue.variable]) {
      fieldErrors.set(issue.variable, issue.message);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(result.text);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form
        aria-label={`${template.name} fields`}
        className="space-y-4"
        onSubmit={(e) => e.preventDefault()}
        noValidate
      >
        {template.description && (
          <p className="text-sm text-slate-600 dark:text-slate-400">{template.description}</p>
        )}
        {template.variables.map((v) => (
          <VariableField
            key={v.name}
            variable={v}
            register={register}
            error={fieldErrors.get(v.name)}
          />
        ))}
      </form>

      <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <section aria-labelledby="preview-title" className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="preview-title" className="text-lg font-semibold">
              Preview
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void copy()}
                disabled={result.text === ''}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Copy
              </button>
              <button
                type="button"
                disabled
                title="Saving arrives with the Library (M2)"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700"
              >
                Save
              </button>
              <button
                type="button"
                disabled
                title="The optimizer arrives in M3"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700"
              >
                Optimize
              </button>
            </div>
          </div>
          <pre
            data-testid="prompt-preview"
            tabIndex={0}
            aria-label="Rendered prompt"
            className="min-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md border border-slate-200 bg-slate-50 p-4 font-mono text-sm dark:border-slate-800 dark:bg-slate-900"
          >
            {result.text || (
              <span className="font-sans text-slate-500">Your prompt will appear here.</span>
            )}
          </pre>
          <p data-testid="prompt-stats" className="text-sm text-slate-600 dark:text-slate-400">
            {stats.characters.toLocaleString()} characters · {stats.words.toLocaleString()} words ·
            ≈ {tokens.count.toLocaleString()} tokens{' '}
            <span className="text-slate-500">(approximate)</span>
          </p>
          <p className="text-xs text-slate-500">{tokens.method}. Real counts vary by model.</p>
          <p role="status" className="text-sm">
            {copyState === 'copied' && 'Copied to clipboard.'}
            {copyState === 'failed' &&
              'Could not copy. Select the preview text and copy it manually.'}
          </p>
        </section>

        <IssuesPanel issues={result.issues} />
      </div>
    </div>
  );
}

function IssuesPanel({ issues }: { issues: Issue[] }) {
  if (issues.length === 0) {
    return (
      <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
        No issues found.
      </p>
    );
  }
  const errors = hasErrors(issues);
  return (
    <section
      aria-labelledby="issues-title"
      className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950"
    >
      <h2 id="issues-title" className="text-sm font-semibold">
        {errors ? 'Needs attention' : 'Warnings'} ({issues.length})
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
