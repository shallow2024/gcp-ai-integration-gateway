import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';

import { config as defaultConfig, type AppConfig } from './config.js';
import { registerAiGenerationController } from './Controllers/AiGenerationController.js';
import { applySecurityHeaders } from './Middleware/SecurityHeadersMiddleware.js';
import type { AiGenerationClient } from './Services/AiGenerationClient.js';
import { createAiGenerationClient } from './Services/AiProviderFactory.js';

export interface BuildAppOptions {
  config?: AppConfig;
  aiClient?: AiGenerationClient;
}

function isRateLimitResponse(error: unknown): error is {
  request_id: string;
  status: 'rate_limited';
  error: { code: 'RATE_LIMITED'; message: string };
} {
  return typeof error === 'object'
    && error !== null
    && 'status' in error
    && (error as { status?: unknown }).status === 'rate_limited';
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const appConfig = options.config ?? defaultConfig;
  const app = Fastify({
    logger: appConfig.LOG_LEVEL === 'silent' ? false : { level: appConfig.LOG_LEVEL },
    bodyLimit: 16 * 1024,
  });
  const aiClient = options.aiClient ?? createAiGenerationClient(appConfig);

  await app.register(rateLimit, {
    global: false,
    errorResponseBuilder: (request, context) => ({
      request_id: request.id,
      status: 'rate_limited',
      error: {
        code: 'RATE_LIMITED',
        message: `Request quota exceeded. Retry after ${context.after}.`,
      },
    }),
  });

  app.addHook('onRequest', applySecurityHeaders);

  app.get('/healthz', async () => ({ status: 'ok', provider: appConfig.AI_PROVIDER }));
  registerAiGenerationController(app, aiClient, appConfig);

  app.setErrorHandler((error, request, reply) => {
    if (isRateLimitResponse(error)) {
      return reply.code(429).send(error);
    }

    request.log.error({ err: error, requestId: request.id }, 'Unhandled gateway error');

    return reply.code(500).send({
      request_id: request.id,
      status: 'error',
      error: {
        code: 'INTERNAL_ERROR',
        message: 'The gateway could not process the request.',
      },
    });
  });

  return app;
}
