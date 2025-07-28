import { Context } from "telegraf";
import { config } from "../config";
import { putKv } from "../kv";
import { KVData, KVMetadata } from "../types";
import { withErrorHandling } from "../utils/error-handler";

export interface SaveMediaConfig {
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

export class MediaService {
  public async saveMedia(mediaConfig: SaveMediaConfig): Promise<void> {
    const { ctx, mediaId, caption, messageId, chatId, groupId, mediaType } =
      mediaConfig;

    const communityId = caption.startsWith("@")
      ? config.twitterCommunityId
      : undefined;
    const key = this.constructKey(groupId, messageId, chatId);

    await this.saveToKV({
      ctx,
      key,
      imageId: mediaId,
      caption,
      communityId,
      chatId,
      messageId,
      groupId,
      onSuccess: async (ctx: Context, groupId?: string) => {
        await ctx.reply(
          `Saved ${mediaType} to kv, with groupId ${groupId}, caption ${caption}`
        );
      },
      onError: async (ctx: Context) => {
        await ctx.reply(`Error saving ${mediaType} to kv`);
      },
    });
  }

  public async save3dmMedia(config: Save3dmMediaConfig): Promise<void> {
    const { ctx, mediaUrl, caption, chatId, groupId, index, total } = config;
    const key = `3dm-${groupId}-${chatId}-${index}-${total}`;

    await this.saveToKV({
      ctx,
      key,
      imageId: mediaUrl,
      caption,
      communityId: undefined,
      chatId,
      messageId: undefined,
      groupId,
      onSuccess: async () => {
        // do nothing for 3dm images
      },
      onError: async (ctx: Context) => {
        await ctx.reply(
          `Error saving 3dm image to kv, key: ${key}, mediaUrl: ${mediaUrl}, caption: ${caption}`
        );
      },
    });
  }

  private async saveToKV({
    ctx,
    key,
    imageId,
    caption,
    communityId,
    chatId,
    messageId,
    groupId,
    onSuccess,
    onError,
  }: {
    ctx: Context;
    key: string;
    imageId: string;
    caption: string;
    communityId?: string;
    chatId: number;
    messageId?: number;
    groupId?: string;
    onSuccess: (ctx: Context, groupId?: string) => Promise<void>;
    onError: (ctx: Context) => Promise<void>;
  }): Promise<void> {
    return withErrorHandling(
      async () => {
        const data: KVData = {
          imageId,
          caption: caption.startsWith("@") ? caption.split("@")[1] : caption,
          communityId,
        };
        const metadata: KVMetadata = { chatId, messageId, groupId };

        await putKv(key, JSON.stringify(data), JSON.stringify(metadata));
        await onSuccess(ctx, groupId);
      },
      onError,
      ctx,
      key
    );
  }

  private constructKey(
    groupId: string | undefined,
    messageId: number,
    chatId: number
  ): string {
    if (groupId) {
      return `${chatId}-${groupId}-${messageId}`;
    }
    return `${chatId}-${messageId}`;
  }
}
