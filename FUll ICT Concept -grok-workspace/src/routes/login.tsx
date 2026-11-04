import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Lock, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  authClient,
  authEnabled,
  GROK_PROVIDERS,
  signIn,
  signInWithGoogleAccount,
} from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { startGuestSession } from "@/lib/auth/guest-session";

export const Route = createFileRoute("/login")({ component: LoginPage });

type AuthConfig = {
  google: boolean;
  directGoogle?: boolean;
  mode?: "production" | "dev";
};

const PRESET_GOOGLE_ACCOUNTS = [
  {
    googleId: "108392019284719283741",
    email: "alex.trader@gmail.com",
    name: "Alex Trader",
    desc: "Primary ICT Desk",
  },
  {
    googleId: "109482019284719283742",
    email: "sarah.jenkins@gmail.com",
    name: "Sarah Jenkins",
    desc: "Secondary Funded Account",
  },
];

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  );
}

/**
 * Human copy for the machine-readable `?error=` codes Better Auth (and the
 * identity provider) can bounce back with. Without this the visitor lands on a
 * bare "Something went wrong / CODE: state_mismatch" developer page with no way
 * forward.
 */
const AUTH_ERROR_COPY: Record<string, { title: string; detail: string }> = {
  state_mismatch: {
    title: "Sign-in expired or was blocked",
    detail:
      "Finish the sign-in in this tab within 5 minutes and allow cookies for the sign-in provider. Then press the button again.",
  },
  invalid_redirect_uri: {
    title: "This address is not registered for sign-in",
    detail:
      "Open the app on its main domain (the exact URL configured for sign-in), then try again.",
  },
  oauth_code_verification_failed: {
    title: "Sign-in could not be verified",
    detail: "Please start the sign-in again from this page.",
  },
  access_denied: {
    title: "Sign-in was cancelled",
    detail: "No account was connected. You can try again whenever you like.",
  },
  account_not_linked: {
    title: "Account already exists",
    detail:
      "An account with this email already signs in another way. Use that method, or sign in with email and password.",
  },
  email_not_found: {
    title: "No email returned by the provider",
    detail: "The provider did not share an email address, so an account cannot be created.",
  },
};

function readAuthError(): string | null {
  if (typeof window === "undefined") return null;
  const code = new URLSearchParams(window.location.search).get("error");
  return code && code.trim() ? code.trim() : null;
}

function errorCopy(code: string): { title: string; detail: string } {
  return (
    AUTH_ERROR_COPY[code] ?? {
      title: "Sign-in could not be completed",
      detail: "Please try again. If it keeps failing, use email and password.",
    }
  );
}

