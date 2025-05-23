import { config } from "../config.ts";

type GeminiModel =
  | "gemini-2.0-flash-lite" // 1500 RPD
  | "gemini-2.0-flash" // 1000 RPD
  | "gemini-1.5-flash" // 1500 RPD
  // deno-lint-ignore ban-types
  | (string & {});

export async function gemini(prompt: string, model: GeminiModel): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.llm.gemini.key}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
      signal: AbortSignal.timeout(10000),
    },
  );

  if (!res.ok) {
    throw new Error(`[Gemini] Failed to generate response: ${res.status}${res.body ? `: ${await res.text()}` : ""}`);
  }

  const data = await res.json();
  if (!data.candidates.at(0)?.content.parts.at(0)?.text) {
    throw new Error("[Gemini] Failed to generate response, empty");
  }
  return data.candidates.at(0)?.content.parts.at(0)?.text;
}

type ThinkingModel = string | "gemini-2.5-flash-preview-04-17"; // 500 RPD

export async function geminiThinking(prompt: string, model: ThinkingModel, thinking_budget = 0): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.llm.gemini.key}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          thinkingConfig: {
            thinkingBudget: thinking_budget,
          },
        },
      }),
      signal: AbortSignal.timeout(10000),
    },
  );

  if (!res.ok) {
    throw new Error(`[Gemini] Failed to generate response: ${res.status}${res.body ? `: ${await res.text()}` : ""}`);
  }

  const data = await res.json();

  if (!data.candidates.at(0)?.content.parts.at(0)?.text) {
    throw new Error("[Gemini] Failed to generate response, empty");
  }

  return data.candidates.at(0)?.content.parts.at(0)?.text;
}
