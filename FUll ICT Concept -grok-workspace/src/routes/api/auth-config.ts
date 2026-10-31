import { createFileRoute } from "@tanstack/react-router";
const directGoogleConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim(),
);

/**
 * Public, non-secret auth capabilities for the login screen. The client cannot
 * read server env vars, so this tells it whether to offer first-party Google
 * (`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` set) instead of the broker button.
 */
export const Route = createFileRoute("/api/auth-config")({
  server: {
    handlers: {
      GET: () =>
        Response.json(
          {
            google: true,
            directGoogle: directGoogleConfigured,
            mode: directGoogleConfigured ? "production" : "dev",
          },
          { headers: { "cache-control": "no-store" } },
        ),
    },
  },
});
