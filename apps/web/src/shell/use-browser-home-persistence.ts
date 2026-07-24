import { useBrowserHomeStore } from "./browser-home-store";
import { useStorePersistence } from "./use-store-persistence";

const STORAGE_KEY = "browser-home-collapsed";

function isRecordOfBooleans(value: unknown): value is Record<string, boolean> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((v) => typeof v === "boolean")
  );
}

function deserialize(raw: string): { collapsed: Record<string, boolean> } | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return isRecordOfBooleans(parsed) ? { collapsed: parsed } : null;
  } catch {
    return null;
  }
}

export function useBrowserHomePersistence() {
  useStorePersistence(STORAGE_KEY, useBrowserHomeStore, {
    serialize: (state) => JSON.stringify(state.collapsed),
    deserialize,
  });
}
