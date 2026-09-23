import { describe, expect, it } from 'vitest';

import { AiProviderError } from '../src/Services/AiGenerationClient.js';
import { RetryPolicy } from '../src/Services/RetryPolicy.js';

describe('RetryPolicy', () => {
  it('retries rate-limit errors with exponential backoff before succeeding', async () => {
    const delays: number[] = [];
    const policy = new RetryPolicy({
      maxAttempts: 3,
      baseDelayMs: 100,
      random: () => 0,
      sleep: async (milliseconds) => { delays.push(milliseconds); },
    });
    let attempts = 0;

    const result = await policy.execute(async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new AiProviderError('rate_limited', 'Rate limited', 429);
      }
      return 'success';
    });

    expect(result).toBe('success');
    expect(attempts).toBe(3);
    expect(delays).toEqual([100, 200]);
  });

  it('does not retry a non-transient error', async () => {
    const policy = new RetryPolicy({ sleep: async () => undefined });
    let attempts = 0;

    await expect(policy.execute(async () => {
      attempts += 1;
      throw new Error('Invalid request');
    })).rejects.toThrow('Invalid request');

    expect(attempts).toBe(1);
  });
});
