import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import type { AppConfig } from '../src/config.js';
import type { AiGenerationClient } from '../src/Services/AiGenerationClient.js';

const testConfig: AppConfig = {
  AI_PROVIDER: 'mock',
  PORT: 3000,
  LOG_LEVEL: 'silent',
  RATE_LIMIT_MAX: 30,
  RATE_LIMIT_WINDOW_MS: 60_000,
  MAX_PROMPT_LENGTH: 4_000,
  GOOGLE_CLOUD_PROJECT: undefined,
  GOOGLE_CLOUD_LOCATION: 'global',
  VERTEX_MODEL: 'gemini-2.5-flash',
};

const successfulClient: AiGenerationClient = {
  generate: async () => ({
    output: 'Generated answer.',
    provider: 'mock',
    model: 'test-model',
  }),
};

const unavailableClient: AiGenerationClient = {
  generate: async () => {
    const { AiProviderError } = await import('../src/Services/AiGenerationClient.js');
    throw new AiProviderError('unavailable', 'Provider unavailable', 503);
  },
};

const apps: FastifyInstance[] = [];

async function makeApp(aiClient = successfulClient, overrides: Partial<AppConfig> = {}): Promise<FastifyInstance> {
  const app = await buildApp({ config: { ...testConfig, ...overrides }, aiClient });
  apps.push(app);
  return app;
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe('GCP AI integration gateway', () => {
  it('returns health status without calling an AI provider', async () => {
    const app = await makeApp();
    const response = await app.inject({ method: 'GET', url: '/healthz' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok', provider: 'mock' });
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('generates a successful response through an injected adapter', async () => {
    const app = await makeApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/ai/generate',
      headers: { 'x-client-id': 'test-client' },
      payload: { prompt: 'Summarize the incident report.' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'completed',
      data: { output: 'Generated answer.', provider: 'mock', model: 'test-model' },
    });
  });

  it('rejects likely credentials before reaching an AI provider', async () => {
    const app = await makeApp();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/ai/generate',
      payload: { prompt: 'authorization: Bearer secret-value' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      status: 'rejected',
      error: { code: 'SENSITIVE_PAYLOAD_REJECTED' },
    });
  });

  it('returns a documented fallback when the AI provider remains unavailable', async () => {
    const app = await makeApp(unavailableClient);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/ai/generate',
      payload: { prompt: 'Draft a safe fallback.' },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      status: 'unavailable',
      fallback: { code: 'AI_SERVICE_UNAVAILABLE' },
    });
  });

  it('rate limits repeated calls from the same client identity', async () => {
    const app = await makeApp(successfulClient, { RATE_LIMIT_MAX: 1 });
    const request = {
      method: 'POST' as const,
      url: '/v1/ai/generate',
      headers: { 'x-client-id': 'limited-client' },
      payload: { prompt: 'A safe request.' },
    };

    expect((await app.inject(request)).statusCode).toBe(200);
    const limited = await app.inject(request);

    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toMatchObject({
      status: 'rate_limited',
      error: { code: 'RATE_LIMITED' },
    });
  });
});
