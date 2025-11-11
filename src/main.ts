import { webhookCallback } from "@grammyjs/grammy";

import { isDenoDeploy, logger } from "./utils.ts";
import { Hono } from "@hono/hono";
import { streamText } from "@hono/hono/streaming";
import { scheduleStats } from "./features/shorts-stat.ts";
import { twitchEventHandler } from "./twitch/event-handler.ts";
import { bot } from "./telegram/bot.ts";
import { getLastStream, getLastStreamTitle } from "./features/timecodes.ts";
import { fillGamesSheet } from "./features/games-url-to-google-sheets.ts";
import { fillRecordsSheet } from "./features/records-url-to-goolge-sheets.ts";

Deno.cron("shorts stats", "0 0 26 * *", async () => {
  await scheduleStats();
});

Deno.cron("fill games sheet", "0 7 * * *", async () => {
  await fillGamesSheet();
});

Deno.cron("fill records sheet", "10 7 * * *", async () => {
  await fillRecordsSheet();
});

if (!isDenoDeploy) {
  await bot.start();
} else {
  const app = new Hono();
  const handler = webhookCallback(bot, "std/http", { timeoutMilliseconds: 30000 });

  app.get("/", (c) => c.text("Ok"));

  app.post("/telegram", (c) => {
    return streamText(c, async (stream) => {
      await stream.writeln("Ok");
      await stream.close();
      await handler(c.req.raw);
    });
  });

  app.post("/twitch", async (c) => {
    const message_type = c.req.header("Twitch-Eventsub-Message-Type");
    if (message_type === "webhook_callback_verification") {
      const data = await c.req.json();
      logger.log("Twitch", "webhook_callback_verification", data);
      return c.text(data.challenge);
    } else if (message_type === "notification") {
      const data = await c.req.json();
      return streamText(c, async (stream) => {
        await stream.close();
        await twitchEventHandler(data);
      });
    } else if (message_type === "revocation") {
      const data = await c.req.json();
      logger.log("Twitch", "revocation", data);
      return c.text("Ok");
    }

    return c.text("Ok");
  });

  app.get("/stream", async (c) => {
    if (c.req.query("title") === "") {
      return c.text(await getLastStreamTitle());
    } else {
      return c.json(await getLastStream());
    }
  });

  Deno.serve({ port: 8080, onListen: () => {} }, app.fetch);
}
