import { retry } from "@std/async/retry";

export const isDenoDeploy = Deno.env.get("DENO_DEPLOYMENT_ID") !== undefined;
export async function getDb() {
  const db = await Deno.openKv(isDenoDeploy ? undefined : "kv.db");
  return {
    db,
    [Symbol.dispose]: () => db.close(),
  };
}

export function scince(ts: number): string {
  const diff = (Date.now() - ts) / 1000;
  const hours = ~~(diff / 3600);
  const minutes = ~~((diff - hours * 3600) / 60);
  const seconds = ~~(diff - hours * 3600 - minutes * 60);
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${
    seconds
      .toString()
      .padStart(2, "0")
  }`;
}

export function stripHashtags(text: string): string {
  return text.split("#")[0].trim();
}

export function tsToString(ts: number): string {
  const date = new Date(ts);
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export function duration(length: number): string {
  const hours = ~~(length / 3600);
  const minutes = ~~((length - hours * 3600) / 60);
  const seconds = ~~(length - hours * 3600 - minutes * 60);
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${
    seconds
      .toString()
      .padStart(2, "0")
  }`;
}

export function seconds(duration: string): number {
  const [hours, minutes, seconds] = duration.split(":").map(Number);
  return hours * 3600 + minutes * 60 + seconds;
}

export function fetchRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: {
    multiplier: number;
    maxTimeout: number;
    maxAttempts: number;
    minTimeout: number;
    jitter: number;
  },
): Promise<Response> {
  return retry(() => fetch(input, init), {
    multiplier: options?.multiplier ?? 1.5,
    maxTimeout: options?.maxTimeout ?? 30000,
    maxAttempts: options?.maxAttempts ?? 10,
    minTimeout: options?.minTimeout ?? 1000,
    jitter: options?.jitter ?? 0,
  });
}
