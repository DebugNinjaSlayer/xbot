import { Application } from "./app";

async function main() {
  const app = new Application();
  await app.start();
}

main().catch((error) => {
  console.error("Failed to start application:", error);
  process.exit(1);
});
