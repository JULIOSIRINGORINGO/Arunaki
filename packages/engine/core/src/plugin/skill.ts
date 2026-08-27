/// <reference path="../markdown.d.ts" />

export * as SkillPlugin from "./skill"

import { define } from "./internal"
import { Effect } from "effect"
import { AbsolutePath } from "../schema"
import { SkillV2 } from "../skill"
import customizeArunakiContent from "./skill/customize-arunaki.md" with { type: "text" }

export const CustomizeArunakiContent = customizeArunakiContent

export const Plugin = define({
  id: "skill",
  effect: Effect.fn(function* (ctx) {
    yield* ctx.skill.transform((draft) => {
      draft.source(
        SkillV2.EmbeddedSource.make({
          type: "embedded",
          skill: SkillV2.Info.make({
            name: "customize-Arunaki",
            description:
              "Use ONLY when the user is editing or creating Arunaki's own configuration: arunaki.json, arunaki.jsonc, files under .Arunaki/, or files under ~/.config/Arunaki/. Also use when creating or fixing Arunaki agents, subagents, commands, skills, plugins, MCP servers, or permission rules. Do not use for the user's own application code, or for any project that is not configuring Arunaki itself.",
            location: AbsolutePath.make("/builtin/customize-Arunaki.md"),
            content: CustomizeArunakiContent,
          }),
        }),
      )
    })
  }),
})
