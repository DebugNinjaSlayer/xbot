import * as lt from "long-timeout";
import cron from "node-cron";
import { Telegraf } from "telegraf";
import { config } from "../config";
import {
  deleteKv,
  getKv,
  getRandomKv,
  listKvWithPrefix,
  parseKey,
} from "../kv";
import { tweetImages } from "../x";
import { ImageFileSizeError, withErrorHandling } from "../utils/error-handler";

export class SchedulerService {
  private bot: Telegraf;

  constructor(bot: Telegraf) {
    this.bot = bot;
  }

  public startScheduledTasks(): void {
    cron.schedule(
      config.cronSchedule,
      async () => {
        const delay = config.delay;
        const kvNeedToBeCleaned: string[] = [];

        lt.setTimeout(async () => {
          await withErrorHandling(async () => {
            const kv = await getRandomKv();
            if (!kv) {
              console.log("No kv found");
              return;
            }

            const { value, key } = kv;
            try {
              if (key.startsWith("3dm-")) {
                kvNeedToBeCleaned.push(key);
                await this.handle3DMImage(key);
              } else {
                await this.handleRegularImage(key, value, kvNeedToBeCleaned);
              }
            } catch (error) {
              console.error(
                `Error handling kv: ${error}, key: ${key}, value: ${value}`
              );
              if (error instanceof ImageFileSizeError) {
                console.error(
                  `Error handling kv with image file size error: ${error}, key: ${key}`
                );
              }
            } finally {
              await this.cleanupKvEntries(kvNeedToBeCleaned);
            }
          });
        }, delay ?? Math.floor(Math.random() * 1000 * 60 * 30) + 1);

        console.log(
          `Scheduled tweet at ${new Date(
            Date.now() + (delay ?? 0)
          ).toLocaleString()}`
        );
      },
      {
        name: "scheduled-tweet",
        scheduled: true,
        timezone: config.timezone,
      }
    );
  }

  private async handle3DMImage(key: string): Promise<void> {
    const kv = await getKv(key);
    const { imageId, caption } = JSON.parse(kv.value);
    const imageUrls = [new URL(imageId)];
    await tweetImages(imageUrls, caption);
  }

  private async handleRegularImage(
    key: string,
    value: string,
    kvNeedToBeCleaned: string[]
  ): Promise<void> {
    const { chatId, groupId } = parseKey(key);
    if (groupId) {
      await this.handleGroupedImages(chatId, groupId, kvNeedToBeCleaned);
    } else {
      kvNeedToBeCleaned.push(key);
      await this.handleSingleImage(value);
    }
  }

  private async handleGroupedImages(
    chatId: string,
    groupId: string,
    kvNeedToBeCleaned: string[]
  ): Promise<void> {
    const keys = await listKvWithPrefix(`${chatId}-${groupId}`);
    kvNeedToBeCleaned.push(...keys);

    const imageUrls = [];
    let finalCaption = "";
    let finalCommunityId: string | undefined;

    for (const key of keys) {
      const kv = await getKv(key);
      const { imageId, caption, communityId } = JSON.parse(kv.value);
      const imageUrl = await this.bot.telegram.getFileLink(imageId as string);
      imageUrls.push(new URL(imageUrl));
      if (!finalCaption) finalCaption = caption;
      if (!finalCommunityId) finalCommunityId = communityId;
    }

    await tweetImages(imageUrls, finalCaption, finalCommunityId);
    console.log(`Tweeted and deleted kv with multiple images: ${finalCaption}`);
  }

  private async handleSingleImage(value: string): Promise<void> {
    const { imageId, caption, communityId } = JSON.parse(value);
    const imageUrl = await this.bot.telegram.getFileLink(imageId as string);
    await tweetImages([new URL(imageUrl)], caption, communityId);
  }

  private async cleanupKvEntries(kvNeedToBeCleaned: string[]): Promise<void> {
    for (const k of kvNeedToBeCleaned) {
      try {
        await deleteKv(k);
        console.log(`Deleted kv: ${k}`);
      } catch (error) {
        console.error(`Error deleting kv: ${error}, key: ${k}`);
      }
    }
  }
}
