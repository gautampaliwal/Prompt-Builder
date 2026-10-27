import { normalizeTags } from '../core/library/fields';
import {
  PROMPT_TITLE_MAX,
  type Prompt,
  type StoredVariableValues,
  type Version,
} from '../core/schema/prompt';
import type { TemplateCategory, VariableValues } from '../core/schema/template';
import type { PromptRepository } from './repositories';

export interface PromptServiceOptions {
  repo: PromptRepository;
  now?: () => string;
  newId?: () => string;
  /** Called after a prompt is created (used to request persistent storage). */
  afterCreate?: () => void;
}

export interface CreatePromptInput {
  title: string;
  text: string;
  category?: TemplateCategory;
  tags?: readonly string[] | string;
  sourceTemplateId?: string;
  variableValues?: VariableValues;
  changeNote?: string;
}

export interface DraftInput {
  draft: string;
  /** Present for template-bound prompts; omit for plain-text prompts. */
  variableValues?: VariableValues;
}

export interface PromptMetaPatch {
  title?: string;
  tags?: readonly string[] | string;
  category?: TemplateCategory;
  favorite?: boolean;
}

export interface RestoreResult {
  /** The new version holding the restored text, or null if nothing changed. */
  restored: Version | null;
  /** The unsaved draft, kept as a version before restoring, if there was one. */
  savedDraft: Version | null;
}

