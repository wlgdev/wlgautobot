import { Boosty } from "@shevernitskiy/scraperator";
import { Context, InputFile } from "@grammyjs/grammy";
import { config } from "../config.ts";
import { logger } from "../utils.ts";

const REGEX_DATE = /(\d{2}\/\d{2}\/\d{4})/;

export async function boostyBosts(ctx: Context): Promise<void> {
  const limit = ctx.match?.at(2);

  const { message_id } = await ctx.reply(
    limit ? `⏳ работаем над статой до - ${limit}` : "⏳ работаем над статой по записям стиримов на бусти",
  );
  try {
    const csv = await generateCSV(+(limit ?? "100") || 100);

    await ctx.api
      .sendDocument(ctx.chatId!, new InputFile(new TextEncoder().encode(csv.join("\n")), "boosty-posts.csv"), {
        caption: `📊 статистика по записям стиримов на бусти, всего ${csv.length}, ${new Date().toLocaleDateString()}`,
      })
      .then(async () => {
        await ctx.api.deleteMessage(ctx.chatId!, message_id);
      });
  } catch (err) {
    await ctx.api.editMessageText(ctx.chatId!, message_id, `⛔ ${(err as Error).message}`).catch(() => {});
  }
}
export async function generateCSV(limit?: number): Promise<string[]> {
  // TODO: remove if it will be possibleto fetch direct
  const boosty = new Boosty(config.boosty.channel, "https://boostyflare.mahahuha5816.workers.dev/forward?url=");
  let posts = await boosty.getBlog(limit).catch((err) => {
    logger.error("Boosty", err);
    return [];
  });
  posts = posts.filter((post) => post.tags.includes("записи стримов"));

  return [
    "post_date;stream_date;title;url",
    ...posts.map(
      (item) => {
        const date = item.title.match(REGEX_DATE)?.[0];
        const stream_date = date ? date.replaceAll("/", ".") : "-";
        return `${new Date(item.created_at).toLocaleDateString()};${stream_date};${item.title};${item.url}`;
      },
    ),
  ];
}
