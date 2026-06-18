import type { UserRole } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        organizationId: string;
      role: UserRole;
      email: string;
      sessionId?: string;
      apiKeyId?: string;
      apiKeyScopes?: string[];
      teamId?: string | null;
      permissionPolicy?: Record<string, unknown> | null;
    };
    requestId?: string;
    rawBody?: Buffer;
  }
}
}

export {};
