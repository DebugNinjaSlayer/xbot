import dotenv from "dotenv";
import { Context, Telegraf } from "telegraf";

dotenv.config();

const bot = new Telegraf<Context>(process.env.BOT_TOKEN as string);

bot.on("photo", async (ctx) => {
  let imageId = ctx.message.photo.pop()?.file_id;
  console.log(imageId);
  let imageUrl = await ctx.telegram.getFileLink(imageId as string);
  console.log(imageUrl.href);
  console.log(ctx.message.caption);

  await ctx.reply("received photo");
});

bot.launch();

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
