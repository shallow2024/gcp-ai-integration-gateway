import { AiProviderError } from './AiGenerationClient.js';

export interface RetryPolicyOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  random?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
}

const defaultSleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

/** Retries only transient provider failures with exponential backoff and jitter. */
export class RetryPolicy {
  private readonly maxAttempts: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly random: () => number;
  private readonly sleep: (milliseconds: number) => Promise<void>;

  public constructor(options: RetryPolicyOptions = {}) {
    this.maxAttempts = options.maxAttempts ?? 3;
    this.baseDelayMs = options.baseDelayMs ?? 250;
    this.maxDelayMs = options.maxDelayMs ?? 2_000;
    this.random = options.random ?? Math.random;
    this.sleep = options.sleep ?? defaultSleep;
  }

  public async execute<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (!this.isRetriable(error) || attempt === this.maxAttempts) {
          throw error;
        }

        await this.sleep(this.calculateDelay(attempt));
      }
    }

    throw lastError;
  }

  private isRetriable(error: unknown): boolean {
    if (error instanceof AiProviderError) {
      return error.kind === 'rate_limited' || error.kind === 'timeout' || error.kind === 'unavailable';
    }

    const statusCode = this.extractStatusCode(error);
    return statusCode === 408 || statusCode === 429 || (statusCode !== undefined && statusCode >= 500);
  }

  private calculateDelay(attempt: number): number {
    const exponentialDelay = Math.min(this.baseDelayMs * 2 ** (attempt - 1), this.maxDelayMs);
    const jitter = Math.floor(this.random() * Math.max(1, exponentialDelay / 2));
    return exponentialDelay + jitter;
  }

  private extractStatusCode(error: unknown): number | undefined {
    if (typeof error !== 'object' || error === null || !('status' in error)) {
      return undefined;
    }

    const status = (error as { status?: unknown }).status;
    return typeof status === 'number' ? status : undefined;
  }
}
