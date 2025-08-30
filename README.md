<!--suppress HtmlUnknownAnchorTarget, HtmlDeprecatedAttribute -->
<div id="top"></div>

<div align="center">
  <a href="https://github.com/wlgdev/wlgautobot/actions/workflows/secrets-update.yml">
    <img src="https://github.com/wlgdev/wlgautobot/actions/workflows/secrets-update.yml/badge.svg" alt="status"/>
  </a>
</div>
<h1 align="center">
  WLGAUTOBOT
</h1>

<p align="center">
   Telegram bot for automating content delivery and statistics for WLG productions.
</p>

<div align="center">
  📦 :octocat:
</div>
<div align="center">
  <img src="./docs/description.webp" alt="description"/>
</div>

<!-- TABLE OF CONTENT -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#-description">📃 Description</a>
      <ul>
        <li><a href="#built-with">Built With</a></li>
      </ul>
    </li>
    <li>
      <a href="#-getting-started">🪧 Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li>
      <a href="#%EF%B8%8F-how-to-use">⚠️ How to use</a>
      <ul>
        <li><a href="#possible-exceptions">Possible Exceptions</a></li>
      </ul>
    </li>
    <li><a href="#%EF%B8%8F-deployment">⬆️ Deployment</a></li>
    <li><a href="#-reference">🔗 Reference</a></li>
  </ol>
</details>

<br>

## 📃 Description

WLGAUTOBOT is a Telegram bot designed to automate and simplify content delivery for WLG productions. It integrates with multiple APIs and services to generate posts, track streams, gather statistics, and trigger remote utilities.

### Features

