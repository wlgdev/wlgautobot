import { type Mutatable, MUTATED, proxify } from "@shevernitskiy/proxify";

export type StreamHistoryEntry = {
  title: string;
  category: string;
  category_id: string;
  changed_title: boolean;
  changed_category: boolean;
  offset: number;
};

export const default_state = {
  stream: {
    online: false,
    title: null as string | null,
    category: null as string | null,
    category_id: null as string | null,
    start_time: 0,
    end_time: 0,
    history: [] as StreamHistoryEntry[],
  },
  stats: {
    last_title: "Самый невезучий персонаж в игре",
  },
  google_sheets: {
    last_date: "23.07.2025",
  },
  [MUTATED]: true,
};

export async function getState(): Promise<Mutatable<typeof default_state>> {
  const db = await Deno.openKv(Deno.env.get("DENO_DEPLOYMENT_ID") !== undefined ? undefined : "kv.db");
  const state = (await db.get<typeof default_state>(["state"])).value ?? default_state;

  return proxify(state, async () => {
    if (state[MUTATED]) {
      console.debug("saving state");
      state[MUTATED] = false;
      await db.set(["state"], state);
    }
    db.close();
  });
}

export type State = Awaited<ReturnType<typeof getState>>;
