import dotenv from "dotenv";
dotenv.config();

import * as lt from "long-timeout";
import cron from "node-cron";
import { Context, Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import {
  deleteKv,
  getKv,
  getRandomKv,
  listKvWithPrefix as listKeysWithPrefix,
  parseKey,
  putKv,
} from "./kv";
import app from "./routes";
import { tweetImages, tweetText } from "./x";
const bot = new Telegraf<Context>(process.env.BOT_TOKEN as string);

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
    ? process.env.TWITTER_COMMUNITY_ID
    : undefined;
  const messageId = ctx.message.message_id;
  const chatId = ctx.chat.id;
  const groupId = ctx.message.media_group_id;
  let key: string;
  if (groupId) {
    key = `${ctx.chat.id}-${groupId}-${ctx.message.message_id}`;
  } else {
    key = `${ctx.chat.id}-${ctx.message.message_id}`;
  }
  await saveToKV(
    ctx,
    key,
    animationId,
    caption,
    communityId,
    chatId,
    messageId,
    groupId,
    async (ctx, groupId) => {
      await ctx.reply(
        `Saved animation to kv, with groupId ${groupId}, caption ${caption}`
      );
    },
    async (ctx) => {
      await ctx.reply("Error saving animation to kv");
    }
  );
});

bot.on(message("photo"), async (ctx) => {
  const groupId = ctx.message.media_group_id;
  let key: string;
  if (groupId) {
    key = `${ctx.chat.id}-${groupId}-${ctx.message.message_id}`;
  } else {
    key = `${ctx.chat.id}-${ctx.message.message_id}`;
  }

  const photo = ctx.message.photo[ctx.message.photo.length - 1];
  let imageId = photo.file_id;
  if (!imageId) {
    await ctx.reply("No image found");
    return;
  }
  const caption = ctx.message.caption ?? "";
  const communityId = caption.startsWith("@")
    ? process.env.TWITTER_COMMUNITY_ID
    : undefined;
  const messageId = ctx.message.message_id;
  const chatId = ctx.chat.id;
  await saveToKV(
    ctx,
    key,
    imageId,
    caption,
    communityId,
    chatId,
    messageId,
    groupId,
    async (ctx, groupId) => {
      await ctx.reply(
        `Saved image to kv, with groupId ${groupId}, caption ${caption}`
      );
    },
    async (ctx) => {
      await ctx.reply("Error saving image to kv");
    }
  );
});

bot.on(message("text"), async (ctx) => {
  const msg = ctx.message.text;
  if (msg === "/start") {
    await ctx.reply("Hello! I'm a bot that can tweet images and text.");
    return;
  }
  try {
    await tweetText(msg);
    await ctx.reply(`Tweeted text: ${msg}`);
  } catch (error) {
    console.error(error);
    await ctx.reply("Error tweeting text");
  }
});

bot.launch();
console.log("Bot is running...");

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});

cron.schedule(
  process.env.CRON_SCHEDULE ?? "0 8-22/2 * * *",
  async () => {
    const delay = process.env.DELAY
      ? parseInt(process.env.DELAY, 10)
      : Math.floor(Math.random() * 1000 * 60 * 30) + 1; // 1-30 minutes
    const kvNeedToBeCleaned: string[] = [];
    lt.setTimeout(async function () {
      try {
        const kv = await getRandomKv();
        if (!kv) {
          console.log("No kv found");
          return;
        }
        const { value, key } = kv;
        // check if key match ${ctx.chat.id}-${groupId}-${ctx.message.message_id} or ${ctx.chat.id}-${ctx.message.message_id}
        const { chatId, groupId } = parseKey(key);
        if (groupId) {
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
            if (!finalCaption) {
              finalCaption = caption;
            }
            if (!finalCommunityId) {
              finalCommunityId = communityId;
            }
          }
          await tweetImages(imageUrls, finalCaption, finalCommunityId);
          console.log(
            `Tweeted and deleted kv with multiple images: ${finalCaption}`
          );
        } else {
          kvNeedToBeCleaned.push(key);
          const { imageId, caption, communityId } = JSON.parse(value);
          let imageUrl = await bot.telegram.getFileLink(imageId as string);
          await tweetImages([new URL(imageUrl)], caption, communityId);
          console.log(`Tweeted and deleted kv: ${caption}`);
        }
      } catch (error) {
        console.error(error);
        if (kvNeedToBeCleaned.length > 0) {
          const { chatId, messageId } = parseKey(kvNeedToBeCleaned[0]);
          if (chatId && messageId) {
            await bot.telegram.sendMessage(
              chatId,
              `failed with key ${kvNeedToBeCleaned[0]}, will delete it in case of blocking other tasks`,
              {
                reply_parameters: {
                  message_id: parseInt(messageId, 10),
                },
              }
            );
          }
        }
      } finally {
        if (kvNeedToBeCleaned.length > 0) {
          for (const key of kvNeedToBeCleaned) {
            try {
              await deleteKv(key);
            } catch (error) {
              console.error(error);
            }
          }
        }
      }
    }, delay);
    console.log(
      `Scheduled tweet at ${new Date(Date.now() + delay).toLocaleString()}`
    );
  },
  {
    name: "scheduled-tweet",
    scheduled: true,
    timezone: "Asia/Shanghai",
  }
);

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

// TODO: imageId should migrate to mediaId
async function saveToKV(
  ctx: Context,
  key: string,
  imageId: string,
  caption: string,
  communityId: string | undefined,
  chatId: number,
  messageId: number,
  groupId: string | undefined,
  onSuccess: (ctx: Context, groupId?: string) => Promise<void>,
  onError: (ctx: Context) => Promise<void>
) {
  try {
    await putKv(
      key,
      JSON.stringify({
        imageId,
        caption: caption.startsWith("@") ? caption.split("@")[1] : caption,
        communityId,
      }),
      JSON.stringify({ chatId, messageId, groupId })
    );
    await onSuccess(ctx, groupId);
  } catch (error) {
    console.error(error);
    await onError(ctx);
  }
}
