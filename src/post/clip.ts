// deno-lint-ignore-file no-explicit-any
import { Vk, type VkVideoInfo } from "@shevernitskiy/scraperator";
import { config } from "../config.ts";
import { stripHashtags, tsToString } from "../utils.ts";
import { Context } from "@grammyjs/grammy";
import { getTikTokUserVideo, TikTokVideoItem } from "../libs/tiktok.ts";
import { YoutubeApi, type YoutubePlaylistVideoInfo } from "../libs/youtube-api.ts";

type YoutubeShortsInfo = {
  id: string;
  title: string;
  channel_id: string;
  channel_title: string;
  description: string;
  url: string;
};

export async function youtubeVkClip(ctx: Context): Promise<void> {
  const search = ctx.match?.at(2);
  const { message_id } = await ctx.reply(
    search ? `⏳ работаем над постом для ${search}...` : "⏳ работаем над постом для последнего шортса...",
  );
  try {
    const { text, url } = await processClip(search);

    console.log("Post Clip", ctx.chat?.id, text, url);

    await ctx
      .reply(text, {
        parse_mode: "HTML",
        link_preview_options: {
          url,
          is_disabled: false,
        },
      })
      .finally(async () => await ctx.deleteMessages([message_id]));
  } catch (err: any) {
    await ctx.api.editMessageText(ctx.chatId!, message_id, `⛔ ${err.message}`).catch(() => {});
  }
}

export type EntryItem = {
  key: string;
  youtube?: YoutubePlaylistVideoInfo;
  vk?: VkVideoInfo;
  tiktok?: TikTokVideoItem;
};

export async function processClip(search?: string): Promise<{ text: string; url: string }> {
  const vk = new Vk(config.vk.channel);
  const youtube = new YoutubeApi(config.youtube.apikey);

  const [yt_res, vk_res, tt_res] = await Promise.all([
    youtube.getPlaylistItems(config.youtube.shorts_playlist_id, 50),
    vk.getClips(50),
    getTikTokUserVideo(config.tiktok.channel, config.tiktok.rapidkey),
  ]).catch((err) => {
    console.error(err);
    throw new Error("не удалось загрузить клипы/шортсы с вк и ютуба");
  });

  const entries = recentClips(yt_res, vk_res, tt_res.items).filter(
    (item) => item.youtube !== undefined && item.vk !== undefined && item.tiktok !== undefined,
  );

  if (entries.length === 0) {
    throw new Error("не удалось найти подходящие клипы/шортсы с вк и ютуба");
  }

  const entry = search
    ? entries.find(
      (item) =>
        tsToString(item.vk?.date ?? 0).includes(search) ||
        item.key.includes(search) ||
        item.vk?.title?.includes(search) ||
        item.youtube?.title?.includes(search) ||
        item.tiktok?.title?.includes(search),
    )
    : entries[0];

  if (!entry || entry.youtube === undefined || entry.vk === undefined || entry.tiktok === undefined) {
    throw new Error("не удалось найти подходящие клипы/шортсы с вк и ютуба");
  }

  const urls: [string, string][] = [["YouTube", entry.youtube.shorts_url]];
  if (entry.vk.url) {
    urls.push(["VK", entry.vk.url]);
  }
  if (entry.tiktok.url) {
    urls.push(["TikTok", entry.tiktok.url]);
  }

  const tg_message = config.telegram.template.clip(entry.key, urls);

  return {
    text: tg_message,
    url: entry.youtube?.url!,
  };
}

export function recentClips(
  youtube: YoutubePlaylistVideoInfo[],
  vk: VkVideoInfo[],
  tiktok: TikTokVideoItem[],
): EntryItem[] {
  const data = new Map<string, EntryItem>();

  for (const item of vk) {
    const key = stripHashtags(item.description.startsWith("Clip by") ? item.title : item.description);
    if (data.has(key)) {
      const entry = data.get(key) ?? { key: key };
      entry.vk = item;
      data.set(key, entry);
    } else {
      data.set(key, {
        key: key,
        vk: item,
      });
    }
  }

  for (const item of youtube) {
    const key = stripHashtags(item.title);
    if (data.has(key)) {
      const entry = data.get(key) ?? { key: key };
      entry.youtube = item;
      data.set(key, entry);
    } else {
      data.set(key, {
        key: key,
        youtube: item,
      });
    }
  }

  for (const item of tiktok) {
    const key = stripHashtags(item.title);
    if (data.has(key)) {
      const entry = data.get(key) ?? { key: key };
      entry.tiktok = item;
      data.set(key, entry);
    } else {
      data.set(key, {
        key: key,
        tiktok: item,
      });
    }
  }

  return Array.from(data.values())
    .filter((item) => item.vk?.id !== undefined && item.youtube?.id !== undefined && item.tiktok?.id !== undefined)
    .sort((a, b) => (b.vk?.date ?? 0) - (a.vk?.date ?? 0));
}
