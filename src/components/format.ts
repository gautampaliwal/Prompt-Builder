const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}

/** A readable message for any thrown value, including Zod validation errors. */
export function errorMessage(e: unknown): string {
  if (e instanceof Error) {
    if (e.name === 'ZodError' && 'issues' in e && Array.isArray(e.issues)) {
      return (e.issues as { message: string }[]).map((i) => i.message).join('; ');
    }
    return e.message;
  }
  return String(e);
}

export function categoryLabel(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

export function plural(n: number, word: string): string {
  return `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;
}
