import type { GoogleGenAI } from '@google/genai';

import type { AiGenerationClient, AiGenerationResult, GenerateAiInput } from './AiGenerationClient.js';
import { AiProviderError } from './AiGenerationClient.js';
import { RetryPolicy } from './RetryPolicy.js';

/** Calls Gemini on Vertex AI through the official SDK, which resolves ADC. */
export class VertexAiGeminiClientAdapter implements AiGenerationClient {
  public constructor(
    private readonly client: GoogleGenAI,
    private readonly model: string,
    private readonly retryPolicy = new RetryPolicy(),
  ) {}

  public async generate(input: GenerateAiInput): Promise<AiGenerationResult> {
    return this.retryPolicy.execute(async () => {
      try {
        const response = await this.client.models.generateContent({
          model: this.model,
          contents: input.prompt,
          config: {
            maxOutputTokens: input.maxOutputTokens,
            systemInstruction: input.systemInstruction,
          },
        });
        const output = response.text?.trim();

        if (!output) {
          throw new AiProviderError('unavailable', 'Vertex AI returned no text output.');
        }

        return { output, provider: 'vertex', model: this.model };
      } catch (error) {
        if (error instanceof AiProviderError) {
          throw error;
        }

        throw this.toProviderError(error);
      }
    });
  }

  private toProviderError(error: unknown): AiProviderError {
    const statusCode = this.statusCode(error);

    if (statusCode === 429) {
      return new AiProviderError('rate_limited', 'Vertex AI rate limit reached.', statusCode, { cause: error });
    }

    if (statusCode === 408 || this.isTimeout(error)) {
      return new AiProviderError('timeout', 'Vertex AI request timed out.', statusCode, { cause: error });
    }

    return new AiProviderError('unavailable', 'Vertex AI is temporarily unavailable.', statusCode, { cause: error });
  }

  private statusCode(error: unknown): number | undefined {
    if (typeof error !== 'object' || error === null || !('status' in error)) {
      return undefined;
    }

    const status = (error as { status?: unknown }).status;
    return typeof status === 'number' ? status : undefined;
  }

  private isTimeout(error: unknown): boolean {
    return error instanceof Error && /timeout|timed out|deadline/i.test(error.message);
  }
}
