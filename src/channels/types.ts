import type { IncomingMessage, OutgoingMessage } from "../types.js";

export interface ChannelAdapter {
  readonly name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  onMessage(handler: (msg: IncomingMessage) => Promise<void>): void;
  sendMessage(chatId: string, msg: OutgoingMessage): Promise<void>;
  getFileUrl(fileId: string): Promise<string>;
}
