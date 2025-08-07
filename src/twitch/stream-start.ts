import { Twitch } from "@shevernitskiy/scraperator";
import { getState } from "../state.ts";
import { config } from "../config.ts";
import { addGameToGoogleSheet } from "../features/game-to-google-sheet.ts";
import { NOT_GAME } from "./stream-update.ts";

export async function streamStart(): Promise<void> {
  await using state = await getState();

  const twitch = new Twitch(config.twitch.channel);
  const info = await twitch.streamInfo().catch((error) => {
    console.error("Timecodes Monitor: Twitch error, can't fetch stream info", error);
    Deno.exit(0);
  });

  info.title = info.title.split("|")[0].replaceAll(/![а-яА-ЯёЁ\w\d]+/gu, "").trim();

  state.stream = {
    online: true,
    title: info.title,
    category: info.category,
    category_id: info.category_id,
    start_time: info.start_time,
    end_time: 0,
    history: [{
      title: info.title,
      category: info.category,
      category_id: info.category_id,
      changed_title: true,
      changed_category: true,
      offset: 0,
    }],
  };

  if (info.category && info.category.length > 2 && !NOT_GAME.has(info.category)) {
    const date = new Date().toLocaleDateString("ru-RU");
    let first_game_in_day = false;

    if (state.google_sheets.last_date !== date) {
      state.google_sheets.last_date = date;
      first_game_in_day = true;
    }

    await addGameToGoogleSheet(info.category, first_game_in_day).catch((error) => {
      console.error("Google Sheets: failed add game", error);
    });
  }
}
