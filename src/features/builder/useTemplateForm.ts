import { useMemo } from 'react';
import { useForm, useWatch, type UseFormReturn } from 'react-hook-form';
import { estimateHeuristic } from '../../core/estimator/heuristic';
import type { TokenEstimate } from '../../core/estimator/tokenizer';
import { defaultValues, render, type RenderResult } from '../../core/prompt-engine';
import type { Template, VariableValues } from '../../core/schema/template';
import { textStats, type TextStats } from '../../core/text-stats';

/** Form field values, all as strings (as the inputs hold them). */
export type FormValues = Record<string, string>;

/** Form values for a template: stored values where present, otherwise each variable's default. */
export function toFormValues(template: Template, stored?: VariableValues): FormValues {
  const defaults = defaultValues(template);
  const out: FormValues = {};
  for (const v of template.variables) {
    const value = stored?.[v.name] ?? defaults[v.name];
    out[v.name] = value === undefined ? '' : String(value);
  }
  return out;
}

export interface TemplateFormState {
  form: UseFormReturn<FormValues>;
  values: FormValues;
  result: RenderResult;
  stats: TextStats;
  tokens: TokenEstimate;
}

/** Form state for a template plus its live render, stats and token estimate. */
export function useTemplateForm(template: Template, initialValues?: FormValues): TemplateFormState {
  const form = useForm<FormValues>({
    defaultValues: initialValues ?? toFormValues(template),
    mode: 'onTouched',
  });
  const values = useWatch({ control: form.control }) as FormValues;
  const result = useMemo(() => render(template, values), [template, values]);
  const stats = useMemo(() => textStats(result.text), [result.text]);
  const tokens = useMemo(() => estimateHeuristic(result.text), [result.text]);
  return { form, values, result, stats, tokens };
}
