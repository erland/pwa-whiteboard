import { getAccessToken } from '../auth/oidc';
import { getApiBaseUrl } from '../config/server';
import { createHttpClient } from './httpClient';
import type { ServerCapabilitiesResponse, ServerCapability } from './javaWhiteboardServerContract';

export type ServerCapabilities = {
  apiVersion: string;
  wsProtocolVersion: string;
  capabilities: ServerCapability[];
};

function normalizeCapabilities(input: ServerCapabilitiesResponse): ServerCapabilities {
  const capabilities = Array.isArray(input.capabilities)
    ? Array.from(
        new Set(
          input.capabilities
            .map((value) => String(value).trim())
            .filter((value) => value.length > 0)
        )
      )
    : [];

  return {
    apiVersion: String(input.apiVersion ?? ''),
    wsProtocolVersion: String(input.wsProtocolVersion ?? ''),
    capabilities,
  };
}

export function createCapabilitiesApi(args: { baseUrl: string; accessToken?: string | null } | undefined = undefined) {
  const client = createHttpClient({
    baseUrl: args?.baseUrl ?? getApiBaseUrl()!,
    getAccessToken: () => args?.accessToken ?? getAccessToken(),
  });

  return {
    async get(): Promise<ServerCapabilities> {
      const res = await client.get<ServerCapabilitiesResponse>('/capabilities');
      return normalizeCapabilities(res);
    },
  };
}

export async function getServerCapabilities(): Promise<ServerCapabilities> {
  return createCapabilitiesApi().get();
}
