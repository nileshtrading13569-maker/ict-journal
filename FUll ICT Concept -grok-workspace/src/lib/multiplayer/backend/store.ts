import { getSql, type Sql } from "@/lib/db";
import { ensureSchema, PEER_TTL_SECONDS, SIGNAL_TTL_SECONDS } from "./schema";
import type { PeerRow, RoomStats, SignalKind, SignalRow } from "./types";

// ── In-Memory Fallback Store (Used if Database is unavailable or in offline dev) ──
interface MemPeer {
  id: string;
  name: string;
  lastSeen: number;
}

interface MemSignal {
  id: number;
  room: string;
  to: string;
  from: string;
  kind: SignalKind;
  payload: unknown;
  createdAt: number;
}

class MemoryStore {
  private peers = new Map<string, Map<string, MemPeer>>(); // room -> peerId -> MemPeer
  private signals: MemSignal[] = [];
  private nextSignalId = 1;

  touchPeer(room: string, peerId: string, name: string): void {
    let roomPeers = this.peers.get(room);
    if (!roomPeers) {
      roomPeers = new Map();
      this.peers.set(room, roomPeers);
    }
    roomPeers.set(peerId, { id: peerId, name, lastSeen: Date.now() });
  }

  getRoster(room: string, ttlMs = PEER_TTL_SECONDS * 1000): PeerRow[] {
    const roomPeers = this.peers.get(room);
    if (!roomPeers) return [];
    const now = Date.now();
    const active: PeerRow[] = [];
    for (const [id, peer] of roomPeers.entries()) {
      if (now - peer.lastSeen <= ttlMs) {
        active.push({ id: peer.id, name: peer.name });
      } else {
        roomPeers.delete(id);
      }
    }
    return active.sort((a, b) => a.id.localeCompare(b.id)).slice(0, 32);
  }

  removePeer(room: string, peerId: string): void {
    const roomPeers = this.peers.get(room);
    if (roomPeers) {
      roomPeers.delete(peerId);
      if (roomPeers.size === 0) this.peers.delete(room);
    }
  }

  pushSignal(
    room: string,
    from: string,
    to: string,
    kind: SignalKind,
    payload: unknown,
  ): void {
    this.signals.push({
      id: this.nextSignalId++,
      room,
      from,
      to,
      kind,
      payload,
      createdAt: Date.now(),
    });
  }

  pollSignals(room: string, peerId: string, since: number): SignalRow[] {
    const matching = this.signals.filter(
      (s) => s.room === room && s.to === peerId && s.id > since,
    );
    return matching.slice(0, 200).map((s) => ({
      id: s.id,
      from: s.from,
      kind: s.kind,
      payload: s.payload,
    }));
  }

  prune(ttlPeerMs = PEER_TTL_SECONDS * 1000, ttlSignalMs = SIGNAL_TTL_SECONDS * 1000): void {
    const now = Date.now();
    for (const [room, roomPeers] of this.peers.entries()) {
      for (const [id, peer] of roomPeers.entries()) {
        if (now - peer.lastSeen > ttlPeerMs) roomPeers.delete(id);
      }
      if (roomPeers.size === 0) this.peers.delete(room);
    }
    this.signals = this.signals.filter((s) => now - s.createdAt <= ttlSignalMs);
  }

  getStats(room: string): RoomStats {
    const roster = this.getRoster(room);
    const roomSignals = this.signals.filter((s) => s.room === room);
    return {
      room,
      peerCount: roster.length,
      activeSignals: roomSignals.length,
      lastActivity: roomSignals.length > 0 ? new Date(roomSignals[roomSignals.length - 1].createdAt) : null,
    };
  }
}

const memStore = new MemoryStore();

// ── Database Operations ──

async function getSqlWithSchema(): Promise<Sql> {
  const sql = await getSql();
  await ensureSchema(sql);
  return sql;
}

export async function touchPeer(
  room: string,
  peerId: string,
  name: string,
): Promise<void> {
  try {
    const sql = await getSqlWithSchema();
    await sql.query(
      `INSERT INTO webrtc_peers (room, peer_id, name, last_seen)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (room, peer_id)
       DO UPDATE SET last_seen = now(), name = EXCLUDED.name`,
      [room, peerId, name],
    );
  } catch (err) {
    console.warn("[multiplayer/store] Database touchPeer fallback to memory:", err);
    memStore.touchPeer(room, peerId, name);
  }
}

