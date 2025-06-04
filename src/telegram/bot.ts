import { Bot, Context } from "@grammyjs/grammy";

import { youtubeVkClip } from "../post/clip.ts";
import { config } from "../config.ts";
import { vods_menu, youtubeRecord, yt_menu } from "../post/record.ts";
import { youtubeVideoCut } from "../post/video-cut.ts";
import { streamTimecodes } from "../features/timecodes.ts";
import { shortsStats } from "../features/shorts-stat.ts";
import { boostyBosts } from "../features/boosty-posts.ts";
import { fillBoostyUrls, fillYoutubeUrls } from "../features/record-url-to-google-sheets.ts";

export const bot = new Bot(config.telegram.token);
const admin_filter = (ctx: Context) => ctx.hasChatType("private") && config.admins.includes(ctx.from?.id ?? 0);

bot.filter(admin_filter).hears(/^(\/ping|пинг|ping)/, async (ctx) => {
  await ctx.reply("pong");
});

bot.filter(admin_filter).hears(/^(\/clip|клип|clip)\s*(.+){0,1}/, async (ctx) => {
  console.log(ctx.from?.id, ctx.message?.text);
  await youtubeVkClip(ctx);
});

bot.filter(admin_filter).use(yt_menu.handler());
bot.filter(admin_filter).use(vods_menu.handler());
bot.filter(admin_filter).hears(/^(\/record|запись|record|вод|vod)\s*(.+){0,1}/, async (ctx) => {
  console.log(ctx.from?.id, ctx.message?.text);
  await youtubeRecord(ctx);
});

bot.filter(admin_filter).hears(/^(\/cut|нарезка|кат|cut)\s*(.+){0,1}/, async (ctx) => {
  console.log(ctx.from?.id, ctx.message?.text);
  await youtubeVideoCut(ctx);
});

bot.filter(admin_filter).hears(/^(\/timecodes|таймкоды|timecodes)/, async (ctx) => {
  console.log(ctx.from?.id, ctx.message?.text);
  await streamTimecodes(ctx);
});

bot.filter(admin_filter).hears(/^(\/shorts|шортсы|shorts)\s*(.+){0,1}/, async (ctx) => {
  console.log(ctx.from?.id, ctx.message?.text);
  await shortsStats(ctx);
});

bot.filter(admin_filter).hears(/^(\/boosty|бусти|boosty)\s*(.+){0,1}/, async (ctx) => {
  console.log(ctx.from?.id, ctx.message?.text);
  await boostyBosts(ctx);
});

bot.filter(admin_filter).hears(/^(ссылкиб)/, async (ctx) => {
  console.log(ctx.from?.id, ctx.message?.text);
  await fillBoostyUrls();
});

bot.filter(admin_filter).hears(/^(ссылкию)/, async (ctx) => {
  console.log(ctx.from?.id, ctx.message?.text);
  await fillYoutubeUrls();
});

bot.catch((err) => {
  console.error(err);
});
