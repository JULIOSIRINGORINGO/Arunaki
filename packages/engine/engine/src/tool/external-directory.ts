import path from "path"
import { Effect } from "effect"
import { InstanceState } from "@/effect/instance-state"
import type * as Tool from "./tool"
import { containsPath } from "../project/instance-context"
import { FSUtil } from "@arunaki/core/fs-util"

type Kind = "file" | "directory"

type Options = {
  bypass?: boolean
  kind?: Kind
}

export const assertExternalDirectoryEffect = Effect.fn("Tool.assertExternalDirectory")(function* (
  ctx: Tool.Context,
  target?: string,
  options?: Options,
) {
  if (!target) return false

  if (options?.bypass) return false

  const ins = yield* InstanceState.context
  const full = process.platform === "win32" ? FSUtil.normalizePath(target) : target

  // STRICT GUARDRAIL: Automatically block access to hidden files and directories starting with '.'
  const root = ins.worktree || ins.directory
  if (root) {
    const normRoot = process.platform === "win32" ? FSUtil.normalizePath(root) : root
    const rel = path.relative(normRoot, full)
    if (rel && !rel.startsWith("..")) {
      const segments = rel.split(/[/\\]/)
      if (segments.some((seg) => seg.startsWith(".") && seg !== "." && seg !== "..")) {
        return yield* Effect.fail(
          new Error(`Access denied: '${target}' is a protected hidden or system file/directory (starting with '.').`)
        )
      }
    }
  }

  if (containsPath(full, ins)) return false

  const kind = options?.kind ?? "file"
  const dir = kind === "directory" ? full : path.dirname(full)
  const glob =
    process.platform === "win32"
      ? FSUtil.normalizePathPattern(path.join(dir, "*"))
      : path.join(dir, "*").replaceAll("\\", "/")

  yield* ctx.ask({
    permission: "external_directory",
    patterns: [glob],
    always: [glob],
    metadata: {
      filepath: full,
      parentDir: dir,
    },
  })
  return true
})

export async function assertExternalDirectory(ctx: Tool.Context, target?: string, options?: Options) {
  return Effect.runPromise(assertExternalDirectoryEffect(ctx, target, options))
}
