const sensitivePatterns = [
  /-----BEGIN(?: [A-Z]+)* PRIVATE KEY-----/i,
  /\bAIza[\w-]{20,}\b/,
  /\bya29\.[\w-]+\b/,
  /(?:api[_-]?key|authorization|password|secret|access[_-]?token)\s*[:=]\s*['\"]?[^\s'\"]+/i,
];

export class SensitivePayloadError extends Error {
  public constructor() {
    super('The request contains a probable credential or private key and was not forwarded to an AI provider.');
    this.name = 'SensitivePayloadError';
  }
}

/** Rejects likely secrets before a prompt can leave the gateway boundary. */
export function assertPayloadIsSafe(...values: Array<string | undefined>): void {
  const combinedPayload = values.filter((value): value is string => Boolean(value)).join('\n');

  if (sensitivePatterns.some((pattern) => pattern.test(combinedPayload))) {
    throw new SensitivePayloadError();
  }
}
