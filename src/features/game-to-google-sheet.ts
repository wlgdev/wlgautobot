import { JWT } from "google-auth-library";
import { config } from "../config.ts";
import { GoogleSearch } from "@shevernitskiy/scraperator";

const BYPASS = ["Just Chatting", "Special Events", "Games+Demos", "No Category", "I'm Only Sleeping"];

const GREY_BORDER = {
  style: "SOLID",
  width: 1,
  color: { red: 0.72, green: 0.72, blue: 0.72 },
};
const GREY_BORDERS = {
  top: GREY_BORDER,
  bottom: GREY_BORDER,
  right: GREY_BORDER,
  left: GREY_BORDER,
};

export async function addGameToGoogleSheet(game: string) {
  if (BYPASS.includes(game)) return;

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

  await insertFirstRowRaw(today, game, game_url);
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

async function insertFirstRowRaw(date: string, game: string, url?: string) {
  const client = new JWT({
    email: config.google_sheets.email,
    key: config.google_sheets.key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const res = await client.request({
    url: `https://sheets.googleapis.com/v4/spreadsheets/${config.google_sheets.spreadsheet_id}:batchUpdate`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [
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
                    userEnteredFormat: { borders: GREY_BORDERS },
                  },
                  {
                    userEnteredValue: url ? { formulaValue: `=HYPERLINK("${url}"; "${game}")` } : { stringValue: game },
                    userEnteredFormat: { borders: GREY_BORDERS },
                  },
                  {
                    userEnteredFormat: { borders: GREY_BORDERS },
                  },
                  {
                    userEnteredFormat: { borders: GREY_BORDERS },
                  },
                  {
                    userEnteredFormat: { borders: GREY_BORDERS },
                  },
                  {
                    userEnteredFormat: {
                      borders: {
                        ...GREY_BORDERS,
                        right: {
                          style: "SOLID",
                          width: 1,
                          color: { red: 0, green: 0, blue: 0 },
                        },
                      },
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
      ],
    }),
  });

  if (res.status !== 200) {
    console.error("Google Sheets Error inserting row -", res.status, res.data);
  } else {
    console.info("Google Sheets: inserted", date, game, url);
  }
}