- Generate Telegram posts for stream recordings, video cuts, and clips/shorts/TikToks
- Track stream status and gather timecodes
- Log stream info and URLs to Google Sheets
- Compile monthly statistics for clips/shorts/TikToks
- Trigger remote [WLGDL](https://github.com/wlgdev/wlgdl) utility for recording

### Built With

- [Deno 2.1+](https://deno.com/)
- [Telegram Bot API](https://core.telegram.org/api)
- [Google APIs (Sheets, Gemini)](https://developers.google.com/)
- [YouTube Data v3](https://developers.google.com/youtube/v3)
- [Twitch API](https://dev.twitch.tv/docs/api)
- [RapidAPI TikTok Scraper](https://rapidapi.com/tikwm-tikwm-default/api/tiktok-scraper7)

<p align="right">(<a href="#top">back to top</a>)</p>

## 🪧 Getting Started

Follow these instructions to set up and run the bot.

### Prerequisites

- [Deno](https://deno.com/) 2.1 or above
- Telegram bot token
- API keys for YouTube, Google Sheets, Gemini, TikTok (RapidAPI), Twitch, etc.
- Service account for Google Sheets
- `.env` file with all required variables

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/wlgdev/wlgautobot.git
   cd wlgautobot
   ```
2. Configure your `.env` file with all necessary variables (see [ENV section](#env)).
3. Install dependencies and format code:
   ```bash
   deno task fmt
   ```
4. Start the bot locally:
   ```bash
   deno task start
   ```
   > When running locally, the bot uses polling for Telegram updates. HTTP server/webhooks are not started.

<p align="right">(<a href="#top">back to top</a>)</p>

## ⚠️ How to use

### Telegram User Commands

- **ping | /ping** – Pong
- **клип | /clip** _[search]_ – Generate post with latest clip/short/TikTok
- **запись | /record** _[search]_ – Generate post with latest stream recording
- **нарезка | /cut** _[search]_ – Generate post with latest video cut
- **таймкоды | /timecodes** – Show timecodes for latest stream
- **шортсы | /short** – Gather info about last ~30 clips/shorts/TikToks as CSV

> The `search` parameter is optional and filters content by title.

### ENV

| Name                            | Description                                                        | Example                                                           |
| ------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------- |
| TELEGRAM_TOKEN                  | Telegram bot token                                                 | `1234567890:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz` |
| VK_CHANNEL                      | VK group name (for videos/clips info)                              | `welovegames`                                                     |
| VK_GROUP                        | VK group ID (include minus sign)                                   | `-46211765`                                                       |
| RUTUBE_CHANNEL                  | Rutube channel name                                                | `welovegames`                                                     |
| DZEN_CHANNEL                    | Dzen channel name                                                  | `welovegames`                                                     |
| BOSTY_CHANNEL                   | Bosty channel name                                                 | `welovegames`                                                     |
| TWITCH_CHANNEL                  | Twitch channel name                                                | `welovegames`                                                     |
| YOUTUBE_CHANNEL                 | YouTube channel name (main)                                        | `@WELOVEGAMES`                                                    |
| YOUTUBE_VODS_CHANNEL            | YouTube channel name (VODs)                                        | `@wlgvods`                                                        |
| YOUTUBE_APIKEY                  | YouTube Data v3 API key                                            | `AIzaSyD4o1234mFGHIJKLMNOPQRSTUVWXYZ`                             |
| YOUTUBE_UPLOAD_PLAYLIST_ID      | Main channel uploads playlist id                                   | `wefwefwefwe`                                                     |
| YOUTUBE_VODS_UPLOAD_PLAYLIST_ID | Vods channel uploads playlist id                                   | `wefwefwegwe`                                                     |
| YOUTUBE_SHORTS_PLAYLIST_ID      | Main channel short playlist id                                     | `wefgwegwegwe`                                                    |
| TIKTOK_CHANNEL                  | TikTok channel name                                                | `welovegames`                                                     |
| TIKTOK_KEY                      | TikTok API key (RapidAPI)                                          | `HIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz`                   |
| GOOGLE_SHEETS_EMAIL             | Google Sheets Service Account email                                | `wlgautobot@wlg-autobot.iam.gserviceaccount.com`                  |
| GOOGLE_SHEETS_KEY               | Google Sheets Service Account Key (BASE64)                         | `ewufgUIAGDFUEIAgfweiufweeofiwefuguigwef`                         |
| GOOGLE_SPREADSHEET_ID           | Google Sheets Spreadsheet ID (game info)                           | `1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ`  |
| GOOGLE_SHEET_ID                 | Google Sheets Sheet ID (game info)                                 | `0`                                                               |
| SHORT_STATS_SPREADSHEET_ID      | Google Sheets Spreadsheet ID (shorts stats)                        | `1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ`  |
| SHORT_STATS_SHEET_ID            | Google Sheets Sheet ID (shorts stats)                              | `0`                                                               |
| GEMINI_KEY                      | Google Gemini API key                                              | `fwefwefwUGWDfwudgw`                                              |
| ADMIN                           | Telegram user IDs with admin rights (comma separated)              | `1234567890,1234567890`                                           |
| SUBSCRIPTION_TIMECODES          | Telegram user IDs to send timecodes after stream (comma separated) | `1234567890,1234567890`                                           |
| WLGDL                           | HTTP URL to trigger WLGDL utility (optional)                       | `https://wlgdl.com/`                                              |

### App HTTP Endpoints

| Endpoint       | Description                            |
| -------------- | -------------------------------------- |
| GET /          | Always returns 200 OK                  |
| POST /telegram | For Telegram webhooks                  |
| POST /twitch   | For Twitch EventSub webhooks           |
| GET /stream    | Returns info about the previous stream |

### Possible Exceptions

- Missing or invalid API keys
- Incorrect ENV configuration
- Telegram API errors
- Google Sheets permission errors

<p align="right">(<a href="#top">back to top</a>)</p>

## ⬆️ Deployment

This bot is intended for [Deno Deploy](https://dash.deno.com/), but can be adapted for other platforms (e.g., Cloudflare Workers).

1. Register your project on Deno Deploy.
2. Create a Telegram bot and set webhook to `https://<your-project>.deno.dev/telegram`.
3. Register a Twitch app, subscribe to events, and set webhook to `https://<your-project>.deno.dev/twitch`.
4. Set up all required service accounts and keys.
5. Configure ENV variables in Deno Deploy.
6. Deploy using [deployctl](https://docs.deno.com/deploy/manual/deployctl/).

<p align="right">(<a href="#top">back to top</a>)</p>

## 🔗 Reference

- [Deno Deploy Docs](https://deno.com/deploy/docs)
- [Telegram Bot API](https://core.telegram.org/api)
- [Google Sheets API](https://developers.google.com/sheets/api)
- [YouTube Data API](https://developers.google.com/youtube/v3)
- [Twitch API](https://dev.twitch.tv/docs/api)
- [RapidAPI TikTok Scraper](https://rapidapi.com/tikwm-tikwm-default/api/tiktok-scraper7)
- [WLGDL Utility](https://github.com/wlgdev/wlgdl)

## License

MIT License © 2025 shevernitskiy, WELOVEGAMES
