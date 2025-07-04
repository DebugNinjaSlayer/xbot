import dotenv from "dotenv";
dotenv.config();

import * as lt from "long-timeout";
import cron from "node-cron";
import { Context, Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import { parse3dmUrl } from "./3dm-parser";
import { config } from "./config";
import {
  deleteKv,
  getKv,
  getRandomKv,
  listKvWithPrefix as listKeysWithPrefix,
  parseKey,
  putKv,
} from "./kv";
import app from "./routes";
import { KVData, KVMetadata, SaveToKVConfig } from "./types";
import { ImageFileSizeError, withErrorHandling } from "./utils/error-handler";
import { tweetImages, uploadImagesAndTweet } from "./x";

const bot = new Telegraf<Context>(config.botToken, {
  handlerTimeout: 60_000 * 10,
});

bot.on(message("animation"), async (ctx) => {
  const animation = ctx.message.animation;
  if (!animation) {
    await ctx.reply("No animation found");
    return;
  }

  const document = ctx.message.document;
  let animationId = document.file_id;
  if (!animationId) {
    await ctx.reply("No animation found");
    return;
  }
  const caption = ctx.message.caption ?? "";
  const communityId = caption.startsWith("@")
    ? config.twitterCommunityId
    : undefined;
  const messageId = ctx.message.message_id;
  const chatId = ctx.chat.id;
  const groupId = ctx.message.media_group_id;
  const key = constructKey(groupId, messageId, chatId);
  await saveToKV({
    ctx,
    key,
    imageId: animationId,
    caption,
    communityId,
    chatId,
    messageId,
    groupId,
    onSuccess: async (ctx: Context, groupId?: string) => {
      await ctx.reply(
        `Saved animation to kv, with groupId ${groupId}, caption ${caption}`
      );
    },
    onError: async (ctx: Context) => {
      await ctx.reply("Error saving animation to kv");
    },
  });
});

bot.on(message("photo"), async (ctx) => {
  const photo = ctx.message.photo[ctx.message.photo.length - 1];
  let imageId = photo.file_id;
  if (!imageId) {
    await ctx.reply("No image found");
    return;
  }
  const caption = ctx.message.caption ?? "";
  const communityId = caption.startsWith("@")
    ? config.twitterCommunityId
    : undefined;
  const messageId = ctx.message.message_id;
  const chatId = ctx.chat.id;
  const groupId = ctx.message.media_group_id;
  const key = constructKey(groupId, messageId, chatId);
  await saveToKV({
    ctx,
    key,
    imageId,
    caption,
    communityId,
    chatId,
    messageId,
    groupId,
    onSuccess: async (ctx: Context, groupId?: string) => {
      await ctx.reply(
        `Saved image to kv, with groupId ${groupId}, caption ${caption}`
      );
    },
    onError: async (ctx: Context) => {
      await ctx.reply("Error saving image to kv");
    },
  });
});

bot.on(message("text"), async (ctx) => {
  const msg = ctx.message.text;
  if (msg === "/start") {
    await ctx.reply("Hello! I'm a bot that can tweet images and text.");
    return;
  }
  if (msg.startsWith("https://www.3dmgame.com/bagua")) {
    const result = await parse3dmUrl(msg);
    const now = new Date();
    const groupId = now.getTime().toString();
    for (let i = 0; i < result.results.length; i++) {
      const item = result.results[i];
      const key = `3dm-${groupId}-${ctx.chat.id}-${i}-${result.results.length}`;
      await saveToKV({
        ctx,
        key,
        imageId: item.mediaUrl,
        caption: item.caption,
        communityId: undefined,
        chatId: ctx.chat.id,
        messageId: undefined,
        groupId,
        onSuccess: async (ctx: Context) => {
          // do nothing
        },
        onError: async (ctx: Context) => {
          await ctx.reply(
            `Error saving 3dm image to kv, key: ${key}, mediaUrl: ${item.mediaUrl}, caption: ${item.caption}`
          );
        },
      });
    }
    await ctx.reply(
      `Saved ${result.results.length} 3dm images to kv, groupId: ${groupId}`
    );
  }
});

bot.launch();
console.log("Bot is running...");

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});

