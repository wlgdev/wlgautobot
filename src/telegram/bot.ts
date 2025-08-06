import { Bot, Context } from "@grammyjs/grammy";

import { youtubeVkClip } from "../post/clip.ts";
import { config } from "../config.ts";
import { vods_menu, youtubeRecord, yt_menu } from "../post/record.ts";
import { youtubeVideoCut } from "../post/video-cut.ts";
import { streamTimecodes } from "../features/timecodes.ts";
import { shortsStats } from "../features/shorts-stat.ts";
import { boostyBosts } from "../features/boosty-posts.ts";
import { fillBoostyGames, fillYoutubeGames } from "../features/games-url-to-google-sheets.ts";
import { fillBoostyRecords, fillTwitchRecords, fillYoutubeRecords } from "../features/records-url-to-goolge-sheets.ts";
import { addGameToGoogleSheet } from "../features/game-to-google-sheet.ts";

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

bot.filter(admin_filter).hears(/^(\/urls)\s(\w+)\s(\w+)/, async (ctx) => {
  console.log(ctx.from?.id, ctx.message?.text);

  if (ctx.match?.at(2) === "games") {
    if (ctx.match?.at(3) === "youtube") await fillYoutubeGames();
    if (ctx.match?.at(3) === "boosty") await fillBoostyGames();
  }

  if (ctx.match?.at(2) === "records") {
    if (ctx.match?.at(3) === "twitch") await fillTwitchRecords();
    if (ctx.match?.at(3) === "youtube") await fillYoutubeRecords();
    if (ctx.match?.at(3) === "boosty") await fillBoostyRecords();
  }
});

bot.filter(admin_filter).hears(/^(\/game)\s"(.*)"\s"(.*)"/, async (ctx) => {
  console.log(ctx.from?.id, ctx.message?.text);
  const first_game_in_day = ctx.match?.at(3) === "true";
  await addGameToGoogleSheet(ctx.match?.at(2) ?? "Just Chatting", first_game_in_day);
});

bot.catch((err) => {
  console.error(err);
});
