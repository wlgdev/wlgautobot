// deno-lint-ignore-file no-explicit-any
import { Boosty } from "@shevernitskiy/scraperator";
import { config } from "../config.ts";
import { GoogleSheets } from "../libs/google-sheets.ts";
import { seconds } from "../utils.ts";
import { YoutubeApi, type YoutubePlaylistVideoInfo } from "../libs/youtube-api.ts";

const REGEX_DATE = /(\d{2}\/\d{2}\/\d{4})/;

type YoutubeVideo = {
  id: string;
  title: string;
  description: string;
  channel_id: string;
  channel_title: string;
  published_at: number;
  thumbnail: string;
};

type Row = {
  row_index: number;
  date: any;
  game: any;
  youtube: any;
  boosty: any;
  is_last_for_date: boolean;
};

const googleSheets = new GoogleSheets(config.google_sheets.spreadsheet_id, config.google_sheets.sheet_id_games);
const youtube = new YoutubeApi(config.youtube.apikey);

function dateToYoutubeVideoId(videos: YoutubePlaylistVideoInfo[]): Map<string, string[]> {
  const date_to_url_map = new Map<string, string[]>();
  for (const video of videos) {
    const date_of_stream = video.title.match(REGEX_DATE)?.[0];
    if (date_of_stream) {
      if (!date_to_url_map.has(date_of_stream)) {
        date_to_url_map.set(date_of_stream, []);
      }
      date_to_url_map.get(date_of_stream)!.push(video.id);
    }
  }
  return date_to_url_map;
}

async function getBoostyPostDateToUrlMap(): Promise<Map<string, string>> {
  const boosty = new Boosty(config.boosty.channel, config.proxy.cloudflare);
  const posts = await boosty.getBlog(50);
  const date_to_url_map = new Map<string, string>();
  for (const post of posts) {
    const date_of_stream = post.title.match(REGEX_DATE)?.[0];
    if (date_of_stream) {
      date_to_url_map.set(date_of_stream, post.url);
    }
  }

  return date_to_url_map;
}

function prepareCurrentData(rows: any[]): Record<any, Row[]> {
  const refine = rows.map((row, index) => ({
    row_index: index + 1,
    date: row[0].replaceAll(".", "/"),
    game: row[1],
    youtube: row.at(4),
    boosty: row.at(5),
    is_last_for_date: false,
  }));

  // @ts-ignore it's ok
  const grouped = Object.groupBy(refine, (row) => row.date);
  for (const group in grouped) {
    if (!grouped[group]) continue;
    for (const [index, row] of grouped[group].entries()) {
      row.is_last_for_date = index === grouped[group].length - 1;
    }
  }
  // @ts-ignore it's ok
  return grouped;
}

// Accepts an array of videos, returns Map<string, string>
function proccessYoutubeVideos(videos: YoutubeVideo[]): Map<string, string> {
  const out = new Map<string, string>();

  for (const video of videos) {
    const date_of_stream = video.title.match(REGEX_DATE)?.[0];
    if (!date_of_stream) continue;
    for (const timecode of video.description.matchAll(/(\d+:\d+:\d+)\s{0,1}–\s{0,1}(.+)/g)) {
      const sec = seconds(timecode[1]);
      if (!sec || isNaN(sec) || sec < 0) continue;
      out.set(`${date_of_stream} ${timecode[2].toLowerCase()?.trim()}`, `https://youtu.be/${video.id}?t=${sec}s`);
    }
  }
  return out;
}

function prepareUpdateRequests(
  dategame_to_youtube_url: Map<string, string>,
  current_data: Record<string, Row[]>,
): any[] {
  const out = [];
  for (const date of Object.values(current_data)) {
    for (const row of date) {
      if (row.youtube?.trim().length > 0) continue;
      const sheetGameName = row.game?.toLowerCase()?.trim();
      if (!sheetGameName) continue;
      let url = dategame_to_youtube_url.get(`${row.date} ${sheetGameName}`);
      if (!url && sheetGameName.endsWith(" demo")) {
        url = dategame_to_youtube_url.get(`${row.date} ${sheetGameName.slice(0, -5)}`);
      }
      if (!url && sheetGameName.endsWith(" playtest")) {
        url = dategame_to_youtube_url.get(`${row.date} ${sheetGameName.slice(0, -9)}`);
      }
      if (!url) continue;

      out.push(googleSheets.updateCellRequest(
        googleSheets.urlCell("YouTube", [url]),
        ["userEnteredValue", "textFormatRuns"],
        row.row_index,
        4,
      ));
    }
  }
  return out;
}

export async function fillYoutubeGames(current_data: Record<string, Row[]>): Promise<any[]> {
  const missed_youtube_dates = new Set(
    Object.values(current_data).flat().filter((item) => item && !item.youtube).map((item) => item && item.date),
  );

  const youtube_videos = await youtube.getPlaylistItems(config.youtube.upload_vods_playlist_id);
  const date_to_youtube_ids = dateToYoutubeVideoId(youtube_videos);

  const youtube_ids_to_get_info = Array.from(missed_youtube_dates)
    .map((date) => date_to_youtube_ids.get(date))
    .filter((ids): ids is string[] => !!ids && ids.length > 0)
    .flat();

  const youtube_timecodes_urls = proccessYoutubeVideos(
    youtube_videos.filter((item) => youtube_ids_to_get_info.includes(item.id)),
  );

  const youtube_requests = prepareUpdateRequests(youtube_timecodes_urls, current_data);

  return youtube_requests;
}

export async function fillBoostyGames(current_data: Record<string, Row[]>): Promise<any[]> {
  const date_to_boosty_url = await getBoostyPostDateToUrlMap();
  const requests = [];
  for (const row of Object.values(current_data).flat().filter((item) => item && !item.boosty)) {
    const url = date_to_boosty_url.get(row.date);
    if (url) {
      requests.push(googleSheets.updateCellRequest(
        googleSheets.urlCell("Boosty", [url]),
        ["userEnteredValue", "textFormatRuns"],
        row.row_index,
        5,
      ));
    }
  }

  return requests;
}

export async function fillGamesSheet(): Promise<void> {
  console.log("Filling games sheet");
  const last_50_rows = await googleSheets.getCellsRange(`${config.google_sheets.sheet_name_games}!A2:F50`);
  const current_data = prepareCurrentData(last_50_rows);

  const [youtube_result, boosty_result] = await Promise.allSettled([
    fillYoutubeGames(current_data),
    fillBoostyGames(current_data),
  ]);
  const youtube_requests = youtube_result.status === "fulfilled" ? youtube_result.value : [];
  const boosty_requests = boosty_result.status === "fulfilled" ? boosty_result.value : [];
  if (youtube_requests.length === 0 && boosty_requests.length === 0) {
    console.log("Nothing to update");
    return;
  }
  console.log("Youtube requests", youtube_requests.length);
  console.log("Boosty requests", boosty_requests.length);

  const requests = youtube_requests.concat(boosty_requests);
  await googleSheets.batchRequest(requests);
}
