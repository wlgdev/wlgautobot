// deno-lint-ignore-file no-explicit-any
import { wlgdlTrigger } from "../libs/wlgdl-trigger.ts";
import { streamStart } from "./stream-start.ts";
import { streamUpdate } from "./stream-update.ts";
import { streamEnd } from "./stream-end.ts";
import { logger } from "../utils.ts";

export async function twitchEventHandler(event: any): Promise<void> {
  switch (event.subscription.type) {
    case "channel.update":
      await handleChannelUpdate(event);
      break;
    case "stream.online":
      await handleStreamOnline(event);
      break;
    case "stream.offline":
      await handleStreamOffline(event);
      break;
  }
}

async function handleChannelUpdate({ event }: any): Promise<void> {
  logger.log("Twitch", "Stream update", event.title, event.category_name, event.category_id);
  await streamUpdate(event.title, event.category_name, event.category_id);
}
async function handleStreamOnline({ event }: any): Promise<void> {
  logger.log("Twitch", "Stream online", event.broadcaster_user_id, event.login);
  await Promise.allSettled([
    streamStart(),
    wlgdlTrigger(),
  ]);
}
async function handleStreamOffline({ event }: any): Promise<void> {
  logger.log("Twitch", "Stream offline", event.broadcaster_user_id, event.login);
  await streamEnd();
}
