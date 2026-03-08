import React from 'react';
import { getServerCapabilities } from '../../api/capabilitiesApi';
import { createDefaultServerFeatureFlags, buildServerFeatureFlags, type ServerFeatureFlags } from '../../domain/serverFeatures';

type UseBoardCapabilitiesArgs = {
  enabled: boolean;
};

export type BoardCapabilitiesState = {
  features: ServerFeatureFlags;
  isLoading: boolean;
  error: string | null;
  isCapabilityAware: boolean;
  refresh: () => Promise<void>;
};

export function useBoardCapabilities({ enabled }: UseBoardCapabilitiesArgs): BoardCapabilitiesState {
  const [features, setFeatures] = React.useState<ServerFeatureFlags>(() => createDefaultServerFeatureFlags());
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    if (!enabled) {
      setFeatures(createDefaultServerFeatureFlags());
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const res = await getServerCapabilities();
      setFeatures(buildServerFeatureFlags(res));
      setError(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setFeatures(createDefaultServerFeatureFlags());
      setError(message || 'Failed to load server capabilities.');
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    features,
    isLoading,
    error,
    isCapabilityAware: enabled && !isLoading && !error,
    refresh,
  };
}
