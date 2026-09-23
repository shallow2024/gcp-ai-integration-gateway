import { GoogleGenAI } from '@google/genai';

export interface VertexAiConfiguration {
  projectId?: string;
  location: string;
}

/**
 * Creates a Vertex AI client without accepting API keys or service-account JSON.
 * The Google SDK resolves Application Default Credentials (ADC) from the environment.
 */
export class ApplicationDefaultCredentialsManager {
  public constructor(private readonly configuration: VertexAiConfiguration) {}

  public createClient(): GoogleGenAI {
    if (!this.configuration.projectId) {
      throw new Error(
        'GOOGLE_CLOUD_PROJECT is required when AI_PROVIDER=vertex. Configure ADC with gcloud auth application-default login locally, or attach a service account when deployed.',
      );
    }

    return new GoogleGenAI({
      enterprise: true,
      project: this.configuration.projectId,
      location: this.configuration.location,
      apiVersion: 'v1',
    });
  }
}
