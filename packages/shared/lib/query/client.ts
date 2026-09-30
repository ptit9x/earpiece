// Shared TanStack Query setup for extension pages (side panel, options).
// Creates one QueryClient per page with extension-appropriate defaults:
// - no window focus refetching (side panel is always "focused" when open,
//   and refetch-on-focus would spam the service worker)
// - staleTime tuned per use-case; queries are disabled unless enabled

import { QueryClient } from '@tanstack/react-query';

export const createExtensionQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: 1,
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
      },
    },
  });

/** Query keys — single source of truth. */
export const queryKeys = {
  config: ['config'] as const,
  scenarios: ['scenarios'] as const,
  sessionState: ['session-state'] as const,
  models: (baseUrl: string) => ['models', baseUrl] as const,
};
