import { randomUUID } from 'node:crypto';

export type ProvenanceKind = 'external_user' | 'inter_session' | 'internal_system';

export type InputProvenance = {
  kind: ProvenanceKind;
  sourceSessionId?: string;
  sourceTool?: string;
  isUser?: boolean;
};

const INTER_SESSION_PREFIX_RE = /^\[Inter-session message\][\s\S]*?(?=\n|$)/m;

export const InputProvenanceFactory = {
  externalUser(sessionId?: string): InputProvenance {
    return { kind: 'external_user', sourceSessionId: sessionId, isUser: true };
  },

  internalSystem(tool?: string): InputProvenance {
    return { kind: 'internal_system', sourceTool: tool, isUser: false };
  },

  interSession(sourceSessionId: string, sourceTool?: string): InputProvenance {
    return {
      kind: 'inter_session',
      sourceSessionId,
      sourceTool,
      isUser: false,
    };
  },

  fromRole(role: 'user' | 'assistant' | 'system'): InputProvenance {
    return role === 'user'
      ? { kind: 'external_user', isUser: true }
      : { kind: 'internal_system', isUser: false };
  },
};

export function annotateInterSession(
  content: string,
  sourceSessionId: string,
): string {
  return `[Inter-session message] sourceSession=${sourceSessionId} isUser=false\n${content}`;
}

export function stripInterSessionPrefix(content: string): string {
  return content.replace(INTER_SESSION_PREFIX_RE, '').trim();
}

export function isInterSessionMessage(content: string): boolean {
  return INTER_SESSION_PREFIX_RE.test(content);
}

export function generateProvenanceId(): string {
  return `prov:${randomUUID()}`;
}
