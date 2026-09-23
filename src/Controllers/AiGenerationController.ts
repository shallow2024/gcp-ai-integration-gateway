import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import type { AppConfig } from '../config.js';
import { SensitivePayloadError, assertPayloadIsSafe } from '../Middleware/PayloadSanitizationMiddleware.js';
import { AiProviderError, type AiGenerationClient } from '../Services/AiGenerationClient.js';

function clientKey(request: FastifyRequest): string {
  const clientId = request.headers['x-client-id'];
  return typeof clientId === 'string' && clientId.trim().length > 0 ? clientId.trim() : request.ip;
}

function generationRequestSchema(maxPromptLength: number) {
  return z.object({
    prompt: z.string().trim().min(1).max(maxPromptLength),
    system_instruction: z.string().trim().min(1).max(2_000).optional(),
    max_output_tokens: z.number().int().min(1).max(1_024).optional(),
  });
}

export function registerAiGenerationController(
  app: FastifyInstance,
  aiClient: AiGenerationClient,
  config: AppConfig,
): void {
  const requestSchema = generationRequestSchema(config.MAX_PROMPT_LENGTH);

  app.post('/v1/ai/generate', {
    config: {
      rateLimit: {
        max: config.RATE_LIMIT_MAX,
        timeWindow: config.RATE_LIMIT_WINDOW_MS,
        keyGenerator: clientKey,
      },
    },
  }, async (request, reply) => {
    const parsed = requestSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        request_id: request.id,
        status: 'invalid_request',
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request payload failed validation.',
          details: parsed.error.flatten(),
        },
      });
    }

    try {
      assertPayloadIsSafe(parsed.data.prompt, parsed.data.system_instruction);

      const result = await aiClient.generate({
        prompt: parsed.data.prompt,
        systemInstruction: parsed.data.system_instruction,
        maxOutputTokens: parsed.data.max_output_tokens,
      });

      request.log.info({
        requestId: request.id,
        client: clientKey(request),
        promptLength: parsed.data.prompt.length,
        provider: result.provider,
        model: result.model,
      }, 'AI generation completed without logging prompt content');

      return reply.code(200).send({
        request_id: request.id,
        status: 'completed',
        data: result,
      });
    } catch (error) {
      if (error instanceof SensitivePayloadError) {
        return reply.code(400).send({
          request_id: request.id,
          status: 'rejected',
          error: {
            code: 'SENSITIVE_PAYLOAD_REJECTED',
            message: error.message,
          },
        });
      }

      if (error instanceof AiProviderError) {
        request.log.warn({
          requestId: request.id,
          providerFailure: error.kind,
          statusCode: error.statusCode,
        }, 'AI provider unavailable after retry policy');

        return reply.code(503).send({
          request_id: request.id,
          status: 'unavailable',
          fallback: {
            code: 'AI_SERVICE_UNAVAILABLE',
            message: 'The AI service is temporarily unavailable. No generated content was returned; retry later.',
          },
        });
      }

      throw error;
    }
  });
}
