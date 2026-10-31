import { useState, type FormEvent } from "react";
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient, authEnabled, GROK_PROVIDERS, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { startGuestSession } from "@/lib/auth/guest-session";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (isPending) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background p-6">
        <p className="text-sm text-muted-foreground">Checking secure session…</p>
      </main>
    );
  }
  if (user) return <Navigate to="/" />;

  const beginSignIn = async (providerId: string) => {
    setPendingProvider(providerId);
    try {
      await signIn(providerId, { callbackURL: "/" });
    } catch (error) {
      console.error("[auth] sign-in failed:", error);
      toast.error(error instanceof Error ? error.message : "Sign-in failed. Please try again.");
      setPendingProvider(null);
    }
  };

  const submitEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
          <span className="grid size-10 place-items-center rounded-sm bg-accent text-primary-foreground">
            <ShieldCheck className="size-5" />
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
              {GROK_PROVIDERS.map((provider) => (
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
    </main>
  );
}
