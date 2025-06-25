export interface GoogleSearchOptions {
  numResults?: number;
  lang?: string;
  proxy?: string;
  timeout?: number;
  safe?: "active" | "off";
  region?: string;
  start?: number;
  unique?: boolean;
}
export interface GoogleSearchResult {
  title: string;
  url: string;
  displayedUrl: string;
  snippet: string;
}

export class GoogleSearch {
  private static getRandomUserAgent(): string {
    const lynxVersion = `Lynx/${2 + Math.floor(Math.random() * 2)}.${8 + Math.floor(Math.random() * 2)}.${
      Math.floor(
        Math.random() * 3,
      )
    }`;
    const libwwwVersion = `libwww-FM/${2 + Math.floor(Math.random() * 2)}.${13 + Math.floor(Math.random() * 3)}`;
    const sslMmVersion = `SSL-MM/${1 + Math.floor(Math.random())}.${3 + Math.floor(Math.random() * 3)}`;
    const opensslVersion = `OpenSSL/${1 + Math.floor(Math.random() * 3)}.${Math.floor(Math.random() * 5)}.${
      Math.floor(
        Math.random() * 10,
      )
    }`;
    return `${lynxVersion} ${libwwwVersion} ${sslMmVersion} ${opensslVersion}`;
  }

  private static async makeRequest(term: string, options: GoogleSearchOptions = {}): Promise<string> {
    const { numResults = 10, lang = "en", proxy, timeout = 5000, safe = "active", region, start = 0 } = options;

    const url = "https://www.google.com/search";
    const params = new URLSearchParams({
      q: term,
      num: (numResults + 2).toString(),
      hl: lang,
      start: start.toString(),
      safe: safe,
      ...(region && { gl: region }),
    });

    const headers = {
      "User-Agent": GoogleSearch.getRandomUserAgent(),
      "Accept": "*/*",
      "Cookie": "CONSENT=PENDING+987; SOCS=CAESHAgBEhIaAB",
    };

    const axiosConfig = {
      headers,
      timeout,
      ...(proxy && {
        proxy: {
          protocol: proxy.startsWith("https") ? "https" : "http",
          host: new URL(proxy).hostname,
          port: parseInt(new URL(proxy).port) || (proxy.startsWith("https") ? 443 : 80),
        },
      }),
      validateStatus: (status: number) => status === 200,
      maxRedirects: 5,
      decompress: true,
    };

    try {
      const response = await fetch(`${url}?${params.toString()}`, axiosConfig);
      return await response.text();
    } catch (error) {
      throw new Error(`Error making request: ${error}`);
    }
  }

  private static parseGoogleSearchResults(html: string): GoogleSearchResult[] {
    const results: GoogleSearchResult[] = [];
    const resultMarker = '"/url?q=';
    const htmlChunks = html.split(resultMarker);

    for (let i = 1; i < htmlChunks.length; i++) {
      const chunk = htmlChunks[i];

      try {
        const urlEndIndex = chunk.indexOf("&");
        if (urlEndIndex === -1) continue;

        const rawUrl = chunk.substring(0, urlEndIndex);
        const url = decodeURIComponent(rawUrl);

        if (!url.startsWith("http")) {
          continue;
        }

        const linkBlockEndIndex = chunk.indexOf("</a>");
        if (linkBlockEndIndex === -1) continue;

        const linkBlock = chunk.substring(0, linkBlockEndIndex);
        const snippetBlock = chunk.substring(linkBlockEndIndex + 4);
        const displayedUrlRegex = /<span[^>]*>([\s\S]*?›[\s\S]*?)<\/span>/;
        const displayedUrlMatch = linkBlock.match(displayedUrlRegex);

        let displayedUrl = "";
        let titleBlock = linkBlock;

        if (displayedUrlMatch && displayedUrlMatch[1]) {
          displayedUrl = cleanText(displayedUrlMatch[1]);
          titleBlock = linkBlock.replace(displayedUrlMatch[0], "");
        }

        const title = cleanText(titleBlock);
        const snippet = cleanText(snippetBlock);

        if (title && url) {
          results.push({
            title,
            url,
            displayedUrl: displayedUrl || cleanText(url.split("/")[2]), // Fallback to domain if not found
            snippet,
          });
        }
      } catch (error) {
        console.error("Error parsing a result chunk:", error);
      }
    }

    return results;
  }

  public static async search(term: string, options: GoogleSearchOptions = {}): Promise<GoogleSearchResult[]> {
    const html = await GoogleSearch.makeRequest(term, options);
    return GoogleSearch.parseGoogleSearchResults(html);
  }
}

function cleanText(text: string): string {
  if (!text) {
    return "";
  }
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/&#(\d+);/g, (_match, dec) => String.fromCharCode(dec))
    .replace(/&/g, "&")
    .replace(/"/g, '"')
    .replace(/'/g, "'")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/…/g, "...")
    .replace(/›/g, "›")
    .replace(/\s+/g, " ")
    .trim();
}
