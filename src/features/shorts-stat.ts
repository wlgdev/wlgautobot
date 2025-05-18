import { JWT } from "google-auth-library";
import { Vk, Youtube } from "@shevernitskiy/scraperator";
import { Context, InputFile } from "@grammyjs/grammy";
import { config } from "../config.ts";
import { getTikTokUserVideo } from "../libs/tiktok.ts";
import { getState } from "../state.ts";

type StatsDataEntry = {
  date: string;
  title: string;
  hashtags: string;
  yt_views: number;
  yt_likes: number;
  yt_comments: number;
  yt_favorites: number;
  vk_views: number;
  vk_likes: number;
  vk_comments: number;
  vk_reposts: number;
  tt_views: number;
  tt_likes: number;
  tt_comments: number;
  tt_reposts: number;
};

type YoutubeVideoStats = {
  id: string;
  title: string;
  channel_id: string;
  channel_title: string;
  description: string;
  category_id: string;
  thumbnail: string;
  tags: string[];
  views: string;
  likes: string;
  favorites: string;
  comments: string;
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
    await ctx.api.editMessageText(ctx.chatId!, message_id, `⛔ ${(err as Error).message}`).catch(() => {});
  }
}

export async function fetchShortStatsData(limit?: string): Promise<StatsDataEntry[]> {
  const youtube = new Youtube(config.youtube.channel);
  const vk = new Vk(config.vk.channel);
  const [shorts, clips, tiktok] = await Promise.all([
    youtube.getShorts(),
    vk.getClips(60),
    getTikTokUserVideo(config.tiktok.channel, config.tiktok.rapidkey, 50),
  ]);

  const youtube_shorts_stats = await getYoutubeVideoStats(shorts.items.map((item) => item.id));

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
        vk_views: clip ? clip.views : 0,
        vk_likes: clip ? clip.likes : 0,
        vk_comments: clip ? clip.comments : 0,
        vk_reposts: clip ? clip.reposts : 0,
        tt_views: tiktok_item ? tiktok_item.plays : 0,
        tt_likes: tiktok_item ? tiktok_item.diggs : 0,
        tt_comments: tiktok_item ? tiktok_item.comments : 0,
        tt_reposts: tiktok_item ? tiktok_item.shares : 0,
      } satisfies StatsDataEntry,
    );
  }

  return out;
}

async function getYoutubeVideoStats(ids: string[]): Promise<YoutubeVideoStats[]> {
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?key=${config.youtube.apikey}&part=snippet,statistics&id=${
      ids.join(",")
    }`,
  );

  if (!res.ok) {
    throw new Error(
      `Failed to fetch data from Youtube API ${res.body ? await res.text() : ""}`,
    );
  }

  const data = await res.json();

  // deno-lint-ignore no-explicit-any
  return data.items.map((item: any) => {
    return {
      id: item.id,
      title: item.snippet.title,
      channel_id: item.snippet.channelId,
      channel_title: item.snippet.channelTitle,
      description: item.snippet.description,
      category_id: item.snippet.categoryId,
      thumbnail: item.snippet.thumbnails.maxres.url,
      tags: item.snippet.tags,
      views: item.statistics.viewCount,
      likes: item.statistics.likeCount,
      favorites: item.statistics.favoriteCount,
      comments: item.statistics.commentCount,
    } satisfies YoutubeVideoStats;
  });
}

function formatDate(date: Date): string {
  return `${date.getDate().toString().padStart(2, "0")}.${
    (date.getMonth() + 1).toString().padStart(2, "0")
  }.${date.getFullYear()}`;
}

export async function generateCSV(limit?: string): Promise<string[]> {
  const data = await fetchShortStatsData(limit);

  return [
    "date;title;hashtags;yt_views;yt_likes;yt_comments;yt_favorites;vk_views;vk_likes;vk_comments;vk_reposts;tt_views;tt_likes;tt_comments;tt_reposts",
    ...data.map(
      (item) =>
        `${item.date};${item.title};${item.hashtags};${item.yt_views};${item.yt_likes};${item.yt_comments};${item.yt_favorites};${item.vk_views};${item.vk_likes};${item.vk_comments};${item.vk_reposts};${item.tt_views};${item.tt_likes};${item.tt_comments};${item.tt_reposts}`,
    ),
  ];
}

export async function scheduleStats(): Promise<void> {
  await using state = await getState();

  const data = await fetchShortStatsData(state.stats.last_title);
  console.log("Short Stats schedule: fetched items", data.length);
  if (data.length === 0) return;
  state.stats.last_title = data[0].title;
  await insertFirstRowsRaw(data).catch((error) => {
    console.error("Google Sheets error", error);
  });
  console.log("Short Stats schedule: inserted rows", data.length);
}

async function insertFirstRowsRaw(rows: StatsDataEntry[]): Promise<void> {
  const client = new JWT({
    email: config.google_sheets.email,
    key: config.google_sheets.key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const res = await client.request({
    url: `https://sheets.googleapis.com/v4/spreadsheets/${config.short_stats.spreadsheet_id}:batchUpdate`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [
        {
          insertDimension: {
            inheritFromBefore: false,
            range: {
              sheetId: config.short_stats.sheet_id,
              dimension: "ROWS",
              startIndex: 1,
              endIndex: rows.length + 1,
            },
          },
        },
        {
          updateCells: {
            rows: rows.map((row) => {
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
                ],
              };
            }),
            fields: "userEnteredValue,userEnteredFormat.backgroundColor,userEnteredFormat.textFormat.foregroundColor",
            range: {
              sheetId: config.short_stats.sheet_id,
              startRowIndex: 1,
              endRowIndex: rows.length + 1,
              startColumnIndex: 0,
              endColumnIndex: Object.keys(rows[0]).length + 1,
            },
          },
        },
      ],
    }),
  });

  if (res.status !== 200) {
    console.error("Google Sheets Error inserting row -", res.status, res.data);
  } else {
    console.info("Google Sheets: inserted", rows.length);
  }
}
