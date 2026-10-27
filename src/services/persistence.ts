export type PersistenceResult = 'persisted' | 'denied' | 'unsupported';

/**
 * Asks the browser to keep this site's storage under pressure (brief §6).
 * Called after the first save, so any browser prompt is tied to a user action.
 * Never throws.
 */
export async function requestPersistentStorage(
  storage: StorageManager | undefined = globalThis.navigator?.storage,
): Promise<PersistenceResult> {
  if (!storage || typeof storage.persist !== 'function') return 'unsupported';
  try {
    if (await storage.persisted()) return 'persisted';
    return (await storage.persist()) ? 'persisted' : 'denied';
  } catch {
    return 'unsupported';
  }
}
