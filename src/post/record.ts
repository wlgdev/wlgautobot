import {
  Boosty,
  BoostyBlogPost,
  Twitch,
  TwitchVodInfo,
  Youtube,
  YoutubeIdDetails,
  YoutubeVideoInfo,
} from "@shevernitskiy/scraperator";
import { config } from "../config.ts";
import { gemini, geminiThinking } from "../libs/gemini.ts";
import { Context, InputFile } from "@grammyjs/grammy";

import { MultiSelectMenu } from "../telegram/multi-select-menu.ts";
import { llmFallback } from "../libs/llm-fallback.ts";

const REGEX_DATE = /(\d{2}\/\d{2}\/\d{4})/;

export const vods_menu = new MultiSelectMenu({
  id: "vods",
  text: "найдено несколько водов, выберите какие крепить в пост",
  options: [],
  onSubmit: async (ctx, text, options) => {
    const vod_ids = options.filter((item) => item.check).map((item) => item.label.split("[vodid]")[1].trim());
    const yt_ids = text.split("[ytid]")[1].trim().split(",");
    await Promise.all([
      createPostForYoutubeIdWithVods(ctx, yt_ids, vod_ids),
      ctx.deleteMessage(),
    ]);
  },
});

export const yt_menu = new MultiSelectMenu({
  id: "yt",
  text: "найдено несколько видео, выберите какие крепить в пост",
  options: [],
  onSubmit: async (ctx, text, options) => {
    const yt_ids = options.filter((item) => item.check).map((item) => item.label.split("[ytid]")[1].trim());
    const date_of_stream = text.match(REGEX_DATE)?.[0];
    if (!date_of_stream) {
      throw new Error("не удалось получить дату стрима");
    }

    await Promise.all([
      getVodsForDate(ctx, date_of_stream, yt_ids),
      ctx.deleteMessage(),
    ]);
  },
});

export async function youtubeRecord(ctx: Context): Promise<void> {
  const search = ctx.match?.at(2);
  const { message_id } = await ctx.reply(
    search ? `⏳ работаем над постом для - ${search}` : "⏳ работаем над постом для последнего видео",
  );
  try {
    await proccessYoutubeStreamRecord(ctx, message_id, search);
  } catch (err) {
    await ctx.api.editMessageText(ctx.chatId!, message_id, `⛔ ${(err as Error).message}`).catch(() => {});
  }
}

export async function proccessYoutubeStreamRecord(
  ctx: Context,
  parent_message_id: number,
  search?: string,
): Promise<void> {
  const videos = await getYoutubeVideos(search).catch(() => {
    throw new Error(`не удалось найти видео${search ? ` по запросу ${search}` : ""}`);
  });

  const date_of_stream = videos[0].title.match(REGEX_DATE)?.[0];
  if (!date_of_stream) {
    throw new Error("не удалось получить дату стрима");
  }

  if (videos.length === 1) {
    await getVodsForDate(ctx, date_of_stream, videos.map((item) => item.id)).then(async () => {
      await ctx.api.deleteMessage(ctx.chatId!, parent_message_id);
    });
  } else {
    const ask = `для даты ${date_of_stream} найдено несколько видео на ютубе, выберите какие крепить в пост`;
    console.log(ask);
    await yt_menu
      .setText(ask)
      .setOptions(videos.map((item) => `${item.title} [ytid] ${item.id}`))
      .create(ctx)
      .then(async () => {
        await ctx.api.deleteMessage(ctx.chatId!, parent_message_id);
      });
  }
}

async function getVodsForDate(
  ctx: Context,
  // parent_message_id: number,
  date_of_stream: string,
  youtube_ids: string[],
): Promise<void> {
  const vods = await getTwitchVods(date_of_stream).catch(() => {
    throw new Error("не удалось получить список водов с твича");
  });

  const vod_name = (text: string) => (text.length > 70 ? `${text.slice(0, 70)}...` : text);

  if (vods.length > 1) {
    const ask = `для даты ${date_of_stream} найдено несколько водов, выберите какие крепить в пост [ytid] ${
      youtube_ids.join(",")
    }`;
    console.log(ask);
    await vods_menu
      .setText(ask)
      .setOptions(vods.map((item) => `${vod_name(item.title)} [vodid] ${item.id}`))
      .create(ctx);

    return;
  } else {
    await createPostForYoutubeIdWithVods(ctx, youtube_ids, vods.length === 1 ? [vods[0].id] : [])
      .catch(
        (err) => {
          throw err;
        },
      );
  }
}

