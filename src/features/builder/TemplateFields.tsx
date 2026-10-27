import type { UseFormReturn } from 'react-hook-form';
import type { Issue } from '../../core/prompt-engine';
import type { Template } from '../../core/schema/template';
import type { FormValues } from './useTemplateForm';
import { VariableField } from './VariableField';

/** A form generated from a template's variables. Field errors appear once a field is touched. */
export function TemplateFields({
  template,
  form,
  issues,
}: {
  template: Template;
  form: UseFormReturn<FormValues>;
  issues: readonly Issue[];
}) {
  const { touchedFields } = form.formState;
  const fieldErrors = new Map<string, string>();
  for (const issue of issues) {
    if (issue.variable && issue.severity === 'error' && touchedFields[issue.variable]) {
      fieldErrors.set(issue.variable, issue.message);
    }
  }
  return (
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
          register={form.register}
          error={fieldErrors.get(v.name)}
        />
      ))}
    </form>
  );
}
