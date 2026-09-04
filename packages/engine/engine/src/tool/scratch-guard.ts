import path from "path"
import os from "os"
import { Effect } from "effect"
import { InstanceState } from "@/effect/instance-state"

const SCRATCH_DIR = path.join(os.homedir(), ".arunaki", "scratch")

/**
 * Detects whether the current session is operating on the internal
 * scratch directory (i.e. no real project folder has been opened).
 *
 * When true, file-access tools should return a user-friendly
 * "no folder connected" message instead of exposing the internal path.
 */
export const isScratchMode = Effect.gen(function* () {
  const ins = yield* InstanceState.context
  const normalized = ins.directory.toLowerCase().replace(/\\/g, "/")
  return normalized.includes(".arunaki/scratch")
})

/**
 * Message returned to the LLM when a file tool is invoked in scratch mode.
 * The LLM will relay this to the user instead of listing internal paths.
 */
export const SCRATCH_MODE_RESPONSE = {
  title: "no-folder",
  metadata: {},
  output: [
    "No document folder is currently connected.",
    "The user has not opened a project folder yet.",
    "Advise the user to click the \"Open Folder\" button to connect their document folder,",
    "or they can paste text/notes directly into the chat for immediate processing.",
    "Do NOT mention any internal paths or scratch directories.",
  ].join("\n"),
}
