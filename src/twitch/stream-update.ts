import { getState } from "../state.ts";
import { addGameToGoogleSheet } from "../features/game-to-google-sheet.ts";

let update_cycle = false;

export async function streamUpdate(title: string, category: string, category_id: string): Promise<void> {
  if (update_cycle) return;
  title = title.split("|")[0].replaceAll(/![а-яА-ЯёЁ\w\d]+/gu, "").trim();
  update_cycle = true;
  await using state = await getState();

  if (!state.stream.online || (state.stream.title === title && state.stream.category === category)) {
    update_cycle = false;
    return;
  }

  state.stream.history.push({
    title: title,
    category: category,
    category_id: category_id,
    changed_title: state.stream.title !== title,
    changed_category: state.stream.category !== category,
    offset: Date.now() - state.stream.start_time,
  });

  if (
    state.stream.category !== category &&
    state.stream.history.filter((entry) => entry.category === category).length === 1
  ) {
    await addGameToGoogleSheet(category).catch((error) => {
      console.error("Google Sheets: failed add game", error);
    });
  }

  state.stream.title = title;
  state.stream.category = category;
  state.stream.category_id = category_id;
  console.log("Timecodes Monitor: stream updated", state.stream.title, state.stream.category);
  update_cycle = false;
}
