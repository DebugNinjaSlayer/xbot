import dotenv from "dotenv";
dotenv.config();

import * as lt from "long-timeout";
import cron from "node-cron";
import { Context, Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import { deleteKv, getRandomKv, putKv } from "./kv";
import app from "./routes";
import { tweetImages, tweetText } from "./x";
const bot = new Telegraf<Context>(process.env.BOT_TOKEN as string);

bot.on(message("photo"), async (ctx) => {
  const imageUrls = [];
  if (ctx.message.photo.length > 4) {
    await ctx.reply("Too many photos, max 4");
    return;
  }
  for (const photo of ctx.message.photo) {
    let imageId = photo.file_id;
    if (!imageId) {
      await ctx.reply("No image found");
      return;
    }
    let imageUrl = await ctx.telegram.getFileLink(imageId as string);
    imageUrls.push(imageUrl);
  }

  const caption = ctx.message.caption ?? "";
  const communityId = caption.startsWith("@")
    ? process.env.TWITTER_COMMUNITY_ID
    : undefined;
  const messageId = ctx.message.message_id;
  const chatId = ctx.chat.id;
  try {
    await putKv(
      `${chatId}-${messageId}`,
      JSON.stringify({
        imageUrls,
        caption: caption.startsWith("@") ? caption.split("@")[1] : caption,
        communityId,
      }),
      JSON.stringify({ chatId, messageId })
    );
    await ctx.reply("Saved to kv");
  } catch (error) {
    console.error(error);
    await ctx.reply("Error saving to kv");
  }
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
    const delay = Math.floor(Math.random() * 1000 * 60 * 90) + 1; // 1-90 minutes
    let kv: { value: string; key: string } | null = null;
    lt.setTimeout(async function () {
      try {
        kv = await getRandomKv();
        if (!kv) {
          console.log("No kv found");
          return;
        }
        const { value, key } = kv;
        // TODO: imageUrls takes priority over imageUrl, remove imageUrl after migration
        const { imageUrl, imageUrls, caption, communityId } = JSON.parse(value);
        if (imageUrls && imageUrls.length > 0) {
          await tweetImages(
            imageUrls.map((url: string) => new URL(url)),
            caption,
            communityId
          );
        } else {
          await tweetImages([new URL(imageUrl)], caption, communityId);
        }
        console.log(`Tweeted and deleted kv: ${caption}`);
      } catch (error) {
        console.error(error);
        if (kv) {
          const { chatId, messageId } = parseKey(kv.key);
          if (chatId && messageId) {
            await bot.telegram.sendMessage(
              chatId,
              `failed with key ${kv.key}, will delete it in case of blocking other tasks`,
              {
                reply_parameters: {
                  message_id: messageId,
                },
              }
            );
          }
        }
      } finally {
        if (kv) {
          try {
            await deleteKv(kv.key);
          } catch (error) {
            console.error(error);
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

function parseKey(key: string): { chatId: number; messageId: number } {
  const parts = key.split("-");

  const chatId = parseInt(parts[0], 10);
  const messageId = parseInt(parts[1], 10);

  return { chatId: chatId, messageId: messageId };
}