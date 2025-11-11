import { Dzen, type DzenVideoInfo, Rutube, type RutubeVideoInfo, Vk } from "@shevernitskiy/scraperator";
import { config } from "../config.ts";
import { Context } from "@grammyjs/grammy";
import { VkVideoInfo } from "@shevernitskiy/scraperator";
import { YoutubeApi, type YoutubeVideoInfo } from "../libs/youtube-api.ts";
import { logger } from "../utils.ts";
import { Gemini, llmFallback } from "@shevernitskiy/llm";

export async function youtubeVideoCut(ctx: Context): Promise<void> {
  const search = ctx.match?.at(2);
  const { chat, message_id } = await ctx.reply(
    search ? `⏳ работаем над постом для - ${search}` : "⏳ работаем над постом для последнего видео",
  );
  try {
    await proccessYoutubeVideoCut(ctx, [chat.id, message_id], search);
  } catch (err) {
    await ctx.api.editMessageText(ctx.chatId!, message_id, `⛔ ${(err as Error).message}`).catch(() => {});
  }
}

async function proccessYoutubeVideoCut(
  ctx: Context,
  root_message_id: [number, number],
  search?: string,
): Promise<void> {
  const videos = await getYoutubeVideos(search).catch(() => {
    throw new Error(`не удалось найти видео${search ? ` по запросу ${search}` : ""}`);
  });

  const video = videos[0];

  const [vk_video, rutube_video, dzen_video] = await Promise.allSettled([
    getVkVideos(video.title),
    getRutubeVideos(video.title),
    getDzenVideos(video.title),
  ]);

  const urls: [string, string][] = [["YouTube", video.url]];
  if (vk_video.status === "fulfilled") {
    urls.push(["VK", vk_video.value[0].url]);
  }
  if (rutube_video.status === "fulfilled") {
    urls.push(["Rutube", rutube_video.value[0].url]);
  } else {
    logger.error("Post VideoCut", rutube_video.reason);
  }
  if (dzen_video.status === "fulfilled") {
    urls.push(["Дзен", dzen_video.value[0].url]);
  }

  const desc = getDescFromDescription(video.description);
  const text = await generatePostText(video.title, desc).catch(() => {
    throw new Error("не удалось сгенерировать описание");
  });

  await createPost(ctx, root_message_id, text, urls);
}

async function createPost(
  ctx: Context,
  root_message_id: [number, number],
  text: string,
  urls: [string, string][],
) {
  const tg_message = config.telegram.template.video_cut(text, urls);

  logger.log("Post VideoCut", root_message_id[0], tg_message);

  await ctx.api
    .sendMessage(root_message_id[0], tg_message, {
      parse_mode: "HTML",
      link_preview_options: {
        url: urls[0][1],
        is_disabled: false,
      },
    })
    .finally(async () => await ctx.api.deleteMessage(root_message_id[0], root_message_id[1]));
}

async function getYoutubeVideos(search?: string): Promise<YoutubeVideoInfo[]> {
  const youtube = new YoutubeApi(config.youtube.apikey);
  const lastVideos = await youtube.getPlaylistItems(config.youtube.upload_playlist_id, 50);
  if (lastVideos.length === 0) {
    throw new Error("не удалось получить список видео youtube");
  }

  let videos = await youtube.getVideos(lastVideos.map((item) => item.id));
  videos = videos.filter((item) => item.duration > 200);
  const result = search ? videos.filter((item) => item.title.includes(search)) : videos;
  if (result.length === 0) {
    throw new Error("не удалось получить список видео youtube");
  }
  return result;
}

async function getVkVideos(search?: string): Promise<VkVideoInfo[]> {
  const vk = new Vk(config.vk.channel, config.proxy.cloudflare);
  const videos = await vk.getVideos().catch((err) => {
    logger.error("Post VideoCut", err);
    throw new Error("не удалось получить список видео vk");
  });
  const result = search ? videos.filter((item) => item.title.includes(search)) : videos;
  if (result.length === 0) {
    throw new Error("не удалось получить список видео vk");
  }
  return result;
}

async function getRutubeVideos(search?: string): Promise<RutubeVideoInfo[]> {
  const rutube = new Rutube(config.rutube.channel, undefined, config.proxy.cloudflare);
  const videos = await rutube.getVideos().catch((err) => {
    logger.error("Post VideoCut", err);
    throw new Error(err);
  });
  const result = search ? videos.filter((item) => item.title.includes(search)) : videos;
  if (result.length === 0) {
    throw new Error("не удалось получить список видео rutube");
  }

  return result;
}

async function getDzenVideos(search?: string): Promise<DzenVideoInfo[]> {
  const dzen = new Dzen(config.dzen.channel);
  const videos = await dzen.getVideos().catch((err) => {
    logger.error("Post VideoCut", err);
    throw new Error("не удалось получить список видео dzen");
  });
  const result = search ? videos.items.filter((item) => item.title.includes(search)) : videos.items;
  if (result.length === 0) {
    throw new Error("не удалось получить список видео dzen");
  }
  return result;
}

async function generatePostText(title: string, desc: string): Promise<string> {
  const gemini = new Gemini(config.llm.gemini.key);
  const prompt = config.llm.video_cut_prompt(title, desc);

  const answer = await llmFallback(prompt, [
    [gemini, "gemini-2.5-pro"],
    [gemini, "gemini-2.5-flash"],
    [gemini, "gemini-2.0-flash"],
  ]).catch((err) => {
    logger.error("Post VideoCut", err);
    throw new Error("не удалось сгенерить описание, ошибка обращения к AI");
  });

  return answer.replaceAll("с зрителями", "со зрителями").replace("</result>", "").replace("<result>", "").trim();
}

function getDescFromDescription(text: string): string {
  const matches = text.matchAll(/В этой нарезке вы увидите:(.*?)(?=\n\n)/gs);
  const desc = Array.from(matches)
    .map((match) => match[0])
    .join("\n");
  if (!desc) {
    throw new Error("не удалось получить текст из описания видео на ютубе");
  }
  return desc;
}
