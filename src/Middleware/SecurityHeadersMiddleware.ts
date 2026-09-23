import type { FastifyReply, FastifyRequest } from 'fastify';

/** Applies a small baseline of API-safe browser and transport hardening headers. */
export async function applySecurityHeaders(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
  reply.header('cache-control', 'no-store');
  reply.header('content-security-policy', "default-src 'none'; frame-ancestors 'none'");
  reply.header('referrer-policy', 'no-referrer');
  reply.header('x-content-type-options', 'nosniff');
  reply.header('x-frame-options', 'DENY');
}
