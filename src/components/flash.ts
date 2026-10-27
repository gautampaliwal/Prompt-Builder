/**
 * One-shot messages carried across in-app navigation ("Prompt deleted.").
 * In memory only, so a page reload doesn't replay them. Readers `peek` in a
 * state initializer and `clear` in an effect, which is safe under StrictMode.
 */
const messages = new Map<string, string>();

export const flash = {
  set: (key: string, message: string) => void messages.set(key, message),
  peek: (key: string): string | null => messages.get(key) ?? null,
  clear: (key: string) => void messages.delete(key),
};

export const promptFlashKey = (promptId: string) => `prompt:${promptId}`;
export const LIBRARY_FLASH_KEY = 'library';
