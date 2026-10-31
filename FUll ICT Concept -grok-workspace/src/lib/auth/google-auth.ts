import type { BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint } from "better-auth/api";
import { parseSetCookieHeader, setSessionCookie } from "better-auth/cookies";
import { handleOAuthUserInfo } from "better-auth/oauth2";
import { z } from "zod";

const LOG = "[google-auth]";

/**
 * Emit signed session cookie through both TanStack Start response cookie store
 * and Better Auth responseHeaders bag.
 */
async function emitSessionCookie(
  ctx: any,
  sessionTokenName: string,
  sessionToken: string,
): Promise<string | null> {
  const attributes = ctx.context.authCookies.sessionToken.attributes;
  const maxAge = ctx.context.sessionConfig.expiresIn;
  const cookieOptions = {
    ...attributes,
    maxAge,
  };

  let signedCookie: string;
  try {
    signedCookie = await ctx.setSignedCookie(
      sessionTokenName,
      sessionToken,
      ctx.context.secret,
      cookieOptions,
    );
  } catch (err) {
    console.error(`${LOG} setSignedCookie failed:`, err);
    return null;
  }

  const sessionValue = parseSetCookieHeader(signedCookie).get(sessionTokenName)?.value;
  if (!sessionValue) {
    console.error(`${LOG} signed Set-Cookie missing session token value`);
    return null;
  }

  // Primary path: TanStack Start's response cookie store (reaches browser)
  try {
    const { setCookie } = await import("@tanstack/react-start/server");
    setCookie(sessionTokenName, sessionValue, {
      path: cookieOptions.path ?? "/",
      httpOnly: cookieOptions.httpOnly ?? true,
      secure: cookieOptions.secure ?? false,
      sameSite: (cookieOptions.sameSite as "lax" | "strict" | "none") ?? "lax",
      maxAge: typeof maxAge === "number" ? maxAge : undefined,
      domain: cookieOptions.domain,
    });
  } catch (err: any) {
    if (!err?.message?.includes("No StartEvent found in AsyncLocalStorage")) {
      console.error(`${LOG} TanStack setCookie failed:`, err);
    }
  }

  // Append to Better Auth responseHeaders so after-hooks can forward it
  try {
    const responseHeaders = ctx.context.responseHeaders;
    if (responseHeaders) {
      responseHeaders.append("set-cookie", signedCookie);
    }
  } catch (err) {
    console.error(`${LOG} responseHeaders.append failed:`, err);
  }

  return sessionValue;
}

/**
 * Better Auth plugin providing direct Google OAuth authentication endpoint for local
 * multi-user development and testing without requiring external broker callbacks.
 */
export function googleDevAuthPlugin(): BetterAuthPlugin {
  return {
    id: "google-dev-auth",
    endpoints: {
      devGoogleSignIn: createAuthEndpoint(
        "/google/dev-signin",
        {
          method: "POST",
          body: z.object({
            googleId: z.string().min(1, "Google ID is required"),
            email: z.string().email("Valid Google email is required"),
            name: z.string().min(1, "Name is required"),
            picture: z.string().optional(),
          }),
        },
        async (ctx) => {
          const { googleId, email, name, picture } = ctx.body;
          const normalizedEmail = email.trim().toLowerCase();
          const cleanGoogleId = googleId.trim();

          const result: any = await handleOAuthUserInfo(ctx as any, {
            userInfo: {
              id: cleanGoogleId,
              email: normalizedEmail,
              name: name.trim(),
              image: picture?.trim() || null,
              emailVerified: true,
            },
            account: {
              providerId: "google",
              accountId: cleanGoogleId,
            },
          });

          if (result.error || !result.data) {
            console.error(`${LOG} handleOAuthUserInfo failed:`, result.error);
            const message =
              typeof result.error === "string"
                ? result.error
                : (result.error as any)?.message ?? "Google authentication failed";
            throw ctx.json(
              { error: message },
              { status: 400 },
            );
          }

          // Persist session rows
          await setSessionCookie(ctx, result.data);

          const sessionCookieName = ctx.context.authCookies.sessionToken.name;
          await emitSessionCookie(ctx, sessionCookieName, result.data.session.token);

          // Eagerly initialize the user's isolated database environment
          try {
            const { loadUserDatabase } = await import("../storage/user-database.server.ts");
            await loadUserDatabase(result.data.user.id);
          } catch (initErr) {
            console.warn(`${LOG} eager user database provision notice:`, initErr);
          }

          return ctx.json({
            ok: true,
            user: result.data.user,
            session: result.data.session,
            token: result.data.session.token,
            googleUserId: cleanGoogleId,
          });
        },
      ),
    },
  };
}
