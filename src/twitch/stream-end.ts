import { getState } from "../state.ts";
import { config } from "../config.ts";
import { sendTimecodesMessage } from "../features/timecodes.ts";

export async function streamEnd(): Promise<void> {
  await using state = await getState();

  state.stream.online = false;
  state.stream.end_time = Date.now();
  await sendTimecodesMessage(
    state,
    config.subscription.timecodes,
    new Date(state.stream.start_time).toLocaleDateString("ru-RU"),
  );
  console.log("Timecodes Monitor: stream ended");
}
