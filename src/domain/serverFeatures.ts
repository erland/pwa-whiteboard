import type { ServerCapability } from '../api/javaWhiteboardServerContract';

export type ServerFeatureFlags = {
  apiVersion: string;
  wsProtocolVersion: string;
  capabilities: ServerCapability[];
  supportsComments: boolean;
  supportsVoting: boolean;
  supportsPublications: boolean;
  supportsSharedTimer: boolean;
  supportsReactions: boolean;
};

const EMPTY_CAPABILITIES: ServerCapability[] = [];

export function buildServerFeatureFlags(args?: {
  apiVersion?: string | null;
  wsProtocolVersion?: string | null;
  capabilities?: readonly ServerCapability[] | null;
}): ServerFeatureFlags {
  const capabilities = Array.isArray(args?.capabilities)
    ? Array.from(new Set(args!.capabilities.filter((value): value is ServerCapability => typeof value === 'string')))
    : EMPTY_CAPABILITIES;

  const has = (capability: ServerCapability) => capabilities.includes(capability);

  return {
    apiVersion: String(args?.apiVersion ?? ''),
    wsProtocolVersion: String(args?.wsProtocolVersion ?? ''),
    capabilities,
    supportsComments: has('comments'),
    supportsVoting: has('voting'),
    supportsPublications: has('publications'),
    supportsSharedTimer: has('shared-timer'),
    supportsReactions: has('ws-reactions'),
  };
}

export function createDefaultServerFeatureFlags(): ServerFeatureFlags {
  return buildServerFeatureFlags();
}
