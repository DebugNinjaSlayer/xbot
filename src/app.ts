import dotenv from "dotenv";
dotenv.config();

import { TelegramBot } from "./bot/telegram-bot";
import { SchedulerService } from "./services/scheduler-service";
import app from "./routes";

export class Application {
  private telegramBot: TelegramBot;
  private schedulerService: SchedulerService;

  constructor() {
    this.telegramBot = new TelegramBot();
    this.schedulerService = new SchedulerService(this.telegramBot.getTelegramInstance());
  }

  public async start(): Promise<void> {
    try {
      // Start Telegram bot
      this.telegramBot.launch();
      
      // Start scheduled tasks
      this.schedulerService.startScheduledTasks();
      
      // Start web server
      app.listen(3000, () => {
        console.log("Server is running on port 3000");
      });

      // Setup graceful shutdown
      this.setupGracefulShutdown();
      
      console.log("Application started successfully");
    } catch (error) {
      console.error("Failed to start application:", error);
      process.exit(1);
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = (signal: string) => {
      console.log(`Received ${signal}, shutting down gracefully...`);
      this.telegramBot.stop(signal);
      process.exit(0);
    };

    process.once("SIGINT", () => shutdown("SIGINT"));
    process.once("SIGTERM", () => shutdown("SIGTERM"));
  }
}
