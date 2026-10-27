import type { UseFormRegister } from 'react-hook-form';
import { field as inputClass } from '../../components/styles';
import type { Variable } from '../../core/schema/template';
import type { FormValues } from './useTemplateForm';

interface Props {
  variable: Variable;
  register: UseFormRegister<FormValues>;
  error?: string | undefined;
}

export function VariableField({ variable: v, register, error }: Props) {
  const id = `var-${v.name}`;
  const helpId = v.description ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined;
  const common = {
    id,
    'aria-describedby': describedBy,
    'aria-invalid': error ? true : undefined,
    'aria-required': v.required || undefined,
    className: inputClass,
    ...register(v.name),
  };

  let control;
  switch (v.type) {
    case 'string':
      control = <input type="text" maxLength={v.maxLength} {...common} />;
      break;
    case 'text':
      control = <textarea rows={v.name === 'task' ? 3 : 4} maxLength={v.maxLength} {...common} />;
      break;
    case 'number':
      control = <input type="number" inputMode="decimal" min={v.min} max={v.max} {...common} />;
      break;
    case 'enum':
      control = (
        <select {...common}>
          {!v.required && <option value="">— Not specified —</option>}
          {v.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
      break;
  }

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium">
        {v.label}
        {v.required ? (
          <span className="text-red-600 dark:text-red-400" aria-hidden="true">
            {' '}
            *
          </span>
        ) : (
          <span className="font-normal text-slate-500"> (optional)</span>
        )}
      </label>
      {control}
      {v.description && (
        <p id={helpId} className="text-xs text-slate-500 dark:text-slate-400">
          {v.description}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
