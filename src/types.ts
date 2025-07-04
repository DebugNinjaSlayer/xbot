import { Context } from "telegraf";

export interface KVData {
  imageId: string;
  caption: string;
  communityId?: string;
}

export interface KVMetadata {
  chatId: number;
  messageId?: number;
  groupId?: string;
}

export interface SaveToKVConfig {
  ctx: any;
  key: string;
  imageId: string;
  caption: string;
  communityId?: string;
  chatId: number;
  messageId?: number;
  groupId?: string;
  onSuccess: (ctx: Context, groupId?: string) => Promise<void>;
  onError: (ctx: Context) => Promise<void>;
}

export interface Parsed3DMResult {
  results: Array<{
    mediaUrl: string;
    caption: string;
  }>;
}
