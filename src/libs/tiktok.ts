export type TikTokAuthorMetadata = {
  author_id: string;
  nickname: string;
  avatar: string;
};

export type TikTokVideoItem = {
  id: string;
  title: string;
  url: string;
  duration: number;
  size: number;
  created_at: number;
  preview_url: string;
  animation_url: string;
  video_url: string;
  plays: number;
  diggs: number;
  comments: number;
  shares: number;
  downloads: number;
  collects: number;
};

export type TikTokVideos = {
  metadata: TikTokAuthorMetadata;
  items: TikTokVideoItem[];
};

export async function getTikTokUserVideo(user: string, rapidkey: string, count = 30): Promise<TikTokVideos> {
  const res = await fetch(
    `https://tiktok-scraper7.p.rapidapi.com/user/posts?unique_id=${user}&count=${count}&cursor=0`,
    {
      headers: {
        "x-rapidapi-key": rapidkey,
        "x-rapidapi-host": "tiktok-scraper7.p.rapidapi.com",
      },
    },
  );
  const data = await res.json();
  const author = data.data.videos.at(0);

  return {
    metadata: {
      author_id: author.author.id,
      nickname: author.author.nickname,
      avatar: author.author.avatar,
    },
    // deno-lint-ignore no-explicit-any
    items: data.data.videos.map((item: any) => {
      return {
        id: item.video_id,
        title: item.title,
        url: `https://www.tiktok.com/@${user}/video/${item.video_id}`,
        duration: item.duration,
        size: item.size,
        created_at: item.create_time * 1000,
        preview_url: item.origin_cover,
        animation_url: item.ai_dynamic_cover,
        video_url: item.play,
        plays: item.play_count,
        diggs: item.digg_count,
        comments: item.comment_count,
        shares: item.share_count,
        downloads: item.download_count,
        collects: item.collect_count,
      };
    }),
  };
}
