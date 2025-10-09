import { Vk } from "@shevernitskiy/scraperator";
import { Context, InputFile } from "@grammyjs/grammy";
import { config } from "../config.ts";
import { getTikTokUserVideo } from "../libs/tiktok.ts";
import { getState } from "../state.ts";
import { YoutubeApi } from "../libs/youtube-api.ts";
import { GoogleSheets } from "../libs/google-sheets.ts";
import { logger } from "../utils.ts";

type StatsDataEntry = {
  date: string;
  title: string;
  hashtags: string;
  yt_views: number;
  yt_likes: number;
  yt_comments: number;
  yt_favorites: number;
  yt_url: string;
  vk_views: number;
  vk_likes: number;
  vk_comments: number;
  vk_reposts: number;
  vk_url: string;
  tt_views: number;
  tt_likes: number;
  tt_comments: number;
  tt_reposts: number;
  tt_url: string;
};

const HIGHLIGHT_LIMIT = 30000;
const highlight_format = {
  backgroundColor: {
    red: 1.0,
    green: 0.902,
    blue: 0.902,
  },
  textFormat: {
    foregroundColor: {
      red: 0.784,
      green: 0.0,
      blue: 0.0,
    },
  },
};

export async function shortsStats(ctx: Context): Promise<void> {
  const limit = ctx.match?.at(2);

  const { message_id } = await ctx.reply(
    limit ? `⏳ работаем над статой до - ${limit}` : "⏳ работаем над статой по последним шортсам",
  );
  try {
    const csv = await generateCSV(limit);

    await ctx.api
      .sendDocument(ctx.chatId!, new InputFile(new TextEncoder().encode(csv.join("\n")), "shorts-stat.csv"), {
        caption: `📊 статистика по шортсам, всего ${csv.length}, ${new Date().toLocaleDateString()}`,
      })
      .then(async () => {
        await ctx.api.deleteMessage(ctx.chatId!, message_id);
      });
  } catch (err) {
    logger.error("Shorts Stat", err);
    await ctx.api.editMessageText(ctx.chatId!, message_id, `⛔ ${(err as Error).message}`).catch(() => {});
  }
}

export async function fetchShortStatsData(limit?: string): Promise<StatsDataEntry[]> {
  const youtube = new YoutubeApi(config.youtube.apikey);
  const vk = new Vk(config.vk.channel);
  const [shorts, clips, tiktok] = await Promise.all([
    youtube.getPlaylistItems(config.youtube.shorts_playlist_id, 50),
    vk.getClips(60),
    getTikTokUserVideo(config.tiktok.channel, config.tiktok.rapidkey, 50),
  ]);

  const youtube_shorts_stats = await youtube.getVideos(shorts.map((item) => item.id));

  const out: StatsDataEntry[] = [];

  for (const short of youtube_shorts_stats) {
    const title = short.title.split("#")[0].trim();
    const hashtags = short.title.replace(title, "").trim();
    if (limit && short.title.includes(limit)) break;
    const clip = clips.find((item) => title.includes(item.title));
    const tiktok_item = tiktok.items.find((item) => item.title.startsWith(title));

    out.push(
      {
        date: formatDate(clip ? new Date(clip.date) : new Date()),
        title,
        hashtags,
        yt_views: parseInt(short.views) ?? 0,
        yt_likes: parseInt(short.likes) ?? 0,
        yt_comments: parseInt(short.comments) ?? 0,
        yt_favorites: parseInt(short.favorites) ?? 0,
        yt_url: short.shorts_url,
        vk_views: clip ? clip.views : 0,
        vk_likes: clip ? clip.likes : 0,
        vk_comments: clip ? clip.comments : 0,
        vk_reposts: clip ? clip.reposts : 0,
        vk_url: clip ? clip.url : "",
        tt_views: tiktok_item ? tiktok_item.plays : 0,
        tt_likes: tiktok_item ? tiktok_item.diggs : 0,
        tt_comments: tiktok_item ? tiktok_item.comments : 0,
        tt_reposts: tiktok_item ? tiktok_item.shares : 0,
        tt_url: tiktok_item ? tiktok_item.url : "",
      } satisfies StatsDataEntry,
    );
  }

  return out;
}

