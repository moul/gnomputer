import { SdkProvider } from "./sdk-context";
import { TopBar } from "./shell/top-bar";
import { CommandPalette } from "./shell/command-palette";
import { AppRouter } from "./routes/root";

export function App() {
  return (
    <SdkProvider>
      <TopBar />
      <CommandPalette />
      <main>
        <AppRouter />
      </main>
    </SdkProvider>
  );
}
