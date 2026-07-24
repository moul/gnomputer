import { Component, type ReactNode } from "react";
import { AppErrorFallback } from "./app-error-fallback";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// TanStack Router's own error boundaries only wrap matched ROUTE components
// (Home, in this app) — anything rendered directly in RootLayout alongside
// <Outlet/> (IslandBar, CommandPalette) has no boundary of its own, so a
// crash in either one takes down the whole shell, root route included, with
// no island bar left to even reach "Clear state" from. Wrapping each
// independently means a crash in one doesn't take the other down too.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) return <AppErrorFallback error={this.state.error} inline />;
    return this.props.children;
  }
}
