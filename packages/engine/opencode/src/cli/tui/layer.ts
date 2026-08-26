import { run as runTui, type TuiInput } from "@Arunaki-ai/tui"
import { Global } from "@arunaki/core/global"
import { AppNodeBuilder } from "@arunaki/core/effect/app-node-builder"
import { Effect } from "effect"

export function run(input: TuiInput) {
  return runTui(input).pipe(Effect.provide(AppNodeBuilder.build(Global.node)))
}
