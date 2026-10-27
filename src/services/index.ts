import { PromptBuilderDb } from '../storage/db';
import { createDexiePromptRepository } from '../storage/prompt-repository';
import { requestPersistentStorage } from './persistence';
import { createPromptService } from './prompt-service';
import type { PromptRepository } from './repositories';
import { createTemplateService } from './template-service';

export interface CreateServicesOptions {
  dbName?: string;
  now?: () => string;
  newId?: () => string;
  requestPersistence?: () => Promise<unknown>;
}

/** Composition root for application services. The UI receives this via React context. */
export function createServices(options: CreateServicesOptions = {}) {
  const db = new PromptBuilderDb(options.dbName);
  const repo: PromptRepository = createDexiePromptRepository(db);
  const persist = options.requestPersistence ?? requestPersistentStorage;
  return {
    prompts: createPromptService({
      repo,
      now: options.now,
      newId: options.newId,
      afterCreate: () => void persist(),
    }),
    templates: createTemplateService(),
    dbName: db.name,
    close: () => db.close(),
  };
}

export type Services = ReturnType<typeof createServices>;
export type { PromptService, PromptMetaPatch, RestoreResult } from './prompt-service';
