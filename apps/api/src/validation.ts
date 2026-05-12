import { z } from 'zod';

const packageManagerSchema = z.enum(['npm', 'pnpm', 'yarn', 'bun', 'pip', 'poetry', 'go', 'cargo', 'nuget', 'other']);

const outputFormatSchema = z.enum(['agentsmd', 'claude', 'cursor', 'copilot']);

const repoProfileSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  languages: z.array(z.string().min(1).max(50)).max(50),
  frameworks: z.array(z.string().min(1).max(50)).max(50),
  testRunners: z.array(z.string().min(1).max(50)).max(50),
  packageManager: packageManagerSchema.optional(),
  hasCI: z.boolean(),
  license: z.string().max(100).optional(),
});

export const generateRequestSchema = z.object({
  source: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('manual'), profile: repoProfileSchema }),
    z.object({ kind: z.literal('github'), url: z.string().url().max(500) }),
    z.object({ kind: z.literal('bitbucket'), url: z.string().url().max(500) }),
  ]),
  formats: z.array(outputFormatSchema).min(1).max(4).optional(),
});

const generatedFileSchema = z.object({
  path: z
    .string()
    .min(1)
    .max(500)
    .refine((p) => !p.includes('..') && !p.startsWith('/') && !/^[a-zA-Z]:/.test(p), {
      message: 'path must be relative and not contain traversal',
    }),
  contents: z.string().max(1_000_000),
  language: z.enum(['markdown', 'json']),
});

export const downloadRequestSchema = z.object({
  name: z.string().min(1).max(100),
  files: z.array(generatedFileSchema).min(1).max(200),
});
