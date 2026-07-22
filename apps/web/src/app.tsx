import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SdkProvider } from "./sdk-context";
import { AppRouter } from "./routes/root";

export function App() {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <SdkProvider>
        <AppRouter />
      </SdkProvider>
    </QueryClientProvider>
  );
}