cron.schedule(
  config.cronSchedule,
  async () => {
    const delay = config.delay;
    const kvNeedToBeCleaned: string[] = [];

    lt.setTimeout(async function () {
      await withErrorHandling(async () => {
        const kv = await getRandomKv();
        if (!kv) {
          console.log("No kv found");
          return;
        }

        const { value, key } = kv;
        try {
          if (key.startsWith("3dm-")) {
            await handle3DMImage(key, kvNeedToBeCleaned);
          } else {
            await handleRegularImage(key, value, kvNeedToBeCleaned);
          }
          for (const key of kvNeedToBeCleaned) {
            await deleteKv(key);
            console.log(`Deleted kv: ${key}`);
          }
        } catch (error) {
          console.error(`Error deleting kv: ${error}`);
          if (error instanceof ImageFileSizeError) {
            try {
              await deleteKv(key);
              console.log(`Deleted kv with image file size error: ${key}`);
            } catch (error) {
              console.error(
                `Error deleting kv with image file size error: ${error}`
              );
            }
          }
        }
      });
    }, delay);

    console.log(
      `Scheduled tweet at ${new Date(Date.now() + delay).toLocaleString()}`
    );
  },
  {
    name: "scheduled-tweet",
    scheduled: true,
    timezone: config.timezone,
  }
);

async function handle3DMImage(key: string, kvNeedToBeCleaned: string[]) {
  const kv = await getKv(key);
  const { imageId, caption } = JSON.parse(kv.value);
  const imageUrls = [new URL(imageId)];
  await uploadImagesAndTweet(imageUrls, caption);
  kvNeedToBeCleaned.push(key);
}

async function handleRegularImage(
  key: string,
  value: string,
  kvNeedToBeCleaned: string[]
) {
  const { chatId, groupId } = parseKey(key);
  if (groupId) {
    await handleGroupedImages(chatId, groupId, kvNeedToBeCleaned);
  } else {
    await handleSingleImage(key, value, kvNeedToBeCleaned);
  }
}

async function handleGroupedImages(
  chatId: string,
  groupId: string,
  kvNeedToBeCleaned: string[]
) {
  const keys = await listKeysWithPrefix(`${chatId}-${groupId}`);
  kvNeedToBeCleaned.push(...keys);

  const imageUrls = [];
  let finalCaption = "";
  let finalCommunityId: string | undefined;

  for (const key of keys) {
    const kv = await getKv(key);
    const { imageId, caption, communityId } = JSON.parse(kv.value);
    let imageUrl = await bot.telegram.getFileLink(imageId as string);
    imageUrls.push(new URL(imageUrl));
    if (!finalCaption) finalCaption = caption;
    if (!finalCommunityId) finalCommunityId = communityId;
  }

  await tweetImages(imageUrls, finalCaption, finalCommunityId);
  console.log(`Tweeted and deleted kv with multiple images: ${finalCaption}`);
}

async function handleSingleImage(
  key: string,
  value: string,
  kvNeedToBeCleaned: string[]
) {
  kvNeedToBeCleaned.push(key);
  const { imageId, caption, communityId } = JSON.parse(value);
  let imageUrl = await bot.telegram.getFileLink(imageId as string);
  await tweetImages([new URL(imageUrl)], caption, communityId);
}

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

// TODO: imageId should migrate to mediaId
async function saveToKV({
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
}: SaveToKVConfig) {
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

function constructKey(
  groupId: string | undefined,
  messageId: number,
  chatId: number
): string {
  if (groupId) {
    return `${chatId}-${groupId}-${messageId}`;
  }
  return `${chatId}-${messageId}`;
}
