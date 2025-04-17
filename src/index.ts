import dotenv from "dotenv";
dotenv.config();

import { Context, Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import { getRandomKv, putKv } from "./kv";
import app from "./routes";
import { tweetText } from "./x";

const bot = new Telegraf<Context>(process.env.BOT_TOKEN as string);

bot.on(message("photo"), async (ctx) => {
  let imageId = ctx.message.photo.pop()?.file_id;
  if (!imageId) {
    await ctx.reply("No image found");
    return;
  }
  let imageUrl = await ctx.telegram.getFileLink(imageId as string);
  const caption = ctx.message.caption ?? "";
  const messageId = ctx.message.message_id;
  const chatId = ctx.chat.id;
  try {
    await putKv(
      `${chatId}-${messageId}`,
      JSON.stringify({ imageUrl, caption }),
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

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
