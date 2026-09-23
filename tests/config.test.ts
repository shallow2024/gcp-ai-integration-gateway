import { describe, expect, it } from 'vitest';

import { loadConfig } from '../src/config.js';

describe('environment configuration', () => {
  it('accepts a blank optional Google Cloud project in mock mode', () => {
    const config = loadConfig({
      AI_PROVIDER: 'mock',
      GOOGLE_CLOUD_PROJECT: '',
    });

    expect(config.AI_PROVIDER).toBe('mock');
    expect(config.GOOGLE_CLOUD_PROJECT).toBeUndefined();
  });

  it('preserves a configured Google Cloud project for Vertex mode', () => {
    const config = loadConfig({
      AI_PROVIDER: 'vertex',
      GOOGLE_CLOUD_PROJECT: 'portfolio-demo-project',
    });

    expect(config.GOOGLE_CLOUD_PROJECT).toBe('portfolio-demo-project');
  });
});
