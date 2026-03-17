export interface IncomingMessage {
  id: string;
  channel: "telegram";
  chatId: string;
  userId: string;
  userName: string;
  text: string;
  replyToMessageId?: string;
  media?: MediaAttachment[];
  raw: unknown;
  timestamp: number;
}

export interface MediaAttachment {
  type: "photo" | "document" | "audio" | "video";
  fileId: string;
  fileName?: string;
  mimeType?: string;
}

export interface SessionKey {
  agentId: string;
  orgId: string;
  channel: "telegram";
  peerKind: "group" | "dm";
  peerId: string;
}

export function formatSessionKey(k: SessionKey): string {
  return `agent:${k.orgId}:${k.agentId}:${k.channel}:${k.peerKind}:${k.peerId}`;
}

export function parseSessionKey(s: string): SessionKey {
  const parts = s.split(":");
  if (parts.length !== 6 || parts[0] !== "agent") {
    throw new Error(`Invalid session key: ${s}`);
  }
  return {
    orgId: parts[1],
    agentId: parts[2],
    channel: parts[3] as "telegram",
    peerKind: parts[4] as "group" | "dm",
    peerId: parts[5],
  };
}

export interface OrgContext {
  orgId: string;
  orgName: string;
  agentId: string;
  agentName: string;
  systemPromptFiles: {
    soul?: string;
    agents?: string;
    memory?: string;
  };
}

export interface OutgoingMessage {
  text: string;
  parseMode?: "HTML" | "Markdown";
  replyToMessageId?: string;
}

export type LogLevel = "debug" | "info" | "warn" | "error";

export function log(level: LogLevel, msg: string, data?: Record<string, unknown>) {
  const ts = new Date().toISOString();
  const entry = { ts, level, msg, ...data };
  if (level === "error") console.error(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}
