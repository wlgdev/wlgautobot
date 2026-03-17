import { Boosty, BoostyBlogPost, Twitch, TwitchVodInfo, Vk, type VkVideoInfo } from "@shevernitskiy/scraperator";
import { config } from "../config.ts";
import { Gemini, llmFallback } from "@shevernitskiy/llm";
import { Context, InputFile } from "@grammyjs/grammy";
import { MultiSelectMenu } from "../telegram/multi-select-menu.ts";
import { logger } from "../utils.ts";

const REGEX_DATE = /(\d{2}\/\d{2}\/\d{4})/;

export const vk_vods_menu = new MultiSelectMenu({
  id: "vods_vk",
  text: "найдено несколько водов, выберите какие крепить в пост",
  options: [],
  onSubmit: async (ctx, text, options) => {
    const vod_ids = options.filter((item) => item.check).map((item) => item.label.split("[vodid]")[1].trim());
    const vk_ids = text.split("[vkid]")[1].trim().split(",").map((id) => Number(id))
      .filter((id) => !Number.isNaN(id));
    await Promise.all([
      createPostForVkIdWithVods(ctx, vk_ids, vod_ids),
      ctx.deleteMessage(),
    ]);
  },
});

export const vk_menu = new MultiSelectMenu({
  id: "vk",
  text: "найдено несколько видео, выберите какие крепить в пост",
  options: [],
  onSubmit: async (ctx, text, options) => {
    const vk_ids = options
      .filter((item) => item.check)
      .map((item) => Number(item.label.split("[vkid]")[1].trim()))
      .filter((id) => !Number.isNaN(id));
    const date_of_stream = text.match(REGEX_DATE)?.[0];
    if (!date_of_stream) {
      throw new Error("не удалось получить дату стрима");
    }

    await Promise.all([
      getVodsForDate(ctx, date_of_stream, vk_ids),
      ctx.deleteMessage(),
    ]);
  },
});

export async function vkRecord(ctx: Context): Promise<void> {
  const search = ctx.match?.at(2)?.trim();
  const { message_id } = await ctx.reply(
    search ? `⏳ работаем над постом для - ${search}` : "⏳ работаем над постом для последнего видео",
  );
  try {
    await proccessVkStreamRecord(ctx, message_id, search);
  } catch (err) {
    await ctx.api.editMessageText(ctx.chatId!, message_id, `⛔ ${(err as Error).message}`).catch(() => {});
  }
}

export async function proccessVkStreamRecord(
  ctx: Context,
  parent_message_id: number,
  search?: string,
): Promise<void> {
  const videos = await getVkVideos(search).catch(() => {
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
    const ask = `для даты ${date_of_stream} найдено несколько видео в VK, выберите какие крепить в пост`;
    logger.log("Post Record VK", ask);
    await vk_menu
      .setText(ask)
      .setOptions(videos.map((item) => `${item.title} [vkid] ${item.id}`))
      .create(ctx)
      .then(async () => {
        await ctx.api.deleteMessage(ctx.chatId!, parent_message_id);
      });
  }
}

async function getVodsForDate(
  ctx: Context,
  date_of_stream: string,
  vk_ids: number[],
): Promise<void> {
  const vods = await getTwitchVods(date_of_stream).catch(() => {
    throw new Error("не удалось получить список водов с твича");
  });

  const vod_name = (text: string) => (text.length > 70 ? `${text.slice(0, 70)}...` : text);

  if (vods.length > 1) {
    const ask = `для даты ${date_of_stream} найдено несколько водов, выберите какие крепить в пост [vkid] ${
      vk_ids.join(",")
    }`;
    logger.log("Post Record VK", ask);
    await vk_vods_menu
      .setText(ask)
      .setOptions(vods.map((item) => `${vod_name(item.title)} [vodid] ${item.id}`))
      .create(ctx);

    return;
  } else {
    await createPostForVkIdWithVods(ctx, vk_ids, vods.length === 1 ? [vods[0].id] : [])
      .catch(
        (err) => {
          throw err;
        },
      );
  }
}

async function createPostForVkIdWithVods(
  ctx: Context,
  vk_ids: number[],
  vod_ids: string[],
) {
  try {
    const video_info = await getVkVideosByIds(vk_ids);
    const timecodes = video_info.map((item) => getTimecodesFromDescription(item.description));
    const date_of_stream = video_info[0].title.match(REGEX_DATE)?.[0];
    const boosty_post = await getBoostyPost(date_of_stream);

    let message_description = await generateDescription(timecodes.map((item) => item.join("\n")).join("\n")).catch(
      () => "не удалось сгенерировать описание",
    );

    if (!message_description.includes("VK")) {
      message_description = `⛔ Ошибка при генерации описания\n${message_description}\nВот ссылка на VK видео.`;
    }

    const tg_message = config.telegram.template.record_vk(
      message_description,
      video_info.map((item) => item.url),
      vod_ids.map((item) => `https://www.twitch.tv/videos/${item}`),
      boosty_post.at(0)?.url,
    );

    logger.log("Post Record VK", ctx.chatId, tg_message);

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

async function generateDescription(timecodes: string): Promise<string> {
  const gemini = new Gemini(config.llm.gemini.key);
  const prompt = config.llm.stream_record_prompt_vk(timecodes);

  const answer = await llmFallback(prompt, [
    [gemini, "gemini-2.5-flash-lite"],
  ]).catch((err) => {
    logger.error("Post Record VK", err);
    throw new Error("не удалось сгенерить описание, ошибка обращения к AI");
  });

  return answer.replaceAll("с зрителями", "со зрителями").replace("</result>", "").replace("<result>", "").replaceAll(
    "*",
    "",
  ).trim();
}

async function getVkVideos(search?: string): Promise<VkVideoInfo[]> {
  const vk = new Vk(config.vk.channel);
  let videos = await vk.getVideos().catch((err) => {
    logger.error("Post Record VK", err);
    throw new Error("не удалось получить список видео vk");
  });

  if (videos.length === 0) {
    throw new Error("не удалось получить список видео vk");
  }

  videos = videos.sort((a, b) => b.date - a.date);

  if (!search) {
    const date_of_stream = videos[0].title.match(REGEX_DATE)?.[0];
    if (date_of_stream) {
      search = date_of_stream;
    }
  }

  const result = search ? videos.filter((item) => item.title.includes(search)) : [videos[0]];
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
  const boosty = new Boosty(config.boosty.channel, config.proxy.cloudflare);
  const posts = await boosty.getBlog().catch((err) => {
    logger.error("Post Record VK", err);
    return [];
  });

  return search ? posts.filter((item) => item.title?.includes(search)) : posts;
}

async function getVkVideosByIds(ids: number[]): Promise<VkVideoInfo[]> {
  if (ids.length === 0) {
    throw new Error("не удалось получить информацию о видео vk");
  }

  const vk = new Vk(config.vk.channel);
  const videos = await vk.getVideos().catch((err) => {
    logger.error("Post Record VK", err);
    throw new Error("не удалось получить информацию о видео vk");
  });

  const videos_by_id = new Map(videos.map((item) => [item.id, item]));
  const result = ids.map((id) => videos_by_id.get(id)).filter((item): item is VkVideoInfo => !!item);

  if (result.length === 0) {
    throw new Error("не удалось получить информацию о видео vk");
  }

  return result;
}
