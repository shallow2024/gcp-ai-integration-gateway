export type AiProviderName = 'mock' | 'vertex';

export interface GenerateAiInput {
  prompt: string;
  systemInstruction?: string;
  maxOutputTokens?: number;
}

export interface AiGenerationResult {
  output: string;
  provider: AiProviderName;
  model: string;
}

export interface AiGenerationClient {
  generate(input: GenerateAiInput): Promise<AiGenerationResult>;
}

export type ProviderFailureKind = 'rate_limited' | 'timeout' | 'unavailable';

export class AiProviderError extends Error {
  public constructor(
    public readonly kind: ProviderFailureKind,
    message: string,
    public readonly statusCode?: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'AiProviderError';
  }
}
