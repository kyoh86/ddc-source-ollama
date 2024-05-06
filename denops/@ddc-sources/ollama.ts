import {
  BaseSource,
  GatherArguments,
  OnCompleteDoneArguments,
} from "https://deno.land/x/ddc_vim@v4.3.1/base/source.ts";
import { Denops } from "https://deno.land/x/denops_std@v6.2.0/mod.ts";
import { DdcGatherItems } from "https://deno.land/x/ddc_vim@v4.3.1/types.ts";
import { fn } from "https://deno.land/x/ddc_vim@v4.3.1/deps.ts";

export type CompletionMetadata = {
  word: string;
};

type Params = Record<string, never>;

export class Source extends BaseSource<Params> {
  async gather(
    args: GatherArguments<Params>,
  ): Promise<DdcGatherItems> {
    const denops: Denops = args.denops;
    // NOTE: never await this dispatch for early-return with empty suggestion items
    denops.dispatch("ollama", "complete", {
      callback: async (text: string) => {
        const match = /^(?<indent>\s*).+/.exec(text);
        const indent = match?.groups?.indent;

        const info = indent != null
          ? text.split("\n").map((line) => line.slice(indent.length)).join(
            "\n",
          )
          : text;

        await args.denops.call("ddc#update_items", this.name, [{
          word: text.split("\n")[0].slice(args.completePos),
          info,
          user_data: {
            word: text,
          },
        }]);
      },
    });

    return await Promise.resolve({
      items: [],
      isIncomplete: true,
    });
  }

  params() {
    return {};
  }

  async onCompleteDone(
    args: OnCompleteDoneArguments<Params, CompletionMetadata>,
  ) {
    const firstLine = args.userData?.word.split("\n")[0];
    const currentLine = await fn.getline(args.denops, ".");
    if (currentLine !== firstLine) {
      return;
    }

    const lines = args.userData?.word.split("\n");
    if (lines === undefined || lines[1] === undefined) {
      return;
    }

    const lnum = await fn.line(args.denops, ".");
    const appendLines = lines.slice(1);
    await fn.append(args.denops, lnum, appendLines);
    await fn.setpos(args.denops, ".", [
      0,
      lnum + appendLines.length,
      appendLines.slice(-1)[0].length + 1,
      0,
    ]);
  }
}
