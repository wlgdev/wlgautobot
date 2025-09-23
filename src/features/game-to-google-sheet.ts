import { config } from "../config.ts";
// import { GoogleSearch } from "@shevernitskiy/scraperator";
import { GoogleSheets } from "../libs/google-sheets.ts";
import { searchDDG } from "../libs/ddg-search.ts";

export async function addGameToGoogleSheet(
  game: string,
  id: string,
  first_game_in_day = false,
  start_time?: number,
): Promise<void> {
  let game_url = await getGameSteamUrlByTwitchId(id).catch((error) => {
    console.error("Cannot get steam url by tiwtch id", error);
    return undefined;
  });

  if (!game_url) {
    game_url = await getGameSteamUrl(`steam ${game}`, /store\.steampowered\.com\/app\/(\d+)/).catch((error) => {
      console.error("Cannot get steam game url", error);
      return undefined;
    });
  }

  if (!game_url) {
    game_url = await getGameSteamUrl(`википедия ${game}`, /(ru|en)\.wikipedia\.org\/wiki\/(\w+)/).catch((error) => {
      console.error("Cannot get wiki game url", error);
      return undefined;
    });
  }

  const d = start_time ? new Date(start_time) : new Date();
  const today = `${d.getDate().toString().padStart(2, "0")}.${
    (d.getMonth() + 1).toString().padStart(2, "0")
  }.${d.getFullYear()}`;

  await insertFirstRowRaw(today, game, game_url, first_game_in_day);
}

export async function getGameSteamUrl(query: string, test: RegExp): Promise<string | undefined> {
  // const data = await GoogleSearch.search(query);
  const data = await searchDDG(query);
  if (data?.length === 0) return;

  for (let i = 0; i < 2; i++) {
    if (data[i].url.match(test)) {
      return data[i].url;
    }
  }
}

export async function getGameSteamUrlByTwitchId(id: string): Promise<string | undefined> {
  const res = await fetch(`https://happy-api.shevernitskiy.deno.net/igdb/game/twitch-id/${id}`, {
    headers: {
      "X-Secret": "69",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return undefined;
  const data = await res.json();
  const steamRegex = /https:\/\/store\.steampowered\.com\/app\/(\d+).*/;
  // deno-lint-ignore no-explicit-any
  const steamLink = data.links.find((item: any) => item.match(steamRegex));
  return steamLink;
}

async function insertFirstRowRaw(date: string, game: string, url?: string, bottom_border = false) {
  const googleSheets = new GoogleSheets(config.google_sheets.spreadsheet_id, config.google_sheets.sheet_id_games);
  const borders = bottom_border
    ? { ...GoogleSheets.GREY_BORDERS, bottom: GoogleSheets.BLACK_BORDER }
    : GoogleSheets.GREY_BORDERS;

  await googleSheets.batchRequest([
    googleSheets.insertRowsRequest(1),
    googleSheets.updateRowsRequest(
      [
        {
          values: [
            {
              userEnteredValue: { stringValue: date },
              userEnteredFormat: { borders },
            },
            googleSheets.urlCell(game, url ? [url] : [], borders),
            { userEnteredFormat: { borders } },
            { userEnteredFormat: { borders } },
            { userEnteredFormat: { borders } },
            {
              userEnteredFormat: {
                borders: { ...borders, right: GoogleSheets.BLACK_BORDER },
              },
            },
          ],
        },
      ],
      ["userEnteredValue", "textFormatRuns", "userEnteredFormat.borders"],
    ),
  ]);
}
