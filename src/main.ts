import { webhookCallback } from "@grammyjs/grammy";

import { isDenoDeploy } from "./utils.ts";
import { Hono } from "@hono/hono";
import { streamText } from "@hono/hono/streaming";
import { scheduleStats } from "./features/shorts-stat.ts";
import { twitchEventHandler } from "./twitch/event-handler.ts";
import { bot } from "./telegram/bot.ts";
import { getLastStream, getLastStreamTitle } from "./features/timecodes.ts";
import { fillBoostyGames, fillYoutubeGames } from "./features/games-url-to-google-sheets.ts";
import { fillBoostyRecords, fillTwitchRecords, fillYoutubeRecords } from "./features/records-url-to-goolge-sheets.ts";

Deno.cron("shorts stats", "0 0 26 * *", async () => {
  await scheduleStats();
});

Deno.cron("fill youtube games urls", "0 7 * * *", async () => {
  console.log("fill youtube games urls");
  await fillYoutubeGames();
});

Deno.cron("fill boosty games urls", "10 7 * * *", async () => {
  console.log("fill boosty games urls");
  await fillBoostyGames();
});

Deno.cron("fill twitch records urls", "20 7 * * *", async () => {
  console.log("fill twitch records urls");
  await fillTwitchRecords();
});

Deno.cron("fill youtube records urls", "30 7 * * *", async () => {
  console.log("fill youtube records urls");
  await fillYoutubeRecords();
});

Deno.cron("fill boosty records urls", "40 7 * * *", async () => {
  console.log("fill youtube records urls");
  await fillBoostyRecords();
});

if (!isDenoDeploy) {
  await bot.start();
} else {
  const server = new Hono();
  const handler = webhookCallback(bot, "std/http", { timeoutMilliseconds: 30000 });

  server.get("/", (c) => c.text("Ok"));

  server.post("/telegram", (c) => {
    return streamText(c, async (stream) => {
      await stream.writeln("Ok");
      await stream.close();
      await handler(c.req.raw);
    });
  });

  server.post("/twitch", async (c) => {
    const message_type = c.req.header("Twitch-Eventsub-Message-Type");
    if (message_type === "webhook_callback_verification") {
      const data = await c.req.json();
      console.log("Twitch webhook_callback_verification", data);
      return c.text(data.challenge);
    } else if (message_type === "notification") {
      const data = await c.req.json();
      return streamText(c, async (stream) => {
        await stream.close();
        await twitchEventHandler(data);
      });
    } else if (message_type === "revocation") {
      const data = await c.req.json();
      console.log("Twitch revocation", data);
      return c.text("Ok");
    }

    return c.text("Ok");
  });

  server.get("/stream", async (c) => {
    if (c.req.query("title") === "") {
      return c.text(await getLastStreamTitle());
    } else {
      return c.json(await getLastStream());
    }
  });

  server.get("/youtube", (c) => {
    const challenge = c.req.query("hub.challenge");
    console.log("Youtube challenge", challenge);
    if (challenge) return c.text(challenge, 200);
    return c.text("Ok");
  });

  server.post("/youtube", async (c) => {
    const data = await c.req.text();
    console.log("Youtube data", data);
    return c.text("Ok");
  });

  Deno.serve({ port: 8080, onListen: () => {} }, server.fetch);
}
