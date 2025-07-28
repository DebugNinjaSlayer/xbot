import { Context, Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import { config } from "../config";
import { MediaService } from "../services/media-service";
import { parse3dmUrl } from "../3dm-parser";

// Type guards for message types
function hasAnimation(ctx: Context): ctx is Context & {
  message: {
    animation: any;
    document: any;
    caption?: string;
    message_id: number;
    media_group_id?: string;
  };
} {
  return !!(ctx.message && "animation" in ctx.message);
}

function hasPhoto(ctx: Context): ctx is Context & {
  message: {
    photo: any[];
    caption?: string;
    message_id: number;
    media_group_id?: string;
  };
} {
  return !!(ctx.message && "photo" in ctx.message);
}

function hasText(ctx: Context): ctx is Context & { message: { text: string } } {
  return !!(ctx.message && "text" in ctx.message);
}

function hasChat(ctx: Context): ctx is Context & { chat: { id: number } } {
  return !!(ctx.chat && "id" in ctx.chat);
}

export class TelegramBot {
  private bot: Telegraf<Context>;
  private mediaService: MediaService;

  constructor() {
    this.bot = new Telegraf<Context>(config.botToken, {
      handlerTimeout: 60_000 * 10,
    });
    this.mediaService = new MediaService();
    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.bot.on(message("animation"), this.handleAnimation.bind(this));
    this.bot.on(message("photo"), this.handlePhoto.bind(this));
    this.bot.on(message("text"), this.handleText.bind(this));
  }

  private async handleAnimation(ctx: Context): Promise<void> {
    if (!hasAnimation(ctx) || !hasChat(ctx)) {
      await ctx.reply("No animation found");
      return;
    }

    const animation = ctx.message.animation;
    if (!animation) {
      await ctx.reply("No animation found");
      return;
    }

    const document = ctx.message.document;
    const animationId = document?.file_id;
    if (!animationId) {
      await ctx.reply("No animation found");
      return;
    }

    await this.mediaService.saveMedia({
      ctx,
      mediaId: animationId,
      caption: ctx.message.caption ?? "",
      messageId: ctx.message.message_id,
      chatId: ctx.chat.id,
      groupId: ctx.message.media_group_id,
      mediaType: "animation",
    });
  }

  private async handlePhoto(ctx: Context): Promise<void> {
    if (!hasPhoto(ctx) || !hasChat(ctx)) {
      await ctx.reply("No image found");
      return;
    }

    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const imageId = photo?.file_id;
    if (!imageId) {
      await ctx.reply("No image found");
      return;
    }

    await this.mediaService.saveMedia({
      ctx,
      mediaId: imageId,
      caption: ctx.message.caption ?? "",
      messageId: ctx.message.message_id,
      chatId: ctx.chat.id,
      groupId: ctx.message.media_group_id,
      mediaType: "photo",
    });
  }

  private async handleText(ctx: Context): Promise<void> {
    if (!hasText(ctx)) {
      return;
    }

    const msg = ctx.message.text;

    if (msg === "/start") {
      await ctx.reply("Hello! I'm a bot that can tweet images and text.");
      return;
    }

    if (msg.startsWith("https://www.3dmgame.com/bagua")) {
      await this.handle3dmUrl(ctx, msg);
    }
  }

  private async handle3dmUrl(ctx: Context, url: string): Promise<void> {
    if (!hasChat(ctx)) {
      await ctx.reply("Error: Chat information not available");
      return;
    }

    try {
      const result = await parse3dmUrl(url);
      const groupId = Date.now().toString();

      for (let i = 0; i < result.results.length; i++) {
        const item = result.results[i];
        await this.mediaService.save3dmMedia({
          ctx,
          mediaUrl: item.mediaUrl,
          caption: item.caption,
          chatId: ctx.chat.id,
          groupId,
          index: i,
          total: result.results.length,
        });
      }

      await ctx.reply(
        `Saved ${result.results.length} 3dm images to kv, groupId: ${groupId}`
      );
    } catch (error) {
      console.error("Error handling 3dm URL:", error);
      await ctx.reply("Error processing 3dm URL");
    }
  }

  public launch(): void {
    this.bot.launch();
    console.log("Bot is running...");
  }

  public stop(signal: string): void {
    this.bot.stop(signal);
  }

  public getTelegramInstance(): Telegraf<Context> {
    return this.bot;
  }
}
