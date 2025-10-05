// deno-lint-ignore-file no-explicit-any
import { Boosty, Twitch } from "@shevernitskiy/scraperator";
import { config } from "../config.ts";
import { GoogleSheets } from "../libs/google-sheets.ts";

const REGEX_DATE = /(\d{2}\/\d{2}\/\d{4})/;

type Row = {
  rowIndex: number;
  date: string;
  title?: string;
  twitch?: string;
  youtube?: string;
  boosty?: string;
};

type GSRow = [string, string, string, string, string];

type TwitchVod = {
  date: string;
  dateTs: Date;
  title: string;
  url: string;
};

function stringToDate(str: string): Date {
  const [day, month, year] = str.split("/").map(Number);
  return new Date(year, month - 1, day);
}

function groupByDate<T extends { date: string }>(items: T[]): Record<string, T[]> {
  // @ts-ignore it's ok
  const grouped = Object.groupBy(items, (row) => row.date);
  for (const group in grouped) {
    if (!grouped[group]) continue;
  }
  // @ts-ignore it's ok
  return grouped;
}

const googleSheets = new GoogleSheets(config.google_sheets.spreadsheet_id, config.google_sheets.sheet_id_records);

async function getCurrentTableData(): Promise<Row[]> {
  const last_50_rows = await googleSheets.getCellsRange(`${config.google_sheets.sheet_name_records}!A2:F50`) as GSRow[];

  return prepareCurrentTableData(last_50_rows);
}

function prepareCurrentTableData(rows: GSRow[]): Row[] {
  const refine = rows
    .map((row, index) => ({
      rowIndex: index + 1,
      date: row.at(0)?.replaceAll(".", "/") ?? "",
      title: row.at(1),
      twitch: row.at(2),
      youtube: row.at(3),
      boosty: row.at(4),
    }))
    .filter((row) => row.date.length > 0);

  return refine;
}

/**
 * Twitch Record Flow
 */

async function getTwitchRecords(afterDate?: string): Promise<TwitchVod[]> {
  const tw = new Twitch(config.twitch.channel);
  let vods = await tw.vods("TIME", 90, "ARCHIVE");

  vods = vods.filter((item) => item.title.match(REGEX_DATE));
  let refine = vods
    .map((vod) => {
      const date = REGEX_DATE.exec(vod.title)?.[1];
      if (!date) throw new Error("no date");
      return {
        date: date.replaceAll("/", "."),
        dateTs: stringToDate(date),
        title: vod.title.replace(date, "").replace(" – ", "").replace(" - ", "").trim(),
        url: vod.url,
      };
    });

  if (afterDate) {
    const afterDateTs = stringToDate(afterDate);
    refine = refine.filter((item) => item.dateTs > afterDateTs);
  }

  return refine;
}

function convertTwitchVodsToRowValues(vods: TwitchVod[], borders?: any): any {
  if (vods.length === 0) throw new Error("no vods");

  const cells = [
    { userEnteredValue: { stringValue: vods[0].date } },
    { userEnteredValue: { stringValue: vods[0].title.split("Часть 1")[0].trim() } },
    googleSheets.urlCell("Twitch", vods.map((vod) => vod.url), borders),
    { userEnteredValue: { stringValue: "" } },
    { userEnteredValue: { stringValue: "" } },
  ];

  if (borders !== undefined) {
    cells.forEach((cell) => {
      // @ts-ignore - TODO: fix this
      cell.userEnteredFormat = { borders };
    });
  }

  return { values: cells };
}

export async function fillTwitchRecords() {
  const currentTabledata = await getCurrentTableData();
  const lastDate = currentTabledata.at(0)?.date ?? new Date().toLocaleDateString("ru-RU").replaceAll(".", "/");

  const twitchVods = await getTwitchRecords(lastDate);
  if (twitchVods.length === 0) {
    console.log("Twitch Records -", `Last date in a Record sheet is ${lastDate}, no new vods found after it`);
    return;
  } else {
    console.log("Twitch Records -", `Last date in a Record sheet is ${lastDate}, found ${twitchVods.length} new vods`);
  }
  const groupByDateTwitchVods = groupByDate(twitchVods);
  const groupdByDateTwitchVodsValues = Object.values(groupByDateTwitchVods);
  const googleSheetsRows = groupdByDateTwitchVodsValues.map((item) =>
    convertTwitchVodsToRowValues(item.reverse(), GoogleSheets.GREY_BORDERS)
  );

  await googleSheets.batchRequest([
    googleSheets.insertRowsRequest(googleSheetsRows.length, 1),
    googleSheets.updateRowsRequest(
      googleSheetsRows,
      ["userEnteredValue", "textFormatRuns", "userEnteredFormat.borders"],
      1,
    ),
  ]);
}

//

/**
 * Youtube Record Flow
 */

type YoutubeVideo = {
  id: string;
  title: string;
  date: string;
  dateTs: Date;
  url: string;
};

