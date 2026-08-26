// @ts-nocheck

import { Arunaki } from "@arunaki/core"
import { ReadTool } from "@arunaki/core/tools"

const Arunaki = Arunaki.make({})

Arunaki.tool.add(ReadTool)

Arunaki.tool.add({
  name: "bash",
  schema: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "The command to run.",
      },
    },
    required: ["command"],
  },
  execute(input, ctx) {},
})

Arunaki.auth.add({
  provider: "openai",
  type: "api",
  value: process.env.OPENAI_API_KEY,
})

Arunaki.agent.add({
  name: "build",
  permissions: [],
  model: {
    id: "gpt-5-5",
    provider: "openai",
    variant: "xhigh",
  },
})

const sessionID = await Arunaki.session.create({
  agent: "build",
})

Arunaki.subscribe((event) => {
  console.log(event)
})

await Arunaki.session.prompt({
  sessionID,
  text: "hey what is up",
})

await Arunaki.session.prompt({
  sessionID,
  text: "what is up with this",
  files: [
    {
      mime: "image/png",
      uri: "data:image/png;base64,xxxx",
    },
  ],
})

await Arunaki.session.wait()

console.log(await Arunaki.session.messages(sessionID))
