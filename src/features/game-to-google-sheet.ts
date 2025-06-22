import { JWT } from "google-auth-library";
import { searchDDG } from "../libs/ddg-search.ts";
import { config } from "../config.ts";
import { IGDB, Steam, Twitch } from "@shevernitskiy/scraperator";

const BYPASS = ["Just Chatting", "Special Events", "Games+Demos", "No Category"];

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

  const game_url = await getGameSteamUrl2(game).catch((error) => {
    console.error("Cannot get game url", error);
    return undefined;
  });
  const d = new Date();
  const today = `${d.getDate().toString().padStart(2, "0")}.${
    (d.getMonth() + 1).toString().padStart(2, "0")
  }.${d.getFullYear()}`;

  await insertFirstRowRaw(today, game, game_url);
}

async function getMetaOGUrl(url: string): Promise<string> {
  const res = await fetch(url, { redirect: "follow" });
  const text = await res.text();
  const match = text.match(/<meta property="og:url" content="([^"]+)">/);
  return match?.[1] ?? url;
}

//TODO: deprecated
async function getGameSteamUrl(category: string): Promise<string | undefined> {
  const data = await searchDDG(`steam ${category}`);
  if (data.length === 0) return;
  const sanitized_url = data[0].url
    .replaceAll("agecheck/", "")
    .replace("steamcommunity.com", "store.steampowered.com")
    .split("?")[0];
  const split = sanitized_url.split("/");
  if (
    ((split.length === 6 && split[5] === "") || split.length === 5) &&
    split[3] === "app" && sanitized_url.includes("store.steampowered.com")
  ) {
    const true_url = await getMetaOGUrl(sanitized_url);
    return true_url;
  } else {
    return sanitized_url;
  }
}

export async function getGameSteamUrl2(category: string): Promise<string | undefined> {
  try {
    const tw = new Twitch("Juice");
    const stream_info = await tw.streamInfo();
    if (!stream_info) return;
    const category_info = await tw.categoryInfoBySlug(stream_info.category_slug);
    if (!category_info || !category_info.igdbURL) return;
    const igdb_slug = category_info.igdbURL.split("/").at(-1);
    if (!igdb_slug) return;
    const igdb_game = await IGDB.getGameMore(igdb_slug);
    if (!igdb_game) return;
    if (igdb_game) {
      const item = igdb_game.links.find((item) => item.url.match(/https:\/\/store\.steampowered\.com\/app\/(\d+).*/));
      if (item) return item.url;
    }

    const steam = new Steam();
    const steam_game = await steam.search(category);
    if (
      steam_game && steam_game.length > 0 && (steam_game[0].levenshtein <= 3 || steam_game[0].levenshtein_lower === 0)
    ) {
      return steam_game[0].url;
    }
  } catch (error) {
    console.error("Cannot get steam url", error);
    return;
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
