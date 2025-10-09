import { logger } from "../utils.ts";

export type LlmResponse = {
  provider: string;
  model: string;
  response: string;
};

export async function llmFallback(
  prompt: string,
  providers: [(prompt: string, model: string) => Promise<string>, string][],
): Promise<string> {
  for (const [provider, model] of providers) {
    try {
      const response = await provider(prompt, model);
      return response;
    } catch (err) {
      logger.error("LLM Fallback", `[${model}] ${(err as Error).message}`);
    }
  }

  throw new Error("No providers available");
}
