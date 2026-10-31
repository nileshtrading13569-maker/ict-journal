import { createFileRoute } from "@tanstack/react-router";
import { handleSignaling } from "@/lib/multiplayer/backend";

const handle = ({ request }: { request: Request }) => handleSignaling(request);

export const Route = createFileRoute("/api/rtc")({
  server: { handlers: { GET: handle, POST: handle } },
});
