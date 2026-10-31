import { createContext, useContext } from "react";

export type DeskSyncStatus = "local" | "loading" | "saved" | "saving" | "error";

export const DeskSyncContext = createContext<DeskSyncStatus>("local");

export function useDeskSyncStatus() {
  return useContext(DeskSyncContext);
}
