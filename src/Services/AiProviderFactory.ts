import { ApplicationDefaultCredentialsManager } from '../Auth/ApplicationDefaultCredentialsManager.js';
import type { AppConfig } from '../config.js';
import type { AiGenerationClient } from './AiGenerationClient.js';
import { MockAiGenerationClient } from './MockAiGenerationClient.js';
import { VertexAiGeminiClientAdapter } from './VertexAiGeminiClientAdapter.js';

export function createAiGenerationClient(config: AppConfig): AiGenerationClient {
  if (config.AI_PROVIDER === 'mock') {
    return new MockAiGenerationClient();
  }

  const credentials = new ApplicationDefaultCredentialsManager({
    projectId: config.GOOGLE_CLOUD_PROJECT,
    location: config.GOOGLE_CLOUD_LOCATION,
  });

  return new VertexAiGeminiClientAdapter(credentials.createClient(), config.VERTEX_MODEL);
}
