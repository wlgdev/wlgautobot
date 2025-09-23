import { config } from "../config.ts";

export type DDGSearchResponse = {
  status: "success";
  query: string;
  results: DDGSearchItem[];
};

export type DDGSearchItem = {
  position: number;
  url: string;
  title: string;
  description: string;
  description_html: string;
  types: string;
  host: string;
  sublinks: unknown[]; // Using `unknown[]` as the array is empty in the provided example
};

export async function searchDDG(query: string): Promise<DDGSearchItem[]> {
  const res = await fetch(
    `https://postproxy.deno.dev/forward?url=https://duckduckgo8.p.rapidapi.com/?q=${decodeURIComponent(query)}`,
    {
      headers: {
        "x-rapidapi-key": config.ddg.key,
        "x-rapidapi-host": "duckduckgo8.p.rapidapi.com",
      },
    },
  );
  console.log(res);
  const data = await res.json();
  console.log(data);
  return data.results ?? [];
}
