# WLGAUTOBOT

This is a Telegram bot that offers various helpful features for smooth content delivery in WLG productions:

- Generate Telegram posts for stream recordings
- Generate Telegram posts for video cuts
- Generate Telegram posts for clips/shorts/TikToks
- Track stream status and gather timecodes
- Gather info and stream URL and log it to a specific Google Sheet
- Compile monthly statistics for clips/shorts/TikToks
- Trigger the remote [WLGDL](https://github.com/wlgdev/wlgdl) utility to start recording

## How it Works

There is no magic behind this bot. It simply integrates multiple APIs and services:

## APIs and Services

This bot utilizes several APIs and services. Note that obtaining API keys is required for most of them:

- **YouTube Data v3** – Official Google API (https://developers.google.com/youtube/v3), used to gather shorts info
- **Google Sheets** – Official Google API (https://developers.google.com/workspace/sheets), used to write game info and clips/shorts/TikToks stats to Google Sheets
- **Telegram** – Official Telegram Bot API (https://core.telegram.org/api), the main interface for the bot
- **Google AI** – Official Google AI API (https://ai.google.dev/gemini-api/docs), used to generate Telegram posts for video cuts and recordings
- **Rapid API TikTok Scraper API** – Unofficial TikTok API (https://rapidapi.com/tikwm-tikwm-default/api/tiktok-scraper7), used to gather TikTok info
- **Twitch** – Official Twitch API (https://dev.twitch.tv/docs/api), used to receive stream info

The bot also scrapes data from public sources and endpoints (no API key required) for:

- **VK**
- **Rutube**
- **Dzen**
- **Bosty**
- **DuckDuckGo search**

## Usage

### Telegram User Commands

- **ping | /ping** – Pong
- **клип | /clip** _[search]_ – Generates a Telegram post with the latest clip/short/TikTok
- **запись | /record** _[search]_ – Generates a Telegram post with the latest stream recording
- **нарезка | /cut** _[search]_ – Generates a Telegram post with the latest video cut
- **таймкоды | /timecodes** – Shows timecodes for the latest stream
- **шортсы | /short** – Gathers info about the last ~30 clips/shorts/TikToks and provides it in a CSV file

> [!NOTE]
> The parameter `search` is optional and can be used to specify content. For example, using it with the `/record` command will generate a Telegram post for the content that includes the search term in its title.

### ENV

| Name                       | Description                                                                        | Example                                                           |
| -------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| TELEGRAM_TOKEN             | Telegram bot token                                                                 | `1234567890:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz` |
| VK_CHANNEL                 | VK group name (from which to get videos/clips info)                                | `welovegames`                                                     |
| VK_GROUP                   | VK group ID (from which to get videos/clips info; include the minus sign)          | `-46211765`                                                       |
| RUTUBE_CHANNEL             | Rutube channel name                                                                | `welovegames`                                                     |
| DZEN_CHANNEL               | Dzen channel name                                                                  | `welovegames`                                                     |
| BOSTY_CHANNEL              | Bosty channel name                                                                 | `welovegames`                                                     |
| TWITCH_CHANNEL             | Twitch channel name                                                                | `welovegames`                                                     |
| YOUTUBE_CHANNEL            | YouTube channel name (main)                                                        | `@WELOVEGAMES`                                                    |
| YOUTUBE_VODS_CHANNEL       | YouTube channel name (for VODs)                                                    | `@wlgvods`                                                        |
| YOUTUBE_APIKEY             | YouTube Data v3 API key                                                            | `AIzaSyD4o1234mFGHIJKLMNOPQRSTUVWXYZ`                             |
| TIKTOK_CHANNEL             | TikTok channel name                                                                | `welovegames`                                                     |
| TIKTOK_KEY                 | TikTok API key (for RapidAPI TikTok Scraper API)                                   | `HIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz`                   |
| GOOGLE_SHEETS_EMAIL        | Google Sheets Service Account (for Google Sheets API)                              | `wlgautobot@wlg-autobot.iam.gserviceaccount.com`                  |
| GOOGLE_SHEETS_KEY          | Google Sheets Service Account Key (for Google Sheets API) **IN BASE64**            | `ewufgUIAGDFUEIAgfweiufweeofiwefuguigwef`                         |
| GOOGLE_SPREADSHEET_ID      | Google Sheets Spreadsheet ID where game info is written                            | `1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ`  |
| GOOGLE_SHEET_ID            | Google Sheets Sheet ID where game info is written                                  | `0`                                                               |
| SHORT_STATS_SPREADSHEET_ID | Google Sheets Spreadsheet ID where shorts stats are written                        | `1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ`  |
| SHORT_STATS_SHEET_ID       | Google Sheets Sheet ID where shorts stats are written                              | `0`                                                               |
| GEMINI_KEY                 | Google Gemini API key                                                              | `fwefwefwUGWDfwudgw`                                              |
| ADMIN                      | Telegram user IDs with rights to use this bot (comma separated)                    | `1234567890,1234567890`                                           |
| SUBSCRIPTION_TIMECODES     | Telegram user IDs to send stream timecodes after the stream ends (comma separated) | `1234567890,1234567890`                                           |
| WLGDL                      | HTTP URL to trigger the WLGDL utility (optional)                                   | `https://wlgdl.com/`                                              |

### App HTTP Endpoints

| Endpoint       | Description                            |
| -------------- | -------------------------------------- |
| GET /          | Always returns 200 OK                  |
| POST /telegram | For Telegram webhooks                  |
| POST /twitch   | For Twitch EventSub webhooks           |
| GET /stream    | Returns info about the previous stream |

### Installation

This bot is intended to run on the free [Deno Deploy](https://dash.deno.com/) serverless platform, though it can also be deployed on other platforms (such as Cloudflare Workers with minor adjustments) or on your own server. For these docs, we focus on Deno Deploy.

1. Register your project on Deno Deploy.
2. Create a bot account on Telegram and set up the webhook to `https://<your-project-name>.deno.dev/telegram` to receive Telegram updates.
3. Create an app in the Twitch Developer Console. Subscribe to `channel.update`, `stream.online`, and `stream.offline` events, and set up the webhook to `https://<your-project-name>.deno.dev/twitch` to receive Twitch updates.
4. Create all necessary service accounts and obtain the required keys as described above.
5. Set up ENV variables in Deno Deploy.
6. Upload the project via the [deployctl](https://docs.deno.com/deploy/manual/deployctl/) utility.

### Development

#### Prerequisites

- [Deno](https://deno.com/) 2.1 and above
- A configured `.env` file with all necessary (development) variables

### Running

```bash
deno task start
```

When you start the bot locally, it will use the polling method for Telegram updates. The HTTP server will not start; therefore, while Telegram will be accessible, webhooks will not function.

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change. For formatting, please use `deno fmt`.

## License

MIT License © 2025 shevernitskiy, WELOVEGAMES
