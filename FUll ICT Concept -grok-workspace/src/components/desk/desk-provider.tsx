import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  clearGuestSession,
  guestDataWasInitialized,
  isGuestSession,
  markGuestDataInitialized,
} from "@/lib/auth/guest-session";
import { authEnabled } from "@/lib/auth/client";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { loadDeskState, saveDeskState } from "@/lib/desk-sync";
import { createInitialState, ensureMinimumDeskData } from "@/lib/ict-defaults";
import { deskSnapshot, useDeskStore } from "@/lib/ict-store";
import { DeskSyncContext, type DeskSyncStatus } from "./desk-sync-context";
import { applyFontTheme, type FontTheme } from "@/lib/font-themes";
import {
  applyColorTheme,
  THEME_STORAGE_KEY,
  ACCENT_STORAGE_KEY,
  DEFAULT_COLOR_THEME,
  DEFAULT_ACCENT_COLOR,
} from "@/lib/color-themes";

export function DeskProvider({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { user, isPending } = useCurrentUserState();
  const userId = user?.id ?? null;
  const guestSession = authEnabled && !userId && isGuestSession();
  const [localReady, setLocalReady] = useState(false);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<DeskSyncStatus>(authEnabled ? "loading" : "local");
  const [loadError, setLoadError] = useState<{ userId: string; message: string } | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    try {
      const storeState = useDeskStore.getState();
      const savedTheme = storeState.themeId ?? window.localStorage.getItem(THEME_STORAGE_KEY) ?? DEFAULT_COLOR_THEME;
      const savedAccent = storeState.accentColor ?? window.localStorage.getItem(ACCENT_STORAGE_KEY) ?? DEFAULT_ACCENT_COLOR;
      applyColorTheme(savedTheme, savedAccent);
    } catch (e) {
      console.error("[desk-provider] failed to apply color theme:", e);
    }

    try {
      const savedFont = window.localStorage.getItem("first-payout-font-theme-v1");
      if (savedFont) {
        applyFontTheme(savedFont as FontTheme);
      }
    } catch (e) {
      console.error("[desk-provider] failed to apply font theme:", e);
    }
  }, []);

  useEffect(() => {
    const unsub = useDeskStore.subscribe((state) => {
      if (state.themeId || state.accentColor) {
        const theme = state.themeId ?? DEFAULT_COLOR_THEME;
        const accent = state.accentColor ?? DEFAULT_ACCENT_COLOR;
        applyColorTheme(theme, accent);
        try {
          if (state.themeId) window.localStorage.setItem(THEME_STORAGE_KEY, state.themeId);
          if (state.accentColor) window.localStorage.setItem(ACCENT_STORAGE_KEY, state.accentColor);
        } catch (e) {
          console.error("[desk-provider] failed to sync theme to localStorage:", e);
        }
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (authEnabled) {
      if (isPending) return;
      if (!userId) {
        setLoadedUserId(null);
        useDeskStore.getState().resetAll();
        if (!guestSession) return;
        let cancelled = false;
        setSyncStatus("local");
        void (async () => {
          try {
            if (guestDataWasInitialized()) {
              await useDeskStore.persist.rehydrate();
              if (cancelled) return;
              const state = useDeskStore.getState();
              const normalized = ensureMinimumDeskData(state);
              if (normalized !== state) useDeskStore.getState().replaceAll(normalized);
            } else {
              useDeskStore.getState().replaceAll(ensureMinimumDeskData(createInitialState()));
              markGuestDataInitialized();
            }
            if (!cancelled) setLocalReady(true);
          } catch (error) {
            if (cancelled) return;
            console.error("[desk-sync] failed to initialize local demo:", error);
            toast.error("Could not open the local demo desk.");
          }
        })();
        return () => {
          cancelled = true;
        };
      }
      let cancelled = false;
      setSyncStatus("loading");
      setLoadError(null);
      if (loadedUserId !== userId) {
        useDeskStore.getState().resetAll();
      }
      try {
        clearGuestSession();
      } catch (error) {
        console.error("[auth] could not clear guest session after sign-in:", error);
      }

      void (async () => {
        try {
          const remoteState = await loadDeskState();
          if (cancelled) return;
          const state = ensureMinimumDeskData(remoteState ?? createInitialState());
          useDeskStore.getState().replaceAll(state);
          if (!remoteState || state !== remoteState) {
            await saveDeskState({ data: deskSnapshot() });
          }
          if (cancelled) return;
          setLoadedUserId(userId);
          setSyncStatus("saved");
        } catch (error) {
          if (cancelled) return;
          console.error("[desk-sync] failed to load desk data:", error);
          const message = error instanceof Error ? error.message : "Could not connect to secure storage.";
          setLoadError({ userId, message });
          setSyncStatus("error");
        }
      })();

      return () => {
        cancelled = true;
      };
    }

    let cancelled = false;
    const fallback = setTimeout(() => {
      if (cancelled) return;
      useDeskStore.getState().bootstrapIfNeeded();
      const state = useDeskStore.getState();
      const normalized = ensureMinimumDeskData(state);
      if (normalized !== state) useDeskStore.getState().replaceAll(normalized);
      setLocalReady(true);
    }, 1500);

    void (async () => {
      try {
        await useDeskStore.persist.rehydrate();
      } catch (error) {
        console.error("[desk-sync] failed to restore local desk data:", error);
        toast.error("Could not restore the saved desk from this browser.");
      } finally {
        if (!cancelled) {
          useDeskStore.getState().bootstrapIfNeeded();
          const state = useDeskStore.getState();
          const normalized = ensureMinimumDeskData(state);
          if (normalized !== state) useDeskStore.getState().replaceAll(normalized);
          setLocalReady(true);
          clearTimeout(fallback);
        }
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(fallback);
    };
  }, [userId, isPending, retryCount, guestSession]);

  useEffect(() => {
    if (!authEnabled || !userId || loadedUserId !== userId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    let saveQueue = Promise.resolve();

    const unsubscribe = useDeskStore.subscribe(() => {
      if (timer) clearTimeout(timer);
      setSyncStatus("saving");
      timer = setTimeout(() => {
        const snapshot = deskSnapshot();
        saveQueue = saveQueue
          .catch(() => undefined)
          .then(async () => {
            await saveDeskState({ data: snapshot });
            if (!cancelled) setSyncStatus("saved");
          })
          .catch((error: unknown) => {
            if (cancelled) return;
            console.error("[desk-sync] failed to save desk data:", error);
            setSyncStatus("error");
            toast.error("Could not sync your latest changes. Check your connection and try again.");
          });
      }, 400);
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [userId, loadedUserId]);

  const isLoginRoute = pathname === "/login";
  const isReady = authEnabled
    ? userId
      ? loadedUserId === userId
      : isLoginRoute || (guestSession && localReady)
    : localReady;
  const currentLoadError = userId && loadError?.userId === userId ? loadError : null;

  let content: React.ReactNode;
  if (authEnabled && isPending) {
    content = <LoadingDesk />;
  } else if (authEnabled && !user && !isLoginRoute && !guestSession) {
    content = <RedirectToSignIn />;
  } else if (currentLoadError) {
    content = (
      <main className="grid min-h-dvh place-items-center bg-background p-6 text-foreground">
        <section className="w-full max-w-md rounded-2xl border border-down/25 bg-card/80 p-6 text-center">
          <h1 className="font-display text-2xl">Desk sync unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your private desk could not be loaded from the backend.
          </p>
          <p className="mt-2 break-words text-xs text-down/90">{currentLoadError.message}</p>
          <Button className="mt-5" onClick={() => setRetryCount((count) => count + 1)}>
            Retry connection
          </Button>
        </section>
      </main>
    );
  } else if (!isReady) {
    content = <LoadingDesk />;
  } else {
    content = (
      <>
        {guestSession ? (
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-b border-warn/25 bg-warn/[0.07] px-4 py-2 text-center text-[11px] text-warn">
            <span>Demo mode · saved only in this browser; cloud sync is off.</span>
            <a href="/login" className="font-semibold underline underline-offset-2">
              Sign in to sync your private desk
            </a>
          </div>
        ) : null}
        {children}
      </>
    );
  }

  return <DeskSyncContext.Provider value={syncStatus}>{content}</DeskSyncContext.Provider>;
}

function LoadingDesk() {
  return (
    <div className="flex min-h-dvh bg-background p-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <p className="font-display text-2xl text-foreground">First Payout</p>
        <p className="text-sm text-muted-foreground">Connecting your private desk…</p>
        <Skeleton className="h-12 w-48" />
        <div className="grid gap-3 sm:grid-cols-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}
