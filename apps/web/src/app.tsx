import { SdkProvider } from "./sdk-context";
import { TopBar } from "./shell/top-bar";
import { CommandPalette } from "./shell/command-palette";

export function App() {
  return (
    <SdkProvider>
      <TopBar />
      <CommandPalette />
      <main>
        <p>You are browsing the shared computer.</p>
        <p>Open any program, user, function or transaction to follow it through the world.</p>
      </main>
    </SdkProvider>
  );
}
