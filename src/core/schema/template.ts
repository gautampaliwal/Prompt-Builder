import { z } from 'zod';

/**
 * Template schema version (brief §4.1). Distinct from backup format version,
 * Dexie database version and prompt revision numbers.
 */
export const TEMPLATE_SCHEMA_VERSION = '1.0.0';

export const TEMPLATE_CATEGORIES = [
  'general',
  'communication',
  'writing',
  'research',
  'coding',
  'data',
  'documentation',
  'business',
] as const;

/**
 * Optimizer rule IDs (brief §5.2). The M3 optimizer registry must match this
 * list exactly; a test enforces that once the registry exists.
 */
export const OPTIMIZER_RULE_IDS = [
  'normalize-whitespace',
  'collapse-blank-lines',
  'duplicate-lines',
  'redundant-phrases',
  'contradictions',
  'missing-variables',
] as const;

/** Variable names usable as `{{ name }}` placeholders (brief §4.3). */
export const VARIABLE_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

const SEMVER = /^\d+\.\d+\.\d+$/;
const ID = /^[A-Za-z0-9_-]{1,100}$/;

const variableBase = {
  name: z
    .string()
    .regex(VARIABLE_NAME_PATTERN, 'Use letters, digits and _; start with a letter or _'),
  label: z.string().trim().min(1).max(100),
  description: z.string().max(500).optional(),
  required: z.boolean(),
};

export const stringVariableSchema = z.object({
  ...variableBase,
  type: z.literal('string'),
  defaultValue: z.string().default(''),
  maxLength: z.number().int().positive().optional(),
});

export const textVariableSchema = z.object({
  ...variableBase,
  type: z.literal('text'),
  defaultValue: z.string().default(''),
  maxLength: z.number().int().positive().optional(),
});

export const enumVariableSchema = z.object({
  ...variableBase,
  type: z.literal('enum'),
  options: z.array(z.string().trim().min(1)).min(1),
  /** Empty string means "no selection" and is only valid for optional variables. */
  defaultValue: z.string().default(''),
});

export const numberVariableSchema = z.object({
  ...variableBase,
  type: z.literal('number'),
  defaultValue: z.number().finite().optional(),
  min: z.number().finite().optional(),
  max: z.number().finite().optional(),
});

export const variableSchema = z.discriminatedUnion('type', [
  stringVariableSchema,
  textVariableSchema,
  enumVariableSchema,
  numberVariableSchema,
]);

export const sectionSchema = z.object({
  id: z.string().regex(ID),
  label: z.string().trim().min(1).max(100),
  enabled: z.boolean(),
  required: z.boolean(),
  content: z.string().max(100_000),
});

export const templateSchema = z
  .object({
    schemaVersion: z.string().regex(SEMVER),
    id: z.string().regex(ID),
    name: z.string().trim().min(1).max(120),
    description: z.string().max(1000).default(''),
    category: z.enum(TEMPLATE_CATEGORIES),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
    status: z.enum(['active', 'archived']).default('active'),
    builtIn: z.boolean().default(false),
    template: z.object({
      type: z.literal('structured'),
      sections: z.array(sectionSchema).min(1),
    }),
    variables: z.array(variableSchema).default([]),
    optimization: z
      .object({
        enabledRules: z.array(z.enum(OPTIMIZER_RULE_IDS)),
        preserveSectionOrder: z.boolean(),
      })
      .default({ enabledRules: [...OPTIMIZER_RULE_IDS], preserveSectionOrder: true }),
    metadata: z.object({
      createdAt: z.iso.datetime(),
      updatedAt: z.iso.datetime(),
    }),
  })
  .superRefine((t, ctx) => {
    const seen = (values: string[], path: string, what: string) => {
      const dupes = new Set<string>();
      const set = new Set<string>();
      for (const v of values) (set.has(v) ? dupes : set).add(v);
      for (const d of dupes) {
        ctx.addIssue({ code: 'custom', path: [path], message: `Duplicate ${what} "${d}"` });
      }
    };
    seen(
      t.template.sections.map((s) => s.id),
      'template',
      'section id',
    );
    seen(
      t.variables.map((v) => v.name),
      'variables',
      'variable name',
    );

    t.variables.forEach((v, i) => {
      if (v.type === 'enum') {
        if (new Set(v.options).size !== v.options.length) {
          ctx.addIssue({
            code: 'custom',
            path: ['variables', i, 'options'],
            message: 'Duplicate option',
          });
        }
        if (v.defaultValue === '' && v.required) {
          ctx.addIssue({
            code: 'custom',
            path: ['variables', i, 'defaultValue'],
            message: 'A required enum needs a default option',
          });
        }
        if (v.defaultValue !== '' && !v.options.includes(v.defaultValue)) {
          ctx.addIssue({
            code: 'custom',
            path: ['variables', i, 'defaultValue'],
            message: `Default "${v.defaultValue}" is not one of the options`,
          });
        }
      }
      if (v.type === 'number') {
        if (v.min !== undefined && v.max !== undefined && v.min > v.max) {
          ctx.addIssue({
            code: 'custom',
            path: ['variables', i],
            message: 'min is greater than max',
          });
        }
        const d = v.defaultValue;
        if (
          d !== undefined &&
          ((v.min !== undefined && d < v.min) || (v.max !== undefined && d > v.max))
        ) {
          ctx.addIssue({
            code: 'custom',
            path: ['variables', i, 'defaultValue'],
            message: 'Default is outside min/max',
          });
        }
      }
      if ((v.type === 'string' || v.type === 'text') && v.maxLength !== undefined) {
        if (v.defaultValue.length > v.maxLength) {
          ctx.addIssue({
            code: 'custom',
            path: ['variables', i, 'defaultValue'],
            message: 'Default is longer than maxLength',
          });
        }
      }
    });
  });

export type Template = z.infer<typeof templateSchema>;
export type TemplateInput = z.input<typeof templateSchema>;
export type Section = z.infer<typeof sectionSchema>;
export type Variable = z.infer<typeof variableSchema>;
export type VariableType = Variable['type'];
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];
export type OptimizerRuleId = (typeof OPTIMIZER_RULE_IDS)[number];

/** Values supplied for a template's variables, keyed by variable name. */
export type VariableValues = Record<string, string | number | undefined>;
