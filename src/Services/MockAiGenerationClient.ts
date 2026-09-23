import type { AiGenerationClient, AiGenerationResult, GenerateAiInput } from './AiGenerationClient.js';

/**
 * Deterministic local adapter. It gives the gateway a runnable, no-cost default
 * without sending prompts to any third party.
 */
export class MockAiGenerationClient implements AiGenerationClient {
  public async generate(input: GenerateAiInput): Promise<AiGenerationResult> {
    const normalizedPrompt = input.prompt.replace(/\s+/g, ' ').trim();

    return {
      output: `Mock response: request accepted for secure processing. Prompt preview: ${normalizedPrompt.slice(0, 120)}`,
      provider: 'mock',
      model: 'local-deterministic-mock-v1',
    };
  }
}
