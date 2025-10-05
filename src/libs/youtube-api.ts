export type YoutubeVideoInfo = {
  id: string;
  title: string;
  channel_id: string;
  channel_title: string;
  description: string;
  category_id: string;
  duration: number; // seconds
  thumbnail: string;
  tags: string[];
  views: string;
  likes: string;
  favorites: string;
  comments: string;
  url: string;
  shorts_url: string;
};

export type YoutubePlaylistVideoInfo = {
  id: string;
  title: string;
  channel_id: string;
  channel_title: string;
  description: string;
  thumbnail: string;
  position: number;
  published_at: number;
  playlist_id: string;
  url: string;
  shorts_url: string;
};

export class YoutubeApi {
  constructor(private readonly apiKey: string) {}

  async getPlaylistItems(playlistId: string, limit = 50): Promise<YoutubePlaylistVideoInfo[]> {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?key=${this.apiKey}&playlistId=${playlistId}&maxResults=${limit}&part=snippet,contentDetails&order=date`,
    );

    if (!res.ok) {
      throw new Error(
        `Failed to fetch data from Youtube API ${res.body ? await res.text() : ""}`,
      );
    }

    const data = await res.json();

    // deno-lint-ignore no-explicit-any
    return data.items.map((item: any) => {
      return {
        id: item.snippet.resourceId.videoId,
        title: item.snippet.title,
        channel_id: item.snippet.channelId,
        channel_title: item.snippet.channelTitle,
        description: item.snippet.description,
        thumbnail: item.snippet.thumbnails?.maxres?.url ?? item.snippet.thumbnails?.default?.url ?? "",
        position: item.snippet.position,
        published_at: new Date(item.snippet.publishedAt).getTime(),
        playlist_id: item.snippet.playlistId,
        url: `https://youtu.be/${item.snippet.resourceId.videoId}`,
        shorts_url: `https://youtube.com/shorts/${item.snippet.resourceId.videoId}`,
      } satisfies YoutubePlaylistVideoInfo;
    });
  }

  async getVideos(ids: string[]): Promise<YoutubeVideoInfo[]> {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?key=${this.apiKey}&part=snippet,statistics,contentDetails&id=${
        ids.join(",")
      }`,
    );

    if (!res.ok) {
      throw new Error(
        `Failed to fetch data from Youtube API ${res.body ? await res.text() : ""}`,
      );
    }

    const data = await res.json();

    // deno-lint-ignore no-explicit-any
    return data.items.map((item: any) => {
      return {
        id: item.id,
        title: item.snippet.title,
        channel_id: item.snippet.channelId,
        channel_title: item.snippet.channelTitle,
        description: item.snippet.description,
        duration: this.isoDurationToSeconds(item.contentDetails.duration),
        category_id: item.snippet.categoryId,
        thumbnail: item.snippet.thumbnails?.maxres?.url ?? item.snippet.thumbnails?.default?.url ?? "",
        tags: item.snippet.tags,
        views: item.statistics.viewCount,
        likes: item.statistics.likeCount,
        favorites: item.statistics.favoriteCount,
        comments: item.statistics.commentCount,
        url: `https://youtu.be/${item.id}`,
        shorts_url: `https://youtube.com/shorts/${item.id}`,
      } satisfies YoutubeVideoInfo;
    });
  }

  // deno-lint-ignore no-explicit-any
  async getPlaylistIds(channelId: string): Promise<any> {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?key=${this.apiKey}&id=${channelId}&part=snippet,contentDetails`,
    );

    if (!res.ok) {
      throw new Error(
        `Failed to fetch data from Youtube API ${res.body ? await res.text() : ""}`,
      );
    }

    const data = await res.json();

    return data;
  }

  private isoDurationToSeconds(duration: string): number {
    const regex = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(\.\d+)?)S)?$/;
    const matches = duration.match(regex);
    if (!matches) {
      throw new Error(`Invalid ISO 8601 duration format: ${duration}`);
    }

    const hours = parseFloat(matches[1] || "0");
    const minutes = parseFloat(matches[2] || "0");
    const seconds = parseFloat(matches[3] || "0");
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    return totalSeconds;
  }
}
