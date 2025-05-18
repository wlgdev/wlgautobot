import { Context, InlineKeyboard } from "@grammyjs/grammy";

enum MSMOP {
  None = 0,
  Submit = 1,
  Cancel = 2,
  Update = 3,
}

type OpData = {
  op: MSMOP;
  id: string;
  index: number;
  data: boolean;
};

type MultiSelectMenuOptions = {
  id: string;
  text: string;
  options: string[];
  onSubmit: (ctx: Context, text: string, options: { label: string; check: boolean }[]) => Promise<void> | void;
};

export class MultiSelectMenu {
  constructor(private options: MultiSelectMenuOptions) {}

  handler(): (ctx: Context, next: () => Promise<void>) => void {
    return async (ctx, next) => {
      if (!ctx.callbackQuery?.data) return next();
      const opdata = this.decode(ctx.callbackQuery.data);
      if (opdata.id !== this.options.id) return next();
      ctx.answerCallbackQuery();
      await this.router(ctx, opdata);
      next();
    };
  }

  setOptions(options: string[]): this {
    this.options.options = options;
    return this;
  }

  setText(text: string): this {
    this.options.text = text;
    return this;
  }

  async create(ctx: Context, parent_message_id?: number): Promise<void> {
    if (this.options.options.length === 0) {
      console.error("No options");
      return;
    }
    const keyboard = new InlineKeyboard();
    for (const [index, option] of this.options.options.entries()) {
      keyboard.text(option, this.encode(MSMOP.Update, this.options.id, index, false)).row();
    }

    keyboard
      .text("Ок", this.encode(MSMOP.Submit, this.options.id, 0, false))
      .text("Отмена", this.encode(MSMOP.Cancel, this.options.id, 0, false))
      .row();

    if (parent_message_id) {
      await ctx.api.editMessageText(ctx.chat?.id!, parent_message_id, this.options.text, {
        reply_markup: keyboard,
      });
    } else {
      await ctx.reply(this.options.text, {
        reply_markup: keyboard,
      });
    }
  }

  private decode(payload: string): OpData {
    if (!payload.startsWith("MSM|")) return { op: MSMOP.None, id: "none", index: 0, data: false };
    const splitted = payload.split("|");
    if (splitted.length < 5) return { op: MSMOP.None, id: "none", index: 0, data: false };
    return {
      op: parseInt(splitted[1]) ?? MSMOP.None,
      id: splitted[2] ?? "none",
      index: parseInt(splitted[3]) ?? 0,
      data: splitted[4] === "1" ? true : false,
    };
  }

  private encode(op: MSMOP, id: string, index: number, data: boolean): string {
    return `MSM|${op}|${id}|${index}|${data ? 1 : 0}`;
  }

  private async router(ctx: Context, { op, id, index, data }: OpData): Promise<void> {
    switch (op) {
      case MSMOP.None:
        break;
      case MSMOP.Submit:
        await this.submitMenu(ctx);
        break;
      case MSMOP.Cancel:
        await this.cancelMenu(ctx);
        break;
      case MSMOP.Update:
        this.updateMenu(ctx, id, index, data);
        break;
    }
  }

  private async updateMenu(ctx: Context, id: string, index: number, data: boolean): Promise<void> {
    if (!ctx.callbackQuery?.message?.reply_markup?.inline_keyboard) return;
    const new_keyboard = ctx.callbackQuery.message.reply_markup.inline_keyboard;
    // @ts-ignore it exists
    new_keyboard[index][0].callback_data = this.encode(MSMOP.Update, id, index, !data);
    const prev_text = new_keyboard[index][0].text.replace("✅ ", "");
    new_keyboard[index][0].text = `${!data ? "✅ " : ""}${prev_text}`;
    await ctx.api.editMessageReplyMarkup(ctx.chat?.id!, ctx.callbackQuery?.message?.message_id!, {
      reply_markup: {
        inline_keyboard: new_keyboard,
      },
    });
  }

  private async submitMenu(ctx: Context): Promise<void> {
    if (!ctx.callbackQuery?.message?.reply_markup?.inline_keyboard) return;

    const out: { label: string; check: boolean }[] = [];
    for (let i = 0; i < ctx.callbackQuery.message.reply_markup.inline_keyboard.length - 1; i++) {
      const raw_label = ctx.callbackQuery.message.reply_markup.inline_keyboard[i][0].text;
      if (raw_label.startsWith("✅")) {
        out.push({ label: raw_label.replace("✅ ", ""), check: true });
      } else {
        out.push({ label: raw_label, check: false });
      }
    }
    await this.options.onSubmit(ctx, ctx.callbackQuery.message.text ?? "", out);
  }

  private async cancelMenu(ctx: Context): Promise<void> {
    await ctx.deleteMessage();
  }
}
