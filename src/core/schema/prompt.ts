import { z } from 'zod';
import { TEMPLATE_CATEGORIES } from './template';

export const PROMPT_TITLE_MAX = 200;
export const PROMPT_TEXT_MAX = 500_000;
export const TAG_MAX_LENGTH = 40;
export const TAGS_MAX = 20;

const id = z.string().min(1).max(100);
const isoDate = z.iso.datetime();

/** Stored template-form values (all variables as entered). */
export const variableValuesSchema = z.record(z.string(), z.union([z.string(), z.number()]));

/**
 * A saved prompt (brief §4.5). `draft` is the mutable working copy that
 * autosave writes; history lives in immutable `Version` records.
 * When `variableValues` is set, the prompt is edited through its template's
 * form and `draft` is that form's rendered text.
 */
export const promptSchema = z.object({
  id,
  title: z.string().trim().min(1, 'A title is required').max(PROMPT_TITLE_MAX),
  tags: z.array(z.string().trim().min(1).max(TAG_MAX_LENGTH)).max(TAGS_MAX).default([]),
  category: z.enum(TEMPLATE_CATEGORIES).default('general'),
  favorite: z.boolean().default(false),
  sourceTemplateId: id.optional(),
  variableValues: variableValuesSchema.optional(),
  draft: z.string().max(PROMPT_TEXT_MAX),
  /** Number of the latest version (0 = none). */
  currentVersion: z.number().int().min(0),
  createdAt: isoDate,
  updatedAt: isoDate,
  lastUsedAt: isoDate.optional(),
});

export const VERSION_ORIGINS = ['manual', 'optimizer', 'import', 'restore'] as const;

export const versionSchema = z.object({
  id,
  promptId: id,
  /** Prompt revision number: starts at 1, increases by 1 per version. */
  number: z.number().int().min(1),
  text: z.string().max(PROMPT_TEXT_MAX),
  createdAt: isoDate,
  changeNote: z.string().trim().max(500).optional(),
  origin: z.enum(VERSION_ORIGINS),
  /** Form values at the time, for template-bound prompts; restoring brings them back. */
  variableValues: variableValuesSchema.optional(),
});

export type Prompt = z.infer<typeof promptSchema>;
export type Version = z.infer<typeof versionSchema>;
export type VersionOrigin = (typeof VERSION_ORIGINS)[number];
export type StoredVariableValues = z.infer<typeof variableValuesSchema>;