export async function getRoster(
  room: string,
  ttlSeconds = PEER_TTL_SECONDS,
): Promise<PeerRow[]> {
  try {
    const sql = await getSqlWithSchema();
    const rows = await sql.query<{ peer_id: string; name: string }>(
      `SELECT peer_id, name FROM webrtc_peers
       WHERE room = $1 AND last_seen > now() - make_interval(secs => $2)
       ORDER BY peer_id LIMIT 32`,
      [room, ttlSeconds],
    );
    return rows.map((r) => ({ id: r.peer_id, name: r.name }));
  } catch (err) {
    console.warn("[multiplayer/store] Database getRoster fallback to memory:", err);
    return memStore.getRoster(room, ttlSeconds * 1000);
  }
}

export async function removePeer(room: string, peerId: string): Promise<void> {
  try {
    const sql = await getSqlWithSchema();
    await sql.query(`DELETE FROM webrtc_peers WHERE room = $1 AND peer_id = $2`, [
      room,
      peerId,
    ]);
  } catch (err) {
    console.warn("[multiplayer/store] Database removePeer fallback to memory:", err);
    memStore.removePeer(room, peerId);
  }
}

export async function pushSignal(
  room: string,
  from: string,
  to: string,
  kind: SignalKind,
  payload: unknown,
): Promise<void> {
  try {
    const sql = await getSqlWithSchema();
    await sql.query(
      `INSERT INTO webrtc_signals (room, to_peer, from_peer, kind, payload)
       VALUES ($1, $2, $3, $4, $5)`,
      [room, to, from, kind, JSON.stringify(payload)],
    );
  } catch (err) {
    console.warn("[multiplayer/store] Database pushSignal fallback to memory:", err);
    memStore.pushSignal(room, from, to, kind, payload);
  }
}

export async function pollSignals(
  room: string,
  peerId: string,
  since: number,
): Promise<SignalRow[]> {
  try {
    const sql = await getSqlWithSchema();
    const rows = await sql.query<{
      id: number;
      from_peer: string;
      kind: SignalKind;
      payload: unknown;
    }>(
      `SELECT id, from_peer, kind, payload FROM webrtc_signals
       WHERE room = $1 AND to_peer = $2 AND id > $3
       ORDER BY id LIMIT 200`,
      [room, peerId, since],
    );
    return rows.map((r) => ({
      id: r.id,
      from: r.from_peer,
      kind: r.kind,
      payload: r.payload,
    }));
  } catch (err) {
    console.warn("[multiplayer/store] Database pollSignals fallback to memory:", err);
    return memStore.pollSignals(room, peerId, since);
  }
}

export async function pruneStale(
  ttlPeerSecs = PEER_TTL_SECONDS,
  ttlSignalSecs = SIGNAL_TTL_SECONDS,
): Promise<void> {
  try {
    const sql = await getSqlWithSchema();
    await Promise.all([
      sql.query(
        `DELETE FROM webrtc_signals WHERE created_at < now() - make_interval(secs => $1)`,
        [ttlSignalSecs],
      ),
      sql.query(
        `DELETE FROM webrtc_peers WHERE last_seen < now() - make_interval(secs => $1)`,
        [ttlPeerSecs],
      ),
    ]);
  } catch (err) {
    console.warn("[multiplayer/store] Database prune fallback to memory:", err);
    memStore.prune(ttlPeerSecs * 1000, ttlSignalSecs * 1000);
  }
}

export async function getRoomStats(room: string): Promise<RoomStats> {
  try {
    const roster = await getRoster(room);
    const sql = await getSqlWithSchema();
    const countRows = await sql.query<{ count: number }>(
      `SELECT count(*)::int as count FROM webrtc_signals WHERE room = $1`,
      [room],
    );
    return {
      room,
      peerCount: roster.length,
      activeSignals: countRows[0]?.count ?? 0,
      lastActivity: new Date(),
    };
  } catch {
    return memStore.getStats(room);
  }
}
