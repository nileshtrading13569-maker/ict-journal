import { createFileRoute } from "@tanstack/react-router";
import { directGoogleConfigured } from "@/lib/auth/server";

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
          { google: directGoogleConfigured },
          { headers: { "cache-control": "no-store" } },
        ),
    },
  },
});