function formatDate(date: Date): string {
  return `${date.getDate().toString().padStart(2, "0")}.${
    (date.getMonth() + 1).toString().padStart(2, "0")
  }.${date.getFullYear()}`;
}

export async function generateCSV(limit?: string): Promise<string[]> {
  const data = await fetchShortStatsData(limit);

  return [
    "date;title;hashtags;yt_views;yt_likes;yt_comments;yt_favorites;vk_views;vk_likes;vk_comments;vk_reposts;tt_views;tt_likes;tt_comments;tt_reposts;yt_url;vk_url;tt_url",
    ...data.map(
      (item) =>
        `${item.date};${item.title};${item.hashtags};${item.yt_views};${item.yt_likes};${item.yt_comments};${item.yt_favorites};${item.vk_views};${item.vk_likes};${item.vk_comments};${item.vk_reposts};${item.tt_views};${item.tt_likes};${item.tt_comments};${item.tt_reposts};${item.yt_url};${item.vk_url};${item.tt_url}`,
    ),
  ];
}

export async function scheduleStats(): Promise<void> {
  await using state = await getState();
  const data = await fetchShortStatsData(state.stats.last_title);
  logger.log("Shorts Stat", "schedule: fetched items", data.length);
  if (data.length === 0) return;
  state.stats.last_title = data[0].title;
  await insertFirstRowsRaw(data).catch((error) => {
    logger.error("Shorts Stat", "Google Sheets error", error);
  });
  logger.log("Shorts Stat", "schedule: inserted rows", data.length);
}

async function insertFirstRowsRaw(rows: StatsDataEntry[]): Promise<void> {
  const googleSheets = new GoogleSheets(config.short_stats.spreadsheet_id, config.short_stats.sheet_id);

  await googleSheets.batchRequest([
    googleSheets.insertRowsRequest(rows.length, 1),
    googleSheets.updateRowsRequest(
      rows.map((row) => {
        return {
          values: [
            { userEnteredValue: { stringValue: row.date } },
            { userEnteredValue: { stringValue: row.title } },
            { userEnteredValue: { stringValue: row.hashtags } },
            {
              userEnteredValue: { numberValue: row.yt_views },
              userEnteredFormat: row.yt_views > HIGHLIGHT_LIMIT ? highlight_format : undefined,
            },
            { userEnteredValue: { numberValue: row.yt_likes } },
            { userEnteredValue: { numberValue: row.yt_comments } },
            { userEnteredValue: { numberValue: row.yt_favorites } },
            {
              userEnteredValue: { numberValue: row.vk_views },
              userEnteredFormat: row.vk_views > HIGHLIGHT_LIMIT ? highlight_format : undefined,
            },
            { userEnteredValue: { numberValue: row.vk_likes } },
            { userEnteredValue: { numberValue: row.vk_comments } },
            { userEnteredValue: { numberValue: row.vk_reposts } },
            {
              userEnteredValue: { numberValue: row.tt_views },
              userEnteredFormat: row.tt_views > HIGHLIGHT_LIMIT ? highlight_format : undefined,
            },
            { userEnteredValue: { numberValue: row.tt_likes } },
            { userEnteredValue: { numberValue: row.tt_comments } },
            { userEnteredValue: { numberValue: row.tt_reposts } },
            googleSheets.urlCell(row.yt_url ?? "", [row.yt_url ?? ""]),
            googleSheets.urlCell(row.vk_url ?? "", [row.vk_url ?? ""]),
            googleSheets.urlCell(row.tt_url ?? "", [row.tt_url ?? ""]),
          ],
        };
      }),
      ["userEnteredValue", "userEnteredFormat", "textFormatRuns"],
      1,
    ),
  ]);
}
