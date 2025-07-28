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

export interface MediaConfig {
  ctx: Context;
  mediaId: string;
  caption: string;
  messageId: number;
  chatId: number;
  groupId?: string;
  mediaType: "photo" | "animation";
}

export interface Save3dmMediaConfig {
  ctx: Context;
  mediaUrl: string;
  caption: string;
  chatId: number;
  groupId: string;
  index: number;
  total: number;
}
