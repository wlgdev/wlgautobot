type SearchResult = {
  title: string;
  description: string;
  url: string;
  sn: string;
};

async function searchVqd(query: string): Promise<string> {
  const URL = "https://duckduckgo.com/";
  const params = new URLSearchParams({
    hps: "1",
    q: query,
    ia: "web",
  });
  const res = await fetch(`${URL}?${params.toString()}`, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
      "authority": "duckduckgo.com",
      "accept": "application/json, text/javascript, */*; q=0.01",
      "sec-fetch-dest": "empty",
      "x-requested-with": "XMLHttpRequest",
      "sec-fetch-site": "same-origin",
      "sec-fetch-mode": "cors",
      "referer": "https://duckduckgo.com/",
    },
  });
  const data = await res.text();
  return data
    .match(/\&vqd=([\d-]+)\&/g)![0]
    ?.replace("&vqd=", "")
    .replace("&", "");
}

export async function searchDDG(query: string): Promise<SearchResult[]> {
  const vqd = await searchVqd(query);
  const URL = "https://links.duckduckgo.com/d.js";

  const params = new URLSearchParams({
    q: query,
    l: "ru-ru",
    s: "0",
    dl: "ru",
    ct: "RU",
    vqd: vqd,
    bing_market: "ru-RU",
    p_ent: "",
    ex: "-1",
    hps: "1",
    host_region: "euw",
    sp: "1",
    dfrsp: "1",
    wrap: "1",
    aps: "0",
    biaexp: "b",
    litexp: "b",
    msvrtexp: "b",
  });

  const res = await fetch(`${URL}?${params.toString()}`, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
      "authority": "duckduckgo.com",
      "accept": "application/json, text/javascript, */*; q=0.01",
      "sec-fetch-dest": "empty",
      "x-requested-with": "XMLHttpRequest",
      "sec-fetch-site": "same-origin",
      "sec-fetch-mode": "cors",
      "referer": "https://duckduckgo.com/",
    },
  });
  const data = await res.text();
  const o = data.split("DDG.pageLayout.load('d',")[1].split(");DDG.")[0].trim();
  const d = JSON.parse(o);
  const out = [];
  for (const item of d) {
    if (item.u) {
      out.push({
        title: item.t,
        description: item.a,
        url: item.u,
        sn: item.sn,
      });
    }
  }
  return out;
}
