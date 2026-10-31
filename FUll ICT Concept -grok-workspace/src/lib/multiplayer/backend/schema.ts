import type { Sql } from "@/lib/db";

export const PEER_TTL_SECONDS = 30;
export const SIGNAL_TTL_SECONDS = 60;

const globalRef = globalThis as typeof globalThis & {
  __rtcSchemaPromise__?: Promise<void>;
};

/**
 * Ensures required database tables and indexes exist on first use.
 * Memoized across HMR reloads on globalThis.
 */
export function ensureSchema(sql: Sql): Promise<void> {
  globalRef.__rtcSchemaPromise__ ??= (async () => {
    // 1. Table for tracking online peers per room
    await sql.query(
      `CREATE TABLE IF NOT EXISTS webrtc_peers (
         room TEXT NOT NULL,
         peer_id TEXT NOT NULL,
         name TEXT NOT NULL DEFAULT '',
         last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
         PRIMARY KEY (room, peer_id)
       );`,
    );

    // 2. Index for room roster pruning & lookups
    await sql.query(
      `CREATE INDEX IF NOT EXISTS webrtc_peers_lookup
         ON webrtc_peers (room, last_seen);`,
    );

    // 3. Table for buffering ephemeral WebRTC signals (offer, answer, ICE candidates)
    await sql.query(
      `CREATE TABLE IF NOT EXISTS webrtc_signals (
         id BIGSERIAL PRIMARY KEY,
         room TEXT NOT NULL,
         to_peer TEXT NOT NULL,
         from_peer TEXT NOT NULL,
         kind TEXT NOT NULL,
         payload JSONB NOT NULL,
         created_at TIMESTAMPTZ NOT NULL DEFAULT now()
       );`,
    );

    // 4. Index for fast peer inbox polling
    await sql.query(
      `CREATE INDEX IF NOT EXISTS webrtc_signals_inbox
         ON webrtc_signals (room, to_peer, id);`,
    );

    // 5. Index for signal TTL expiration
    await sql.query(
      `CREATE INDEX IF NOT EXISTS webrtc_signals_created_at
         ON webrtc_signals (created_at);`,
    );
  })().catch((err) => {
    globalRef.__rtcSchemaPromise__ = undefined;
    throw err;
  });

  return globalRef.__rtcSchemaPromise__;
}
