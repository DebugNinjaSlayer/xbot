import dotenv from "dotenv";
import { TwitterApi } from "twitter-api-v2";

dotenv.config();

const client = new TwitterApi({
  appKey: process.env.TWITTER_APP_KEY as string,
  appSecret: process.env.TWITTER_APP_SECRET as string,
  accessToken: process.env.TWITTER_ACCESS_TOKEN as string,
  accessSecret: process.env.TWITTER_ACCESS_SECRET as string,
});

export async function tweetText(text: string) {
  await client.v2.tweet({
    text: text,
  });
}

export async function getAuthUrl(client: TwitterApi, callbackUrl?: string) {
  const authLink = await client.generateAuthLink(
    callbackUrl ?? process.env.CALLBACK_URL ?? "http://localhost:3000/callback"
  );
  return authLink;
}
