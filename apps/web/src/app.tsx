import { SdkProvider } from "./sdk-context";
import { AppRouter } from "./routes/root";

export function App() {
  return (
    <SdkProvider>
      <AppRouter />
    </SdkProvider>
  );
}