async function createPostForYoutubeIdWithVods(
  ctx: Context,
  youtube_id: string[],
  vod_ids: string[],
) {
  try {
    const video_info = await getVideoInfoById(youtube_id[0]);
    const timecodes = video_info.map((item) => getTimecodesFromDescription(item.description));
    const date_of_stream = video_info[0].title.match(REGEX_DATE)?.[0];
    const boosty_post = await getBoostyPost(date_of_stream);

    let message_description = await generateDescription(timecodes.map((item) => item.join("\n")).join("\n")).catch(
      () => "не удалось сгенерировать описание",
    );

    if (!message_description.includes("YouTube")) {
      message_description = `⛔ Ошибка при генерации описания\n${message_description}\nВот ссылка на YouTube видео.`;
    }

    const tg_message = config.telegram.template.record(
      message_description,
      youtube_id.map((item) => `https://youtu.be/${item}`),
      vod_ids.map((item) => `https://www.twitch.tv/videos/${item}`),
      boosty_post.at(0)?.url,
    );

    console.log("Post Record", ctx.chatId, tg_message);

    await ctx.api.sendPhoto(ctx.chatId!, new InputFile(new URL(video_info[0].preview_url)), {
      caption: tg_message,
      parse_mode: "HTML",
    });

    // deno-lint-ignore no-explicit-any
  } catch (err: any) {
    await ctx.api.editMessageText(ctx.chatId!, ctx.message?.message_id!, `⛔ ${err.message}`).catch(() => {});
  }
}

function getTimecodesFromDescription(text: string): string[] {
  const matches = text.matchAll(/(\d+:\d+:\d+) – (.+)/g);
  const timecodes = Array.from(matches).map((match) => match[0]);
  return timecodes;
}

function getStreamPartsFromDescription(text: string): { part_name: string; part_title: string }[] {
  const matches = text.matchAll(/(\d+\sчасть)\sстрима:\s+(.+)/g);
  const parts = Array.from(matches).map((match) => ({
    part_name: match[1].trim(),
    part_title: match[2].trim(),
  }));
  return parts;
}

function getStreamPartsWithIds(
  parts: { part_name: string; part_title: string }[],
  video_info: YoutubeIdDetails,
): { part_name: string; part_title: string; video_id: string }[] {
  const out = [];
  for (const part of parts) {
    const part_title = part.part_title;
    const part_name = part.part_name;
    const index = video_info.description_entities.findIndex(
      (item) => item.content.trim() === part_title && item.video_id !== undefined,
    );
    if (index < 0) continue;
    const part_id = video_info.description_entities[index].video_id;
    video_info.description_entities.splice(index, 1);

    out.push({
      part_name,
      part_title,
      video_id: part_id,
    });
  }
  return out;
}

async function generateDescription(timecodes: string): Promise<string> {
  const prompt = config.llm.stream_record_prompt(timecodes);

  const answer = await llmFallback(prompt, [
    [geminiThinking, "gemini-2.5-flash-preview-04-17"],
    [gemini, "gemini-2.0-flash"],
  ]).catch((err) => {
    console.error(err);
    throw new Error("не удалось сгенерить описание, ошибка обращения к AI");
  });

  // const answer = await geminiThinking(prompt, "gemini-2.5-flash-preview-04-17").catch((err) => {
  //   console.error(err);
  //   throw new Error("не удалось сгенерить описание, ошибка обращения к AI");
  // });

  return answer.replaceAll("с зрителями", "со зрителями").replace("</result>", "").replace("<result>", "").trim();
}

async function getYoutubeVideos(search?: string): Promise<YoutubeVideoInfo[]> {
  const yt = new Youtube(config.youtube.channel_vod);
  const videos = await yt.getVideos();
  if (videos.items.length === 0) {
    throw new Error("не удалось получить список видео");
  }
  if (!search) {
    const date_of_stream = videos.items[0].title.match(REGEX_DATE)?.[0];
    if (date_of_stream) {
      search = date_of_stream;
    }
  }
  const result = search ? videos.items.filter((item) => item.title.includes(search)) : [videos.items[0]];
  if (result.length === 0) {
    throw new Error(`не удалось получить список видео по запросу ${search}`);
  }
  return result.reverse();
}

async function getTwitchVods(search?: string): Promise<TwitchVodInfo[]> {
  const tw = new Twitch(config.twitch.channel);
  const vods = await tw.vods("TIME", 90, "ARCHIVE");

  return search ? vods.filter((item) => item.title.includes(search)) : vods;
}

async function getBoostyPost(search?: string): Promise<BoostyBlogPost[]> {
  // TODO: remove if it will be possibleto fetch direct
  const boosty = new Boosty(config.boosty.channel, "https://boostyflare.mahahuha5816.workers.dev/forward?url=");
  const posts = await boosty.getBlog().catch((err) => {
    console.error(err);
    return [];
  });

  return search ? posts.filter((item) => item.title.includes(search)) : posts;
}

async function getVideoInfoById(id: string): Promise<YoutubeIdDetails[]> {
  const yt = new Youtube(config.youtube.channel_vod);
  let video_info = [
    await yt.getIdInfo(id).catch((err) => {
      console.error(err);
      throw new Error(`не удалось получить информацию о видео ${id}`);
    }),
  ];

  // const date_of_stream = video_info[0].title.match(REGEX_DATE)?.[0];
  const stream_parts = getStreamPartsFromDescription(video_info[0].description);
  const stream_parts_with_id = stream_parts.length > 0 ? getStreamPartsWithIds(stream_parts, video_info[0]) : [];

  if (stream_parts_with_id.length > 0) {
    video_info = await Promise.all(stream_parts_with_id.map((item) => yt.getIdInfo(item.video_id))).catch(() => {
      throw new Error("не удалось получить информацию о всех частях видео");
    });
  }

  return video_info;
}
