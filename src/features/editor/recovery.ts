import type { FormValues } from '../builder/useTemplateForm';

export interface DraftValue {
  draft: string;
  variableValues?: FormValues;
}

/**
 * Changes whose final autosave failed when the editor closed. Kept in memory
 * for the session; reopening the prompt restores them and retries the save,
 * so a storage hiccup during navigation can't silently drop work.
 */
const unsaved = new Map<string, DraftValue>();

export const recovery = {
  keep: (promptId: string, value: DraftValue) => void unsaved.set(promptId, value),
  peek: (promptId: string): DraftValue | null => unsaved.get(promptId) ?? null,
  clear: (promptId: string) => void unsaved.delete(promptId),
};

export const RECOVERED_NOTICE =
  'Recovered changes that could not be saved when you left this prompt. Saving them now.';
