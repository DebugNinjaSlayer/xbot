import { Context, Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import app from "./routes";
import { tweetImages, tweetText } from "./x";

const bot = new Telegraf<Context>(process.env.BOT_TOKEN as string);

bot.on(message("photo"), async (ctx) => {
  const text = ctx.message.caption;
  if (text === "/start") {
    await ctx.reply("Hello! I'm a bot that can tweet images and text.");
    return;
  }
  let imageId = ctx.message.photo.pop()?.file_id;
  if (!imageId) {
    await ctx.reply("No image found");
    return;
  }
  let imageUrl = await ctx.telegram.getFileLink(imageId as string);

  await tweetImages([imageUrl], ctx.message.caption ?? "");

  await ctx.reply("Tweeted image with cation");
});

bot.on(message("text"), async (ctx) => {
  const msg = ctx.message.text;
  await tweetText(msg);
  await ctx.reply(`Tweeted text: ${msg}`);
});

bot.launch();
console.log("Bot is running...");

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
