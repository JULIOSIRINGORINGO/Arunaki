export * from "./client.js"
export * from "./server.js"

import { createArunakiClient } from "./client.js"
import { createArunakiServer } from "./server.js"
import type { ServerOptions } from "./server.js"

export async function createArunaki(options?: ServerOptions) {
  const server = await createArunakiServer({
    ...options,
  })

  const client = createArunakiClient({
    baseUrl: server.url,
  })

  return {
    client,
    server,
  }
}