async function getYoutubeVideos(): Promise<YoutubeVideo[]> {
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/playlistItems?key=${config.youtube.apikey}&part=snippet,contentDetails&playlistId=${config.youtube.upload_vods_playlist_id}&maxResults=50&order=date`,
  );

  const data = await res.json();
  data.items = data.items.filter((item: any) => item.snippet.title.match(REGEX_DATE));

  return data.items.map((item: any) => {
    const date = REGEX_DATE.exec(item.snippet.title)?.[1];
    if (!date) throw new Error("no date");
    return {
      id: item.contentDetails.videoId,
      title: item.snippet.title,
      date: date,
      dateTs: stringToDate(date),
      url: `https://youtu.be/${item.contentDetails.videoId}`,
    } satisfies YoutubeVideo;
  });
}

function computeMissedYoutubeDates(rows: Row[]): Map<string, number> {
  const missedDates = new Map<string, number>();
  for (const row of rows) {
    if (row.date.length > 0 && !row.youtube) {
      missedDates.set(row.date, row.rowIndex);
    }
  }
  return missedDates;
}

function convertRecordToCellsRequests(
  items: Record<string, (YoutubeVideo | BoostyPost)[]>,
  missedDates: Map<string, number>,
  targetColumnIndex: number,
  text: string,
  borders?: any,
): any[] {
  const out = [];

  for (const [date, records] of Object.entries(items)) {
    const rowIndex = missedDates.get(date);
    if (rowIndex === undefined) continue;
    out.push(googleSheets.updateCellRequest(
      googleSheets.urlCell(text, records.reverse().map((record) => record.url), borders),
      ["userEnteredValue", "textFormatRuns", "userEnteredFormat.borders"],
      rowIndex,
      targetColumnIndex,
    ));
  }

  return out;
}

export async function fillYoutubeRecords(currentTabledata: Row[]): Promise<any[]> {
  const missedDates = computeMissedYoutubeDates(currentTabledata);
  if (missedDates.size === 0) {
    console.log("No missed dates for Youtube found in the Record sheet");
    return [];
  } else {
    console.log("Youtube Records -", `Found ${missedDates.size} missed dates`);
  }

  const youtubeVideos = await getYoutubeVideos();
  const groupByDateYoutubeVideos = groupByDate(youtubeVideos);
  const requests = convertRecordToCellsRequests(
    groupByDateYoutubeVideos,
    missedDates,
    3,
    "YouTube",
    GoogleSheets.GREY_BORDERS,
  );
  if (requests.length === 0) {
    console.log("Youtube Records -", "No videos for missed dates found");
    return [];
  }

  return requests;
}

//

/**
 * Boosty Record Flow
 */

function computeMissedBoostyDates(rows: Row[]): Map<string, number> {
  const missedDates = new Map<string, number>();
  for (const row of rows) {
    if (row.date.length > 0 && !row.boosty) {
      missedDates.set(row.date, row.rowIndex);
    }
  }
  return missedDates;
}

type BoostyPost = {
  id: string;
  title: string;
  date: string;
  dateTs: Date;
  url: string;
};

async function getBoostyPosts(): Promise<BoostyPost[]> {
  const boosty = new Boosty(config.boosty.channel, config.proxy.cloudflare);
  let posts = await boosty.getBlog(50);
  posts = posts.filter((post) => post.title.match(REGEX_DATE));

  return posts.map((item) => {
    const date = REGEX_DATE.exec(item.title)?.[1];
    if (!date) throw new Error("no date");
    return {
      id: item.id,
      title: item.title,
      date: date,
      dateTs: stringToDate(date),
      url: item.url,
    };
  });
}

export async function fillBoostyRecords(currentTabledata: Row[]): Promise<any[]> {
  const missedDates = computeMissedBoostyDates(currentTabledata);
  if (missedDates.size === 0) {
    console.log("No missed dates for Boosty found in the Record sheet");
    return [];
  } else {
    console.log("Boosty Records -", `Found ${missedDates.size} missed dates`);
  }

  const boostyPosts = await getBoostyPosts();
  const groupByDateBoostyPosts = groupByDate(boostyPosts);
  const requests = convertRecordToCellsRequests(
    groupByDateBoostyPosts,
    missedDates,
    4,
    "Boosty",
    GoogleSheets.GREY_BORDERS,
  );
  if (requests.length === 0) {
    console.log("Boosty Records -", "No posts for missed dates found");
    return [];
  }

  return requests;
}

export async function fillRecordsSheet(): Promise<void> {
  console.log("Filling records sheet");
  await fillTwitchRecords();

  const currentTabledata = await getCurrentTableData();

  const [youtubeResult, boostyResult] = await Promise.allSettled([
    fillYoutubeRecords(currentTabledata),
    fillBoostyRecords(currentTabledata),
  ]);
  const youtubeRequests = youtubeResult.status === "fulfilled" ? youtubeResult.value : [];
  const boostyRequests = boostyResult.status === "fulfilled" ? boostyResult.value : [];
  if (youtubeRequests.length === 0 && boostyRequests.length === 0) {
    console.log("Nothing to update");
    return;
  }
  console.log("Youtube requests", youtubeRequests.length);
  console.log("Boosty requests", boostyRequests.length);

  const requests = youtubeRequests.concat(boostyRequests);
  await googleSheets.batchRequest(requests);
}
