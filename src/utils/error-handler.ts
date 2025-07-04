import { Context } from "telegraf";
import { parseKey } from "../kv";

export class AppError extends Error {
  constructor(
    message: string,
    public readonly originalError?: Error,
    public readonly context?: any
  ) {
    super(message);
    this.name = "AppError";
  }
}

export async function handleError(
  error: Error,
  ctx?: Context,
  key?: string
): Promise<void> {
  console.error("Error occurred:", error);

  if (ctx && key) {
    const { chatId, messageId } = parseKey(key);
    if (chatId && messageId) {
      try {
        await ctx.telegram.sendMessage(
          chatId,
          `Error occurred: ${error.message}`,
          {
            reply_parameters: {
              message_id: parseInt(messageId, 10),
            },
          }
        );
      } catch (telegramError) {
        console.error(
          "Failed to send error message to Telegram:",
          telegramError
        );
      }
    }
  }
}

export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  onError?: (ctx: Context) => Promise<void>,
  ctx?: Context,
  key?: string
): Promise<T | undefined> {
  try {
    return await operation();
  } catch (error) {
    if (onError && ctx) {
      await onError(ctx);
    } else {
      await handleError(
        error instanceof Error ? error : new Error(String(error)),
        ctx,
        key
      );
    }
    return undefined;
  }
}
