import {
  getRoster,
  pollSignals,
  pruneStale,
  pushSignal,
  removePeer,
  touchPeer,
} from "./store";
import {
  PollQuerySchema,
  PostOpSchema,
  type RtcPollResponse,
} from "./types";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, no-cache, must-revalidate",
    },
  });
}

/**
 * Handles GET /api/rtc?room&peer&name&since
 * Used for:
 * 1. Joining a room (since=0)
 * 2. Heartbeat to keep peer alive in roster
 * 3. Polling incoming signals (offer, answer, ICE candidates)
 */
export async function handleGet(url: URL): Promise<Response> {
  const parsed = PollQuerySchema.safeParse({
    room: url.searchParams.get("room"),
    peer: url.searchParams.get("peer"),
    name: url.searchParams.get("name") ?? "",
    since: url.searchParams.get("since") ?? 0,
  });

  if (!parsed.success) {
    return jsonResponse(
      {
        error: "invalid query parameters",
        details: parsed.error.flatten().fieldErrors,
      },
      400,
    );
  }

  const { room, peer, name, since } = parsed.data;

  // 1. Join / Periodic GC:
  // Clean up stale rows on first join (since=0) or probabilistically during polls
  if (since === 0 || Math.random() < 0.02) {
    await pruneStale();
  }

  // 2. Keep this peer alive in the roster
  await touchPeer(room, peer, name);

  // 3. Query roster and new signals concurrently
  const [peers, signals] = await Promise.all([
    getRoster(room),
    pollSignals(room, peer, since),
  ]);

  const body: RtcPollResponse = {
    peers,
    signals,
  };

  return jsonResponse(body);
}

/**
 * Handles POST /api/rtc
 * Used for:
 * 1. op: "signal" - send WebRTC offer, answer, or ICE candidate to a specific remote peer
 * 2. op: "leave" - remove peer from the active room roster immediately
 */
export async function handlePost(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "malformed JSON body" }, 400);
  }

  const parsed = PostOpSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse(
      {
        error: "invalid request payload",
        details: parsed.error.flatten().fieldErrors,
      },
      400,
    );
  }

  const msg = parsed.data;

  if (msg.op === "signal") {
    await pushSignal(msg.room, msg.from, msg.to, msg.kind, msg.payload);
    return jsonResponse({ ok: true });
  }

  if (msg.op === "leave") {
    await removePeer(msg.room, msg.peer);
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ error: "unhandled operation" }, 400);
}

/**
 * Main request router for /api/rtc signaling endpoint.
 */
export async function handleSignaling(request: Request): Promise<Response> {
  try {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "allow": "GET, POST, OPTIONS",
          "access-control-allow-methods": "GET, POST, OPTIONS",
          "access-control-allow-headers": "content-type",
        },
      });
    }

    if (request.method === "GET") {
      return await handleGet(new URL(request.url));
    }

    if (request.method === "POST") {
      return await handlePost(request);
    }

    return jsonResponse({ error: `method ${request.method} not allowed` }, 405);
  } catch (error) {
    console.error("[rtc/signaling] Unexpected error in signaling handler:", error);
    return jsonResponse({ error: "internal signaling relay error" }, 500);
  }
}
