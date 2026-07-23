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
