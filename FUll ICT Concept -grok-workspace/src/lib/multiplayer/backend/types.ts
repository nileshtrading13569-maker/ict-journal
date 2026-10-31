import { z } from "zod";

export const ID_SCHEMA = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]{1,64}$/, "ID must contain 1-64 alphanumeric, dash, or underscore characters");

export const SignalKindSchema = z.enum(["offer", "answer", "ice"]);
export type SignalKind = z.infer<typeof SignalKindSchema>;

/** Payload size limit (32KB). SDP offers/answers are usually 3-10KB. */
export const MAX_SIGNAL_PAYLOAD_BYTES = 32_768;

export const SignalOpSchema = z.object({
  op: z.literal("signal"),
  room: ID_SCHEMA,
  from: ID_SCHEMA,
  to: ID_SCHEMA,
  kind: SignalKindSchema,
  payload: z.unknown().refine(
    (v) => {
      if (v === undefined) return false;
      try {
        return JSON.stringify(v).length <= MAX_SIGNAL_PAYLOAD_BYTES;
      } catch {
        return false;
      }
    },
    { message: "payload must be valid JSON and <= 32KB" },
  ),
});

export const LeaveOpSchema = z.object({
  op: z.literal("leave"),
  room: ID_SCHEMA,
  peer: ID_SCHEMA,
});

export const PostOpSchema = z.discriminatedUnion("op", [SignalOpSchema, LeaveOpSchema]);

export type SignalOp = z.infer<typeof SignalOpSchema>;
export type LeaveOp = z.infer<typeof LeaveOpSchema>;
export type PostOp = z.infer<typeof PostOpSchema>;

export const PollQuerySchema = z.object({
  room: ID_SCHEMA,
  peer: ID_SCHEMA,
  name: z.string().max(64).default(""),
  since: z.coerce.number().int().min(0).default(0),
});

export type PollQuery = z.infer<typeof PollQuerySchema>;

export interface PeerRow {
  id: string;
  name: string;
  lastSeen?: string | Date;
}

export interface SignalRow {
  id: number;
  from: string;
  kind: SignalKind;
  payload: unknown;
  createdAt?: string | Date;
}

export interface RtcPollResponse {
  peers: PeerRow[];
  signals: SignalRow[];
}

export interface RoomStats {
  room: string;
  peerCount: number;
  activeSignals: number;
  lastActivity: Date | null;
}
