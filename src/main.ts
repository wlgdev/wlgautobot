import { isDenoDeploy } from "./utils.ts";
import { scheduleStats } from "./features/shorts-stat.ts";
import { bot } from "./telegram/bot.ts";
import { fillGamesSheet } from "./features/games-url-to-google-sheets.ts";
import { fillRecordsSheet } from "./features/records-url-to-goolge-sheets.ts";
import { app } from "./app.ts";

Deno.cron("shorts stats", "0 0 26 * *", async () => {
  await scheduleStats();
});

Deno.cron("fill games sheet", "0 7 * * *", async () => {
  await fillGamesSheet();
});

Deno.cron("fill records sheet", "10 7 * * *", async () => {
  await fillRecordsSheet();
});

Deno.serve({
  port: 6969,
  onListen: () => {},
}, app.fetch);

if (!isDenoDeploy) {
  await bot.start({ drop_pending_updates: true });
}
