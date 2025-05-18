import { getState, StreamHistoryEntry } from "../state.ts";
import { duration } from "../utils.ts";
import { Context } from "@grammyjs/grammy";
import { bot } from "../telegram/bot.ts";

export async function streamTimecodes(ctx: Context): Promise<void> {
  await using state = await getState();
  await sendTimecodesMessage(
    state.stream.history,
    [ctx.from!.id],
    new Date(state.stream.start_time).toLocaleDateString("ru-RU"),
  );
}

export async function sendTimecodesMessage(
  history: StreamHistoryEntry[],
  chat_ids: number[],
  date?: string,
): Promise<void> {
  if (chat_ids.length === 0) return;

  await Promise.all(chat_ids.map((chatId) => {
    bot.api.sendMessage(
      chatId,
      `📌 таймкоды для стрима от ${date ?? new Date().toLocaleDateString("ru-RU")}\n\n<pre><code class="language-log">${
        (date ?? new Date().toLocaleDateString("ru-RU")).replaceAll(".", "/")
      } – ${printCategories(history)}</code></pre>\n\n<pre><code class="language-log">${
        printTimecodes(history)
      }</code></pre>`,
      { parse_mode: "HTML" },
    );
  })).catch((error) => {
    console.error("Telegram failed send message", error);
  });
}

function printTimecodes(history: StreamHistoryEntry[]): string {
  const out: string[] = [];
  for (const item of history) {
    const time = duration(Math.round(item.offset / 1000));
    out.push(`${time} – ${item.title}${item.category ? ", " + item.category : ""}`);
  }
  return out.join("\n");
}

function printCategories(history: StreamHistoryEntry[]): string {
  const unique = new Set(
    history
      .map((item) => item.category)
      .filter((item) => !["Just Chatting", "Special Events", "Games+Demos", "No Category", ""].includes(item))
      .map((item) => item.toLocaleUpperCase()),
  );

  return Array.from(unique).join(", ");
}

export async function getLastStreamTitle(): Promise<string> {
  await using state = await getState();
  return `${(new Date(state.stream.start_time).toLocaleDateString("ru-RU")).replaceAll(".", "/")} – ${
    printCategories(state.stream.history)
  }`;
}
