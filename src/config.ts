export function getConfig() {
  return {
    admins: Deno.env
      .get("ADMIN")!
      .split(",")
      .map((id) => +id),
    subscription: {
      timecodes: Deno.env
        .get("SUBSCRIPTION_TIMECODES")!
        .split(",")
        .map((id) => +id),
    },
    telegram: {
      token: Deno.env.get("TELEGRAM_TOKEN")!,
      template: {
        clip: (title: string, urls: [string, string][]) => {
          const wrapped = urls.map(([title, url]) => `<a href="${url}">${title}</a>`);
          let sources = wrapped[0];
          if (wrapped.length > 1) {
            const last = wrapped.pop()!;
            sources = `${wrapped.join(", ")} и ${last}`;
          }

          return `${title}

Шортс доступен на ${sources}.`;
        },
        record: (text: string, youtube_urls: string[], twitch_urls: string[], boosty_url?: string) => {
          const boosty_link = boosty_url ? ` и <a href="${boosty_url}">Boosty</a>` : "";

          const message = [
            youtube_urls.length === 1 ? text.replace("YouTube", `<a href="${youtube_urls[0]}">YouTube</a>`) : text,
          ];
          if (youtube_urls.length > 1) {
            message.push(
              "\n" + youtube_urls.map((url, index) => `⦁ <a href="${url}">Часть ${index + 1}</a>`).join("\n"),
            );
          }
          if (twitch_urls.length === 1) {
            message.push(
              `\nЗапись также доступна на <a href="${
                twitch_urls[0]
              }">Twitch</a>${boosty_link} для платных подписчиков.`,
            );
          } else if (twitch_urls.length > 1) {
            message.push(`\nЗапись также доступна на Twitch${boosty_link} для платных подписчиков.`);
            message.push(
              "\n" + twitch_urls.map((url, index) => `⦁ <a href="${url}">Часть ${index + 1}</a>`).join("\n"),
            );
          } else if (boosty_url && twitch_urls.length === 0) {
            message.push(`\nЗапись также доступна на <a href="${boosty_url}">Boosty</a> для платных подписчиков.`);
          }
          message.push("\n#запись #twitch #youtube");
          return message.join("\n");
        },
        video_cut: (text: string, urls: [string, string][]) => {
          const wrapped = urls.map(([title, url]) => `<a href="${url}">${title}</a>`);
          let sources = wrapped[0];
          if (wrapped.length > 1) {
            const last = wrapped.pop()!;
            sources = `${wrapped.join(", ")} и ${last}`;
          }

          return `${text}

Ролик доступен на ${sources}. Приятного просмотра!

#видео #youtube`;
        },
      },
    },
    vk: {
      channel: Deno.env.get("VK_CHANNEL")!,
      group: Deno.env.get("VK_GROUP")!,
    },
    rutube: {
      channel: Deno.env.get("RUTUBE_CHANNEL")!,
    },
    dzen: {
      channel: Deno.env.get("DZEN_CHANNEL")!,
    },
    twitch: {
      channel: Deno.env.get("TWITCH_CHANNEL")!,
    },
    youtube: {
      channel: Deno.env.get("YOUTUBE_CHANNEL")!,
      channel_vod: Deno.env.get("YOUTUBE_VODS_CHANNEL")!,
      apikey: Deno.env.get("YOUTUBE_APIKEY")!,
    },
    tiktok: {
      channel: Deno.env.get("TIKTOK_CHANNEL")!,
      rapidkey: Deno.env.get("TIKTOK_KEY")!,
    },
    boosty: {
      channel: Deno.env.get("BOOSTY_CHANNEL")!,
    },
    llm: {
      gemini: {
        key: Deno.env.get("GEMINI_KEY")!,
      },
      stream_record_prompt: (timecode: string) =>
        `<task>
Cгенери описание 'что мы делали на стриме' основываясь на таймлайне.
Если в таймкоде присутствует название игры, добавь небольшое творческое описание этого пункта основываясь на содержании игры.
Таймкоды с обычным общением и неключевыми событиями можешь пропустить.
</task>
<constraints>
Ответь только самим текстом описания и обязательно сохрани слово YouTube. Начинай словами "Запись стрима, на котором мы". Не отвечай списком.
</constraints>

<example>
<timecodes>
00:00:00 – Заставка
00:01:29 – Начало стрима. Общение
01:27:15 – Grand Theft Auto V Enhanced
03:25:13 – Project Castaway
05:02:46 – Unreal Gold
06:05:03 – DARK SOULS III
</timecodes>
<result>
Запись стрима, на котором мы угоняли тачки и устраивали беспредел в Grand Theft Auto V Enhanced, выживали на необитаемом острове в Project Castaway, вспомнили классику в Unreal Gold, а затем отправились страдать в DARK SOULS III, доступна на нашем YouTube канале.
</result>
</example>

Вот таймлайн, на основе которого нужно сгенерить описание:
<timecodes>
${timecode}
</timecodes>`,
      video_cut_prompt: (title: string, desc: string) =>
        `<task>
Сделать описание видео основываясь на его названии и кратком содержании.
</task>
<constraints>
Ответить только описанием без лишних слов. Ответ должен быть БЕЗ тэгов.
</constraints>

Пример:
<title>Взрывное приключение на пустынной дороге | Drive Beyond Horizons</title>
<content>В этой нарезке вы увидите:
⦁ Невероятное приключение в Drive Beyond Horizons.
⦁ Забавные баги в игре.
и другие забавные моменты.</content>
<result>Незабываемое приключение в игре Drive Beyond Horizons. Колесим по бескрайним просторам пустыни, ведём подрывную деятельность и коллекционируем баги.</result>

Данные для генерации:
<title>${title}</title>
<content>${desc}</content>`,
    },
    google_sheets: {
      email: Deno.env.get("GOOGLE_SHEETS_EMAIL"),
      key: atob(Deno.env.get("GOOGLE_SHEETS_KEY")!),
      spreadsheet_id: Deno.env.get("GOOGLE_SPREADSHEET_ID")!,
      sheet_id: +Deno.env.get("GOOGLE_SHEET_ID")! || 0,
    },
    short_stats: {
      spreadsheet_id: Deno.env.get("SHORT_STATS_SPREADSHEET_ID")!,
      sheet_id: +Deno.env.get("SHORT_STATS_SHEET_ID")! || 0,
    },
  };
}

export type Config = ReturnType<typeof getConfig>;
export const config = getConfig();
