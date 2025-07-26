import { config } from "../config.ts";
import { GoogleSearch } from "@shevernitskiy/scraperator";
import { BLACK_BORDER, GREY_BORDERS, updateCellValue } from "../libs/google-sheets.ts";

export async function addGameToGoogleSheet(game: string, first_game_in_day = false): Promise<void> {
  let game_url = await getGameSteamUrl(`steam ${game}`, /store\.steampowered\.com\/app\/(\d+)/).catch((error) => {
    console.error("Cannot get steam game url", error);
    return undefined;
  });
  if (!game_url) {
    game_url = await getGameSteamUrl(`википедия ${game}`, /(ru|en)\.wikipedia\.org\/wiki\/(\w+)/).catch((error) => {
      console.error("Cannot get wiki game url", error);
      return undefined;
    });
  }
  const d = new Date();
  const today = `${d.getDate().toString().padStart(2, "0")}.${
    (d.getMonth() + 1).toString().padStart(2, "0")
  }.${d.getFullYear()}`;

  await insertFirstRowRaw(today, game, game_url, first_game_in_day);
}

async function getGameSteamUrl(query: string, test: RegExp): Promise<string | undefined> {
  const data = await GoogleSearch.search(query);
  if (data.length === 0) return;

  for (let i = 0; i < 2; i++) {
    if (data[i].url.match(test)) {
      return data[i].url;
    }
  }
}

async function insertFirstRowRaw(date: string, game: string, url?: string, bottom_border = false) {
  const borders = bottom_border ? { ...GREY_BORDERS, bottom: BLACK_BORDER } : GREY_BORDERS;

  await updateCellValue(config.google_sheets.spreadsheet_id, [
    {
      insertDimension: {
        inheritFromBefore: false,
        range: {
          sheetId: config.google_sheets.sheet_id,
          dimension: "ROWS",
          startIndex: 1,
          endIndex: 2,
        },
      },
    },
    {
      updateCells: {
        rows: [
          {
            values: [
              {
                userEnteredValue: { stringValue: date },
                userEnteredFormat: { borders },
              },
              {
                userEnteredValue: url ? { formulaValue: `=HYPERLINK("${url}"; "${game}")` } : { stringValue: game },
                userEnteredFormat: { borders },
              },
              { userEnteredFormat: { borders } },
              { userEnteredFormat: { borders } },
              { userEnteredFormat: { borders } },
              {
                userEnteredFormat: {
                  borders: { ...borders, right: BLACK_BORDER },
                },
              },
            ],
          },
        ],
        fields: "userEnteredValue,userEnteredFormat.borders",
        range: {
          sheetId: 0,
          startRowIndex: 1,
          endRowIndex: 2,
          startColumnIndex: 0,
          endColumnIndex: 6,
        },
      },
    },
  ]);
}
