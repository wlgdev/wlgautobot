// deno-lint-ignore-file no-explicit-any
import { Boosty } from "@shevernitskiy/scraperator";
import { config } from "../config.ts";
import { getCellsRange, updateCellValue, updateUrlCellRequest } from "../libs/google-sheets.ts";
import { seconds } from "../utils.ts";

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

async function getYoutubeVideos(): Promise<YoutubeVideo[]> {
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/playlistItems?key=${config.youtube.apikey}&part=snippet,contentDetails&playlistId=${config.youtube.upload_vods_playlist_id}&maxResults=50&order=date`,
  );

  const data = await res.json();

  return data.items.map((item: any) => {
    return {
      id: item.contentDetails.videoId,
      title: item.snippet.title,
      description: item.snippet.description,
      channel_id: item.snippet.channelId,
      channel_title: item.snippet.channelTitle,
      published_at: new Date(item.snippet.publishedAt).getTime(),
      thumbnail: item.snippet.thumbnails.maxres.url,
    } satisfies YoutubeVideo;
  });
}

// Now returns Map<string, string[]>
function dateToYoutubeVideoId(videos: YoutubeVideo[]): Map<string, string[]> {
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
    for (const timecode of video.description.matchAll(/(\d+:\d+:\d+) – (.+)/g)) {
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
      const url = dategame_to_youtube_url.get(`${row.date} ${row.game?.toLowerCase()?.trim()}`);
      if (!url || row.youtube?.trim().length > 0) continue;
      out.push(
        updateUrlCellRequest(row.row_index + 1, row.row_index + 1, 5, "YouTube", url, false, row.is_last_for_date),
      );
    }
  }
  return out;
}

export async function fillYoutubeUrls(): Promise<void> {
  const last_50_rows = await getCellsRange(
    config.google_sheets.spreadsheet_id,
    `${config.google_sheets.sheet_name}!A2:F50`,
  );
  const current_data = prepareCurrentData(last_50_rows);
  const missed_youtube_dates = new Set(
    Object.values(current_data).flat().filter((item) => item && !item.youtube).map((item) => item && item.date),
  );
  const youtube_videos = await getYoutubeVideos();
  const date_to_youtube_ids = dateToYoutubeVideoId(youtube_videos);

  const youtube_ids_to_get_info = Array.from(missed_youtube_dates)
    .map((date) => date_to_youtube_ids.get(date))
    .filter((ids): ids is string[] => !!ids && ids.length > 0)
    .flat();

  const youtube_timecodes_urls = proccessYoutubeVideos(
    youtube_videos.filter((item) => youtube_ids_to_get_info.includes(item.id)),
  );
  const youtube_requests = prepareUpdateRequests(youtube_timecodes_urls, current_data);
  if (youtube_requests.length > 0) {
    await updateCellValue(config.google_sheets.spreadsheet_id, youtube_requests);
  }
}

export async function fillBoostyUrls(): Promise<void> {
  const last_50_rows = await getCellsRange(
    config.google_sheets.spreadsheet_id,
    `${config.google_sheets.sheet_name}!A2:F50`,
  );
  const current_data = prepareCurrentData(last_50_rows);
  const date_to_boosty_url = await getBoostyPostDateToUrlMap();
  const requests = [];
  for (const row of Object.values(current_data).flat().filter((item) => item && !item.boosty)) {
    const url = date_to_boosty_url.get(row.date);
    if (url) {
      const request = updateUrlCellRequest(
        row.row_index + 1,
        row.row_index + 1,
        6,
        "Boosty",
        url,
        true,
        row.is_last_for_date,
      );
      requests.push(request);
    }
  }
  if (requests.length > 0) {
    await updateCellValue(config.google_sheets.spreadsheet_id, requests);
  }
}
