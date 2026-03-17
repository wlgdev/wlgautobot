import { isDenoDeploy } from "./utils.ts";
import { scheduleStats } from "./features/shorts-stat.ts";
import { bot } from "./telegram/bot.ts";
import { fillGamesSheet } from "./features/games-url-to-google-sheets.ts";
import { fillRecordsSheet } from "./features/records-url-to-goolge-sheets.ts";
import { app } from "./app.ts";

Deno.cron("shorts stats", "0 0 26 * *", async () => {
  if (Deno.env.get("DENO_TIMELINE") === "production") {
    await scheduleStats();
  }
});

Deno.cron("fill games sheet", "0 7 * * *", async () => {
  if (Deno.env.get("DENO_TIMELINE") === "production") {
    await fillGamesSheet();
  }
});

Deno.cron("fill records sheet", "10 7 * * *", async () => {
  if (Deno.env.get("DENO_TIMELINE") === "production") {
    await fillRecordsSheet();
  }
});

Deno.cron("test", "23 7 * * *", () => {
  if (Deno.env.get("DENO_TIMELINE") === "production") {
    console.log("WE HERE");
  }
});

Deno.serve({
  port: 6969,
  onListen: () => {},
}, app.fetch);

if (!isDenoDeploy) {
  await bot.start({ drop_pending_updates: true });
}
