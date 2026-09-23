import 'dotenv/config';

import { z } from 'zod';

const optionalNonEmptyString = z.preprocess(
  (value) => typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().trim().min(1).optional(),
);

const environmentSchema = z.object({
  AI_PROVIDER: z.enum(['mock', 'vertex']).default('mock'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  MAX_PROMPT_LENGTH: z.coerce.number().int().min(1).max(20_000).default(4_000),
  GOOGLE_CLOUD_PROJECT: optionalNonEmptyString,
  GOOGLE_CLOUD_LOCATION: z.string().trim().min(1).default('global'),
  VERTEX_MODEL: z.string().trim().min(1).default('gemini-2.5-flash'),
});

export type AppConfig = z.infer<typeof environmentSchema>;

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  return environmentSchema.parse(environment);
}

export const config = loadConfig();
