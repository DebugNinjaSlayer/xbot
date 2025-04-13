import dotenv from "dotenv";
import express, { Request, Response } from "express";
import session from "express-session";
import { Context, Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import TwitterApi from "twitter-api-v2";
import { getAuthUrl, tweetText } from "./x";

declare module "express-session" {
  interface SessionData {
    oauth_token_secret?: string;
  }
}

dotenv.config();

const bot = new Telegraf<Context>(process.env.BOT_TOKEN as string);
const app = express();
app.set("trust proxy", 1);
app.use(
  session({
    secret: process.env.SESSION_SECRET ?? "you should change this",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true,
      maxAge: 3600000,
    },
  })
);

bot.on(message("photo"), async (ctx) => {
  let imageId = ctx.message.photo.pop()?.file_id;
  console.log(imageId);
  let imageUrl = await ctx.telegram.getFileLink(imageId as string);
  console.log(imageUrl.href);
  console.log(ctx.message.caption);

  await ctx.reply("received photo");
});

bot.on(message("text"), async (ctx) => {
  const msg = ctx.message.text;
  await ctx.reply(`Hello ${msg}`);
  await tweetText(msg);
});

bot.launch();
console.log("Bot is running...");

app.get("/hello", async (req: Request, res: Response) => {
  const authLink = await getAuthUrl(
    new TwitterApi({
      appKey: process.env.TWITTER_APP_KEY as string,
      appSecret: process.env.TWITTER_APP_SECRET as string,
    })
  );
  req.session.oauth_token_secret = authLink.oauth_token_secret;
  res.redirect(authLink.url);
});

app.get("/callback", (req: Request, res: Response) => {
  const { oauth_token, oauth_verifier } = req.query;
  const { oauth_token_secret } = req.session;

  if (!oauth_token || !oauth_verifier || !oauth_token_secret) {
    res.status(400).send("You denied the app or your session expired!");
    return;
  }

  const tmpClient = new TwitterApi({
    appKey: process.env.TWITTER_APP_KEY as string,
    appSecret: process.env.TWITTER_APP_SECRET as string,
    accessToken: oauth_token as string,
    accessSecret: oauth_token_secret as string,
  });

  tmpClient
    .login(oauth_verifier as string)
    .then(({ client: loggedClient, accessToken, accessSecret }) => {
      console.log("accessToken");
      console.log(accessToken);
      console.log("accessSecret");
      console.log(accessSecret);
    })
    .catch(() => res.status(403).send("Invalid verifier or access tokens!"));
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
