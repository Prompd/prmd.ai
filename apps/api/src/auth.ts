import { createClerkClient, verifyToken, type ClerkClient } from '@clerk/backend';
import type { Request } from 'express';

export interface AuthVerifier {
  /**
   * Returns the verified Clerk user id if the request carries a valid session
   * token, otherwise null. Does not throw on missing or malformed tokens —
   * callers decide whether the route requires auth.
   */
  verify(req: Request): Promise<string | null>;
  /** True if the verifier is wired with a real Clerk secret. */
  readonly enabled: boolean;
}

interface ClerkAuthOptions {
  secretKey: string;
  publishableKey?: string;
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (typeof header !== 'string') return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return null;
  return match[1]?.trim() ?? null;
}

export function createClerkAuth(options: ClerkAuthOptions): AuthVerifier {
  const client: ClerkClient = createClerkClient({
    secretKey: options.secretKey,
    publishableKey: options.publishableKey,
  });

  return {
    enabled: true,
    async verify(req) {
      const token = extractToken(req);
      if (!token) return null;
      try {
        const payload = await verifyToken(token, {
          secretKey: options.secretKey,
        });
        const sub = payload.sub;
        return typeof sub === 'string' && sub.length > 0 ? sub : null;
      } catch {
        return null;
      }
      // The `client` is created up-front so future routes can fetch the
      // user record via `client.users.getUser(userId)` without re-instantiating.
      void client;
    },
  };
}

export function createDisabledAuth(): AuthVerifier {
  return {
    enabled: false,
    async verify() {
      return null;
    },
  };
}