/** RFC 4122 v4 id; falls back to getRandomValues where randomUUID is unavailable (non-secure contexts). */
export function defaultNewId(): string {
  const c = globalThis.crypto;
  if (typeof c.randomUUID === 'function') return c.randomUUID();
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = ((b[6] ?? 0) & 0x0f) | 0x40;
  b[8] = ((b[8] ?? 0) & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function storedValues(values: VariableValues | undefined): StoredVariableValues | undefined {
  if (values === undefined) return undefined;
  const out: StoredVariableValues = {};
  for (const [k, v] of Object.entries(values)) if (v !== undefined) out[k] = v;
  return out;
}

export function createPromptService({
  repo,
  now = () => new Date().toISOString(),
  newId = defaultNewId,
  afterCreate,
}: PromptServiceOptions) {
  function list() {
    return repo.list();
  }

  function get(id: string) {
    return repo.get(id);
  }

  function listVersions(id: string) {
    return repo.listVersions(id);
  }

  /** Creates a prompt with version 1 holding its initial text. */
  async function create(input: CreatePromptInput): Promise<Prompt> {
    const at = now();
    const id = newId();
    const values = storedValues(input.variableValues);
    const prompt: Prompt = {
      id,
      title: input.title,
      tags: normalizeTags(input.tags ?? []),
      category: input.category ?? 'general',
      favorite: false,
      sourceTemplateId: input.sourceTemplateId,
      variableValues: values,
      draft: input.text,
      currentVersion: 1,
      createdAt: at,
      updatedAt: at,
    };
    const first: Version = {
      id: newId(),
      promptId: id,
      number: 1,
      text: input.text,
      createdAt: at,
      origin: 'manual',
      changeNote: input.changeNote,
      variableValues: values,
    };
    await repo.create(prompt, [first]);
    afterCreate?.();
    return prompt;
  }

  /** Autosave: updates the working draft only. Never creates a version. */
  function saveDraft(id: string, input: DraftInput): Promise<Prompt> {
    const patch: Partial<Prompt> = { draft: input.draft, updatedAt: now() };
    if ('variableValues' in input) patch.variableValues = storedValues(input.variableValues);
    return repo.patch(id, patch);
  }

  /** Snapshots the draft as version n+1, unless it equals the latest version's text. */
  function saveVersion(
    id: string,
    opts: { changeNote?: string; origin?: Version['origin'] } = {},
  ): Promise<Version | null> {
    const at = now();
    const versionId = newId();
    return repo.mutate(id, (prompt, latest) => {
      if (latest !== undefined && latest.text === prompt.draft) return { result: null };
      const version: Version = {
        id: versionId,
        promptId: id,
        number: prompt.currentVersion + 1,
        text: prompt.draft,
        createdAt: at,
        origin: opts.origin ?? 'manual',
        changeNote: opts.changeNote,
        variableValues: prompt.variableValues,
      };
      return {
        addVersions: [version],
        prompt: { ...prompt, currentVersion: version.number, updatedAt: at },
        result: version,
      };
    });
  }

  /**
   * Restores version `number` by appending a new version with its text (history
   * stays linear). An unsaved draft is first kept as its own version, so nothing
   * is lost. Restoring a version without form values switches the prompt to
   * plain-text editing; restoring one with values switches it back.
   */
  async function restoreVersion(id: string, number: number): Promise<RestoreResult> {
    const target = await repo.getVersion(id, number);
    if (target === undefined) throw new Error(`Version ${number} of this prompt was not found.`);
    const at = now();
    const draftId = newId();
    const restoreId = newId();
    return repo.mutate<RestoreResult>(id, (prompt, latest) => {
      const draftSaved = latest !== undefined && latest.text === prompt.draft;
      if (draftSaved && prompt.draft === target.text) {
        return { result: { restored: null, savedDraft: null } };
      }
      const versions: Version[] = [];
      let n = prompt.currentVersion;
      let savedDraft: Version | null = null;
      if (!draftSaved) {
        n += 1;
        savedDraft = {
          id: draftId,
          promptId: id,
          number: n,
          text: prompt.draft,
          createdAt: at,
          origin: 'manual',
          changeNote: `Unsaved changes, kept before restoring v${number}`,
          variableValues: prompt.variableValues,
        };
        versions.push(savedDraft);
      }
      n += 1;
      const restored: Version = {
        id: restoreId,
        promptId: id,
        number: n,
        text: target.text,
        createdAt: at,
        origin: 'restore',
        changeNote: `Restored from v${number}`,
        variableValues: target.variableValues,
      };
      versions.push(restored);
      return {
        addVersions: versions,
        prompt: {
          ...prompt,
          draft: target.text,
          variableValues: target.variableValues,
          currentVersion: n,
          updatedAt: at,
        },
        result: { restored, savedDraft },
      };
    });
  }

  /** Copies the current draft into a new prompt with a fresh history (v1). */
  async function duplicate(id: string): Promise<Prompt> {
    const source = await repo.get(id);
    if (source === undefined) throw new Error('This prompt no longer exists.');
    const suffix = ' (copy)';
    return create({
      title: `${source.title.slice(0, PROMPT_TITLE_MAX - suffix.length)}${suffix}`,
      text: source.draft,
      category: source.category,
      tags: source.tags,
      sourceTemplateId: source.sourceTemplateId,
      variableValues: source.variableValues,
      changeNote: `Duplicated from "${source.title}"`,
    });
  }

  /** Title, tags and category bump `updatedAt`; toggling a favorite doesn't. */
  function updateMeta(id: string, patch: PromptMetaPatch): Promise<Prompt> {
    const p: Partial<Prompt> = {};
    if (patch.title !== undefined) p.title = patch.title;
    if (patch.tags !== undefined) p.tags = normalizeTags(patch.tags);
    if (patch.category !== undefined) p.category = patch.category;
    if (patch.favorite !== undefined) p.favorite = patch.favorite;
    if (patch.title !== undefined || patch.tags !== undefined || patch.category !== undefined) {
      p.updatedAt = now();
    }
    return repo.patch(id, p);
  }

  function markUsed(id: string): Promise<Prompt> {
    return repo.patch(id, { lastUsedAt: now() });
  }

  /** Switches a template-bound prompt to plain-text editing. Earlier versions keep their values. */
  function detachFromTemplate(id: string): Promise<Prompt> {
    return repo.patch(id, { variableValues: undefined, updatedAt: now() });
  }

  function remove(id: string): Promise<void> {
    return repo.remove(id);
  }

  return {
    list,
    get,
    listVersions,
    create,
    saveDraft,
    saveVersion,
    restoreVersion,
    duplicate,
    updateMeta,
    markUsed,
    detachFromTemplate,
    remove,
  };
}

export type PromptService = ReturnType<typeof createPromptService>;
