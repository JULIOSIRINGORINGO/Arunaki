export * as ConfigPaths from "./paths"

import path from "path"
import { Flag } from "@arunaki/core/flag/flag"
import { Global } from "@arunaki/core/global"
import { unique } from "remeda"
import * as Effect from "effect/Effect"
import { FSUtil } from "@arunaki/core/fs-util"

export const files = Effect.fn("ConfigPaths.projectFiles")(function* (
  name: string,
  directory: string,
  worktree?: string,
) {
  const afs = yield* FSUtil.Service
  return (yield* afs.up({
    targets: [`${name}.jsonc`, `${name}.json`],
    start: directory,
    stop: worktree,
  })).toReversed()
})

export const directories = Effect.fn("ConfigPaths.directories")(function* (directory: string, worktree?: string) {
  const afs = yield* FSUtil.Service
  return unique([
    Global.Path.config,
    ...(!Flag.Arunaki_DISABLE_PROJECT_CONFIG
      ? yield* afs.up({
          targets: [".Arunaki"],
          start: directory,
          stop: worktree,
        })
      : []),
    ...(yield* afs.up({
      targets: [".Arunaki"],
      start: Global.Path.home,
      stop: Global.Path.home,
    })),
    ...(Flag.Arunaki_CONFIG_DIR ? [Flag.Arunaki_CONFIG_DIR] : []),
  ])
})

export function fileInDirectory(dir: string, name: string) {
  return [path.join(dir, `${name}.json`), path.join(dir, `${name}.jsonc`)]
}
