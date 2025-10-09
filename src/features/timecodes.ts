import { getState, type State, StreamHistoryEntry } from "../state.ts";
import { duration } from "../utils.ts";
import { Context } from "@grammyjs/grammy";
import { bot } from "../telegram/bot.ts";
import { logger } from "../utils.ts";

export async function streamTimecodes(ctx: Context): Promise<void> {
  await using state = await getState();
  await sendTimecodesMessage(
    state,
    [ctx.from!.id],
    new Date(state.stream.start_time).toLocaleDateString("ru-RU"),
  );
}

export async function sendTimecodesMessage(
  state: State,
  chat_ids: number[],
  date?: string,
): Promise<void> {
  if (chat_ids.length === 0) return;

  await Promise.all(chat_ids.map((chatId) => {
    bot.api.sendMessage(
      chatId,
      `📌 таймкоды для стрима от ${
        date ?? new Date().toLocaleDateString("ru-RU")
      }\n\nТайтл\n<pre><code class="language-log">${
        (date ?? new Date().toLocaleDateString("ru-RU")).replaceAll(".", "/")
      } – ${
        printCategories(state.stream.history).map((item) => item.toLocaleUpperCase()).join(", ")
      }</code></pre>\n\nИгры на стриме\n<pre><code class="language-log">${
        printCategories(state.stream.history).join("\n")
      }</code></pre>\n\nТаймкоды\n<pre><code class="language-log">${
        printTimecodes(state.stream.history)
      }</code></pre>\n\nВремя в каждой категории\n<pre><code class="language-log">${
        printCategoryDurations(state.stream.history, state.stream.start_time, state.stream.end_time)
      }</code></pre>`,
      { parse_mode: "HTML" },
    );
  })).catch((error) => {
    logger.error("Timecodes", "Telegram failed send message", error);
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

function printCategories(history: StreamHistoryEntry[]): string[] {
  const unique = new Set(
    history
      .map((item) => item.category)
      .filter((item) => !["Just Chatting", "Special Events", "Games+Demos", "No Category", ""].includes(item)),
  );

  return Array.from(unique);
}

function printCategoryDurations(history: StreamHistoryEntry[], startTime: number, endTime: number): string {
  if (history.length === 0 || startTime === 0) return "";

  let totalStreamDurationMs: number;
  if (endTime > 0) {
    totalStreamDurationMs = endTime - startTime;
  } else {
    totalStreamDurationMs = Date.now() - startTime;
  }

  const categoryDurations = new Map<string, number>();

  for (let i = 0; i < history.length; i++) {
    const currentEntry = history[i];
    let endOffset: number;

    if (i < history.length - 1) {
      endOffset = history[i + 1].offset;
    } else {
      endOffset = totalStreamDurationMs;
    }

    const duration = Math.max(0, endOffset - currentEntry.offset);

    if (duration > 0) {
      const currentDuration = categoryDurations.get(currentEntry.category) || 0;
      categoryDurations.set(currentEntry.category, currentDuration + duration);
    }
  }

  const sortedDurations = Array.from(categoryDurations.entries()).sort((a, b) => b[1] - a[1]);

  return sortedDurations.map(([category, catDur]) => `${duration(catDur / 1000)} - ${category}`).join("\n");
}

export async function getLastStreamTitle(): Promise<string> {
  await using state = await getState();
  return `${(new Date(state.stream.start_time).toLocaleDateString("ru-RU")).replaceAll(".", "/")} – ${
    printCategories(state.stream.history)
  }`;
}

export async function getLastStream(): Promise<{
  online: boolean;
  title: string | null;
  category: string | null;
  start_time: number;
  history: StreamHistoryEntry[];
}> {
  await using state = await getState();
  return state.stream;
}
