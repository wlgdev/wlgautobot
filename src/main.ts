import { isDenoDeploy, logger } from "./utils.ts";
import { scheduleStats } from "./features/shorts-stat.ts";
import { bot } from "./telegram/bot.ts";
import { fillGamesSheet } from "./features/games-url-to-google-sheets.ts";
import { fillRecordsSheet } from "./features/records-url-to-goolge-sheets.ts";
import { app } from "./app.ts";

Deno.cron("shorts stats", "0 0 26 * *", async () => {
  if (Deno.env.get("DENO_TIMELINE") !== "production") {
    logger.log("Shorts Stat", "Skipping cron job in development mode");
  }
  await scheduleStats();
});

Deno.cron("fill games sheet", "0 7 * * *", async () => {
  if (Deno.env.get("DENO_TIMELINE") !== "production") {
    logger.log("Fill Games Sheet", "Skipping cron job in development mode");
  }
  await fillGamesSheet();
});

Deno.cron("fill records sheet", "10 7 * * *", async () => {
  if (Deno.env.get("DENO_TIMELINE") !== "production") {
    logger.log("Fill Records Sheet", "Skipping cron job in development mode");
  }
  await fillRecordsSheet();
});

Deno.serve({
  port: 6969,
  onListen: () => {},
}, app.fetch);

if (!isDenoDeploy) {
  await bot.start({ drop_pending_updates: true });
}
