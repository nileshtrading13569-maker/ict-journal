export type SignalKind = "offer" | "answer" | "ice";

export interface PeerRow {
  id: string;
  name: string;
}

export interface SignalRow {
  id: number;
  from: string;
  kind: SignalKind;
  payload: unknown;
}

export interface RtcPollResponse {
  peers: PeerRow[];
  signals: SignalRow[];
}

export interface PeerInfo {
  id: string;
  name: string;
  connectionState: RTCPeerConnectionState;
  /** Selected local ICE candidate type: host | srflx | prflx | relay. */
  candidateType: string | null;
  /** Data-channel ping RTT (ms), measured every 2s once connected. */
  rttMs: number | null;
}

export interface P2PRoomOptions {
  room: string;
  selfId: string;
  name?: string;
  /** Defaults to VITE_STUN_URLS (comma-separated) or Google public STUN. */
  iceServers?: RTCIceServer[];
  onPeersChanged?: (peers: PeerInfo[]) => void;
  /** Fires for both the unreliable "state" and reliable "reliable" channels. */
  onMessage?: (from: string, data: unknown, channel: "state" | "reliable") => void;
  /** Fires once, on the first successful signaling poll (registration). */
  onConnected?: () => void;
}

export interface UseP2PRoomOptions {
  /** Defaults to a per-deployment room derived from the hostname. */
  room?: string;
  name?: string;
}

export interface P2PRoomHandle {
  selfId: string;
  room: string;
  /** Remote peers only (self excluded), with live connection diagnostics. */
  peers: PeerInfo[];
  joined: boolean;
  /** Unreliable game-state fanout to every connected peer. */
  broadcast: (data: unknown) => void;
  /** Reliable ordered send to one peer (or all when peerId is omitted). */
  send: (data: unknown, peerId?: string) => void;
  /** Subscribe to incoming messages; returns an unsubscribe function. */
  onMessage: (
    fn: (from: string, data: unknown, channel: "state" | "reliable") => void,
  ) => () => void;
}