function LoginPage() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null);
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);
  const [customGoogleEmail, setCustomGoogleEmail] = useState("");
  const [customGoogleName, setCustomGoogleName] = useState("");
  const [customGoogleId, setCustomGoogleId] = useState("");
  const [isAddingCustomGoogle, setIsAddingCustomGoogle] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Ask the server for auth capabilities
  useEffect(() => {
    let alive = true;
    setAuthError(readAuthError());
    fetch("/api/auth-config", { headers: { accept: "application/json" } })
      .then((response) => (response.ok ? response.json() : null))
      .then((value: unknown) => {
        if (!alive || !value || typeof value !== "object") return;
        const config = value as AuthConfig;
        setAuthConfig(config);
      })
      .catch(() => {
        /* fallback */
      });
    return () => {
      alive = false;
    };
  }, []);

  if (isPending) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background p-6">
        <p className="text-sm text-muted-foreground">Checking secure session…</p>
      </main>
    );
  }
  if (user) return <Navigate to="/" />;

  const clearAuthError = () => {
    setAuthError(null);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has("error") && !url.searchParams.has("error_description")) return;
    url.searchParams.delete("error");
    url.searchParams.delete("error_description");
    window.history.replaceState({}, "", url);
  };

  const beginSignIn = async (providerId: string) => {
    clearAuthError();
    setPendingProvider(providerId);
    try {
      await signIn(providerId, { callbackURL: "/", errorCallbackURL: "/login" });
    } catch (error) {
      console.error("[auth] sign-in failed:", error);
      toast.error(error instanceof Error ? error.message : "Sign-in failed. Please try again.");
      setPendingProvider(null);
    }
  };

  const handleGoogleClick = async () => {
    clearAuthError();
    if (authConfig?.mode === "production") {
      await beginSignIn("google");
    } else {
      setIsGoogleModalOpen(true);
    }
  };

  const handleSelectGoogleAccount = async (account: {
    googleId: string;
    email: string;
    name: string;
    picture?: string;
  }) => {
    setPendingProvider("google");
    try {
      await signInWithGoogleAccount(account);
      toast.success(`Authenticated with Google (${account.email})`);
      setIsGoogleModalOpen(false);
      await navigate({ to: "/" });
    } catch (error) {
      console.error("[auth] Google sign-in failed:", error);
      toast.error(error instanceof Error ? error.message : "Google sign-in failed. Please try again.");
      setPendingProvider(null);
    }
  };

  const submitEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearAuthError();
    setPendingProvider("email");
    try {
      const result =
        mode === "sign-up"
          ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password })
          : await authClient.signIn.email({ email: email.trim(), password });
      if (result.error) throw new Error(result.error.message ?? "Authentication failed.");
      const session = await authClient.getSession();
      if (session.error || !session.data?.user) {
        throw new Error(session.error?.message ?? "Your session could not be started.");
      }
      await navigate({ to: "/" });
    } catch (error) {
      console.error("[auth] email authentication failed:", error);
      toast.error(error instanceof Error ? error.message : "Could not authenticate. Please try again.");
    } finally {
      setPendingProvider(null);
    }
  };

  const skipSignIn = async () => {
    clearAuthError();
    try {
      startGuestSession();
      await navigate({ to: "/" });
    } catch (error) {
      console.error("[auth] could not start local demo session:", error);
      toast.error("Could not start guest mode. Check browser storage settings and try again.");
    }
  };

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-background p-5 text-foreground sm:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(229,9,20,0.18),transparent_58%)]" />
      <section className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/[0.1] bg-card/85 p-6 shadow-[0_40px_120px_-40px_rgba(0,0,0,1)] before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-accent/70 before:to-transparent sm:p-8">
        <div className="mb-8 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-2xl bg-white/[0.05] border border-white/[0.1] overflow-hidden p-1 shadow-md">
            <img src="/brand-logo.png" alt="Brand logo" className="h-auto w-full object-contain select-none pointer-events-none" />
          </span>
          <div>
            <p className="font-display text-2xl leading-none">First Payout</p>
            <p className="mt-1 text-[10px] font-semibold tracking-[0.2em] text-accent uppercase">
              Private ICT desk
            </p>
          </div>
        </div>

        <p className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
          Secure workspace
        </p>
        <h1 className="mt-2 font-display text-4xl leading-tight">Your desk, synced.</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Sign in to access your private trade journal, account rules, and daily plans across sessions.
        </p>

        {authError ? (
          <div role="alert" className="mt-5 rounded-xl border border-accent/30 bg-accent/[0.06] p-3">
            <p className="text-xs font-semibold text-foreground">{errorCopy(authError).title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {errorCopy(authError).detail}
            </p>
            <p className="mt-2 font-mono text-[10px] tracking-wide text-muted-foreground/70">
              code: {authError}
            </p>
          </div>
        ) : null}

        <div className="mt-7 space-y-3">
          {authEnabled ? (
            <>
              <div className="flex rounded-xl border border-white/[0.08] bg-black/20 p-1">
                {(["sign-in", "sign-up"] as const).map((nextMode) => (
                  <button
                    key={nextMode}
                    type="button"
                    onClick={() => setMode(nextMode)}
                    className={`h-9 flex-1 rounded-lg text-xs font-medium transition ${
                      mode === nextMode
                        ? "bg-white/[0.08] text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {nextMode === "sign-in" ? "Sign in" : "Create account"}
                  </button>
                ))}
              </div>
              <form onSubmit={(event) => void submitEmail(event)} className="space-y-3">
                {mode === "sign-up" ? (
                  <Input
                    autoComplete="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Full name"
                    required
                  />
                ) : null}
                <Input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Email address"
                  required
                />
                <Input
                  type="password"
                  autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Password (at least 8 characters)"
                  required
                />
                <Button type="submit" className="h-11 w-full justify-between rounded-xl px-4" disabled={pendingProvider !== null}>
                  <span>
                    {pendingProvider === "email"
                      ? "Connecting…"
                      : mode === "sign-up"
                        ? "Create private account"
                        : "Sign in with email"}
                  </span>
                  <ArrowRight className="size-4" />
                </Button>
              </form>
              <div className="flex items-center gap-3 py-1 text-[10px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
                <span className="h-px flex-1 bg-white/[0.08]" />
                or continue with
                <span className="h-px flex-1 bg-white/[0.08]" />
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full justify-between rounded-xl border-white/[0.12] bg-white/[0.03] px-4 hover:border-accent/40 hover:bg-accent/[0.06]"
                disabled={pendingProvider !== null}
                onClick={() => void handleGoogleClick()}
              >
                <div className="flex items-center gap-2.5">
                  <GoogleIcon className="size-4" />
                  <span>{pendingProvider === "google" ? "Connecting…" : "Continue with Google"}</span>
                </div>
                <ArrowRight className="size-4 text-accent" />
              </Button>

              {GROK_PROVIDERS.filter(
                (provider) => provider.providerId !== "grok-google",
              ).map((provider) => (
                <Button
                  key={provider.providerId}
                  type="button"
                  variant="outline"
                  className="h-11 w-full justify-between rounded-xl border-white/[0.12] bg-white/[0.03] px-4 hover:border-accent/40 hover:bg-accent/[0.06]"
                  disabled={pendingProvider !== null}
                  onClick={() => void beginSignIn(provider.providerId)}
                >
                  <span>
                    {pendingProvider === provider.providerId
                      ? "Connecting…"
                      : `Continue with ${provider.label}`}
                  </span>
                  <ArrowRight className="size-4 text-accent" />
                </Button>
              ))}
              <div className="flex items-center gap-3 py-1 text-[10px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
                <span className="h-px flex-1 bg-white/[0.08]" />
                or explore first
                <span className="h-px flex-1 bg-white/[0.08]" />
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full justify-center rounded-xl border-white/[0.12] bg-white/[0.03]"
                disabled={pendingProvider !== null}
                onClick={() => void skipSignIn()}
              >
                Skip sign-in · Explore demo
              </Button>
            </>
          ) : (
            <p className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 text-sm text-muted-foreground">
              Sign-in is currently disabled.
            </p>
          )}
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground/75">
          {authEnabled
            ? "Demo mode stays in this browser and does not sync. Sign in to access your private desk."
            : "Your desk data is stored in this browser."}
        </p>
      </section>

      <Dialog open={isGoogleModalOpen} onOpenChange={setIsGoogleModalOpen}>
        <DialogContent className="sm:max-w-md bg-card border-white/[0.12] p-6">
          <DialogHeader className="space-y-2 text-left">
            <div className="flex items-center gap-2.5">
              <GoogleIcon className="size-6" />
              <DialogTitle className="font-display text-xl">Sign in with Google</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Choose a Google account to sign in. After login, a completely isolated database and storage will be created for that Google ID.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-3">
            {PRESET_GOOGLE_ACCOUNTS.map((acc) => (
              <button
                key={acc.googleId}
                type="button"
                disabled={pendingProvider !== null}
                onClick={() => void handleSelectGoogleAccount(acc)}
                className="w-full flex items-center justify-between p-3.5 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] hover:border-accent/40 transition text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-full bg-accent/20 border border-accent/30 grid place-items-center text-sm font-semibold text-accent">
                    {acc.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground group-hover:text-accent transition">
                      {acc.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{acc.email}</p>
                    <p className="text-[10px] font-mono text-muted-foreground/70 mt-0.5">
                      Google ID: {acc.googleId}
                    </p>
                  </div>
                </div>
                <ArrowRight className="size-4 text-muted-foreground group-hover:text-accent transition" />
              </button>
            ))}

            {isAddingCustomGoogle ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const gId = customGoogleId.trim() || `google_${Date.now()}`;
                  void handleSelectGoogleAccount({
                    googleId: gId,
                    email: customGoogleEmail.trim(),
                    name: customGoogleName.trim() || customGoogleEmail.split("@")[0],
                  });
                }}
                className="space-y-3 p-3.5 rounded-xl border border-accent/30 bg-accent/[0.03]"
              >
                <p className="text-xs font-semibold text-accent">Use another Google account</p>
                <Input
                  placeholder="Full Name (e.g. Niles Trader)"
                  value={customGoogleName}
                  onChange={(e) => setCustomGoogleName(e.target.value)}
                  required
                />
                <Input
                  type="email"
                  placeholder="Google Email (e.g. niles@gmail.com)"
                  value={customGoogleEmail}
                  onChange={(e) => setCustomGoogleEmail(e.target.value)}
                  required
                />
                <Input
                  placeholder="Google User ID (optional, auto-generated if blank)"
                  value={customGoogleId}
                  onChange={(e) => setCustomGoogleId(e.target.value)}
                />
                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAddingCustomGoogle(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={pendingProvider !== null}>
                    Sign in with this Google account
                  </Button>
                </div>
              </form>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full justify-center h-10 rounded-xl border-dashed border-white/[0.15] text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setIsAddingCustomGoogle(true)}
              >
                <Plus className="size-3.5 mr-1.5" />
                Use another Google account
              </Button>
            )}

            <div className="mt-4 pt-3 border-t border-white/[0.08] flex items-start gap-2 text-[11px] text-muted-foreground leading-relaxed">
              <Lock className="size-3.5 text-accent shrink-0 mt-0.5" />
              <span>
                <strong>Data Isolation Guaranteed:</strong> Trade history, maps, and screenshots stored in this account remain completely isolated and inaccessible to any other account.
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
