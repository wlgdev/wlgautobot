import { Bot } from "@grammyjs/grammy";

import { youtubeVkClip } from "../post/clip.ts";
import { config } from "../config.ts";
import { vods_menu, youtubeRecord, yt_menu } from "../post/record.ts";
import { youtubeVideoCut } from "../post/video-cut.ts";
import { streamTimecodes } from "../features/timecodes.ts";
import { shortsStats } from "../features/shorts-stat.ts";
import { boostyBosts } from "../features/boosty-posts.ts";
import { logger } from "../utils.ts";

export const bot = new Bot(config.telegram.token);

bot.use(async (ctx, next) => {
  if (!ctx.hasChatType("private") || !config.admins.includes(ctx.from?.id ?? 0)) {
    await ctx.reply("нет доступа").catch(() => {});
  } else {
    logger.log("Telegram", ctx.from?.id, ctx.message?.text);
    await next();
  }
});

bot.hears(/^(\/ping|пинг|ping)/, async (ctx) => {
  await ctx.reply("pong");
});

bot.hears(/^(\/clip|клип|clip)\s*(.+){0,1}/, async (ctx) => {
  await youtubeVkClip(ctx);
});

bot.use(yt_menu.handler());
bot.use(vods_menu.handler());
bot.hears(/^(\/record|запись|record|вод|vod)\s*(.+){0,1}/, async (ctx) => {
  await youtubeRecord(ctx);
});

bot.hears(/^(\/cut|нарезка|кат|cut)\s*(.+){0,1}/, async (ctx) => {
  await youtubeVideoCut(ctx);
});

bot.hears(/^(\/timecodes|таймкоды|timecodes)/, async (ctx) => {
  await streamTimecodes(ctx);
});

bot.hears(/^(\/shorts|шортсы|shorts)\s*(.+){0,1}/, async (ctx) => {
  await shortsStats(ctx);
});

bot.hears(/^(\/boosty|бусти|boosty)\s*(.+){0,1}/, async (ctx) => {
  await boostyBosts(ctx);
});

bot.catch((err) => logger.error("Telegram", err));
