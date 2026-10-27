import Dexie, { type Table } from 'dexie';
import type { Prompt, Version } from '../core/schema/prompt';
import type { Template } from '../core/schema/template';
import { V1 } from './migrations/v1';

export const DB_NAME = 'prompt-builder';

/** All migrations, oldest first. Append new ones; never reorder or edit. */
export const MIGRATIONS = [V1] as const;
export const DB_VERSION = Math.max(...MIGRATIONS.map((m) => m.version));

export interface KeyValue {
  key: string;
  value: unknown;
}

export class PromptBuilderDb extends Dexie {
  // `declare` so class-field semantics don't overwrite the tables Dexie assigns.
  declare templates: Table<Template, string>;
  declare prompts: Table<Prompt, string>;
  declare versions: Table<Version, string>;
  declare settings: Table<KeyValue, string>;
  declare meta: Table<KeyValue, string>;

  constructor(name: string = DB_NAME) {
    super(name);
    for (const m of MIGRATIONS) this.version(m.version).stores(m.stores);
  }
}
