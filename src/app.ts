import { webhookCallback } from "@grammyjs/grammy";

import { getDb, isDenoDeploy, logger } from "./utils.ts";
import { Hono } from "@hono/hono";
import { streamText } from "@hono/hono/streaming";
import { createMiddleware } from "@hono/hono/factory";

import { twitchEventHandler } from "./twitch/event-handler.ts";
import { bot } from "./telegram/bot.ts";
import { getLastStream, getLastStreamTitle } from "./features/timecodes.ts";
import { fillGamesSheet } from "./features/games-url-to-google-sheets.ts";
import { fillRecordsSheet } from "./features/records-url-to-goolge-sheets.ts";
import { config } from "./config.ts";
import { getState } from "./state.ts";

const isAdminMiddleware = createMiddleware(async (c, next) => {
  const id = c.req.header("X-Admin-Id");
  if (id !== undefined && config.admins.includes(+id)) return await next();
  return c.text("Forbidden", 403);
});

export const app = new Hono();

app.get("/", (c) => c.text("Ok"));

if (isDenoDeploy) {
  const handler = webhookCallback(bot, "std/http", { timeoutMilliseconds: 30000 });
  app.post("/telegram", (c) => {
    return streamText(c, async (stream) => {
      await stream.writeln("Ok");
      await stream.close();
      await handler(c.req.raw);
    });
  });
}

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

app.all("/auth", (c) => {
  const code = c.req.query("code");
  if (code) {
    return c.text(`OK, code ${code}`);
  } else {
    return c.text("Error");
  }
});

app.get("/fillRecordsSheet", isAdminMiddleware, async (c) => {
  await fillRecordsSheet();
  return c.text("Ok");
});

app.get("/fillGamesSheet", isAdminMiddleware, async (c) => {
  await fillGamesSheet();
  return c.text("Ok");
});

app.get("/state", isAdminMiddleware, async (c) => {
  await using state = await getState();
  return c.json(state);
});

app.post("/state", isAdminMiddleware, async (c) => {
  const body = await c.req.json();
  const { db } = await getDb();
  await db.set(["state"], body);
  return c.text("Ok");
});
