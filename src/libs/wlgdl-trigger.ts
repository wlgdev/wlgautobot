async function wlgdlCall(): Promise<string> {
  const url = Deno.env.get("WLGDL");
  if (!url) return "Not endpoint set";
  const res = await fetch(url, {
    headers: {
      "X-WLG-Corp": "secret69sign",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`Request failed with status ${res.status}${res.body ? `: ${await res.text()}` : ""}`);
  }

  return res.text();
}

export async function wlgdlTrigger(): Promise<void> {
  const res = await wlgdlCall().catch((err) => `${err.message}`);
  console.log(`WGLDL Trigger: ${res}`);
}
