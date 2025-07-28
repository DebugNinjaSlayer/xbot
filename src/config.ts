import dotenv from "dotenv";
dotenv.config();

export interface Config {
  botToken: string;
  twitterCommunityId?: string;
  cronSchedule: string;
  delay?: number;
  timezone: string;
  tweetEnabled?: boolean;
}

function validateConfig(config: Partial<Config>): config is Config {
  if (!config.botToken) {
    throw new Error("BOT_TOKEN is required");
  }
  return true;
}

export const config: Config = {
  botToken: process.env.BOT_TOKEN as string,
  twitterCommunityId: process.env.TWITTER_COMMUNITY_ID,
  cronSchedule: process.env.CRON_SCHEDULE ?? "0 8-22/2 * * *",
  delay: process.env.DELAY ? parseInt(process.env.DELAY, 10) : undefined,
  timezone: "Asia/Shanghai",
  tweetEnabled: process.env.TWEET_ENABLED === "true",
};

validateConfig(config);
