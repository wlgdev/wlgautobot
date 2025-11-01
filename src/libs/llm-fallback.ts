import { logger } from "../utils.ts";

export type LlmResponse = {
  provider: string;
  model: string;
  response: string;
};

export async function llmFallback(
  prompt: string,
  // FIXME: fix types
  // deno-lint-ignore no-explicit-any
  providers: [(prompt: string, model: any, ...args: any[]) => Promise<string>, string, ...any][],
): Promise<string> {
  for (const [provider, model, ...args] of providers) {
    try {
      const response = await provider(prompt, model, ...args);
      return response;
    } catch (err) {
      logger.error("LLM Fallback", `[${model}] ${(err as Error).message}`);
    }
  }

  throw new Error("No providers available");
}
