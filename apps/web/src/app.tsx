import { useState } from "react";
import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SdkProvider } from "./sdk-context";
import { AppRouter } from "./routes/root";
import { useRequestStatsStore } from "./shell/request-stats-store";

function createQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onSuccess: () => useRequestStatsStore.getState().increment(),
    }),
    defaultOptions: {
      queries: {
        // React Query's own default (3 retries, exponential backoff up to
        // 30s) was designed before every error state here had its own
        // "Try again" button (error-state.tsx) — for a deterministic
        // failure (bad package path, bad address, ...) that meant sitting
        // on a loading spinner for 7+ seconds before the real error ever
        // showed up. One quick retry still absorbs a genuine transient
        // blip; refetchOnReconnect (react-query's own default, unchanged)
        // still means a real dropped-connection failure recovers on its
        // own once the network comes back, without needing all 3.
        retry: 1,
        retryDelay: 500,
      },
    },
  });
}

export function App() {
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <SdkProvider>
        <AppRouter />
      </SdkProvider>
    </QueryClientProvider>
  );
}
