import { afterEach, describe, expect } from "bun:test"
import path from "path"
import { Server } from "../../src/server/server"
import { Effect, Fiber } from "effect"
import { resetDatabase } from "../fixture/db"
import { disposeAllInstances, tmpdir } from "../fixture/fixture"
import { it, pollWithTimeout } from "../lib/effect"
import { waitGlobalBusEvent } from "./global-bus"

function app() {
  return Server.Default().app
}

function waitDisposed(directory: string) {
  return waitGlobalBusEvent({
    message: "timed out waiting for instance disposal",
    predicate: (event) => event.payload.type === "server.instance.disposed" && event.directory === directory,
  })
}

const tmpdirEffect = (options: Parameters<typeof tmpdir>[0]) =>
  Effect.acquireRelease(
    Effect.promise(() => tmpdir(options)),
    (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
  )

afterEach(async () => {
  await disposeAllInstances()
  await resetDatabase()
})

const headers = (directory: string) => ({
  "content-type": "application/json",
  "x-arunaki-directory": directory,
})

describe("provider settings HttpApi", () => {
  it.live(
    "adds an OpenAI-compatible provider to the workspace config",
    Effect.gen(function* () {
      const tmp = yield* tmpdirEffect({ config: { formatter: false, lsp: false } })
      const disposed = yield* waitDisposed(tmp.path).pipe(Effect.forkScoped({ startImmediately: true }))

      const response = yield* Effect.promise(() =>
        Promise.resolve(
          app().request("/api/providers", {
            method: "POST",
            headers: headers(tmp.path),
            body: JSON.stringify({
              name: "9Router Gateway",
              type: "9router",
              baseUrl: "http://localhost:20128/v1",
              apiKey: "key-123",
              model: "cx/gpt-5.6-terra, deepseek-r1",
            }),
          }),
        ),
      )

      expect(response.status).toBe(200)
      expect(yield* Effect.promise(() => response.json())).toMatchObject({
        data: {
          id: "9router",
          name: "9Router Gateway",
          type: "9router",
          baseUrl: "http://localhost:20128/v1",
          apiKey: "key-123",
          model: "cx/gpt-5.6-terra, deepseek-r1",
          active: true,
        },
      })
      yield* Fiber.join(disposed)
      expect(yield* Effect.promise(() => Bun.file(path.join(tmp.path, "arunaki.json")).json())).toMatchObject({
        provider: {
          "9router": {
            name: "9Router Gateway",
            npm: "@ai-sdk/openai-compatible",
            options: { baseURL: "http://localhost:20128/v1", apiKey: "key-123" },
          },
        },
      })

      yield* pollWithTimeout(
        Effect.gen(function* () {
          const list = yield* Effect.promise(() =>
            Promise.resolve(
              app().request("/api/providers", {
                headers: headers(tmp.path),
              }),
            ),
          )
          const listBody = yield* Effect.promise(() => list.json())
          return listBody.data?.[0]?.id === "9router" ? (true as const) : undefined
        }),
        "added provider not visible on list after reload",
      )

      const list = yield* Effect.promise(() =>
        Promise.resolve(
          app().request("/api/providers", {
            headers: headers(tmp.path),
          }),
        ),
      )
      expect(list.status).toBe(200)
      const listBody = yield* Effect.promise(() => list.json())
      expect(listBody).toMatchObject({
        data: [
          {
            id: "9router",
            name: "9Router Gateway",
            type: "9router",
            model: "cx/gpt-5.6-terra, deepseek-r1",
            active: true,
            priority: 0,
          },
        ],
      })
    }),
    30_000,
  )

  it.live(
    "deactivates and deletes a provider via the settings UI endpoints",
    Effect.gen(function* () {
      const tmp = yield* tmpdirEffect({ config: { formatter: false, lsp: false } })

      const created = yield* Effect.promise(() =>
        Promise.resolve(
          app().request("/api/providers", {
            method: "POST",
            headers: headers(tmp.path),
            body: JSON.stringify({
              name: "Groq Cloud",
              type: "groq",
              baseUrl: "https://api.groq.com/openai/v1",
              model: "llama-3.3-70b-versatile",
            }),
          }),
        ),
      )
      expect(created.status).toBe(200)
      expect(yield* Effect.promise(() => created.json())).toMatchObject({ data: { id: "groq" } })

      const deactivated = yield* Effect.promise(() =>
        Promise.resolve(
          app().request("/api/providers/groq/state", {
            method: "PUT",
            headers: headers(tmp.path),
            body: JSON.stringify({ active: false }),
          }),
        ),
      )
      expect(deactivated.status).toBe(200)
      expect(yield* Effect.promise(() => deactivated.json())).toMatchObject({ data: { active: false } })

      const state = yield* Effect.promise(() => Bun.file(path.join(tmp.path, "arunaki.json")).json())
      expect(state.disabled_providers).toContain("groq")

      const deleted = yield* Effect.promise(() =>
        Promise.resolve(
          app().request("/api/providers/groq", {
            method: "DELETE",
            headers: headers(tmp.path),
          }),
        ),
      )
      expect(deleted.status).toBe(200)
      expect(yield* Effect.promise(() => deleted.json())).toMatchObject({ data: { id: "groq" } })

      const after = yield* Effect.promise(() => Bun.file(path.join(tmp.path, "arunaki.json")).json())
      expect(after.provider).not.toHaveProperty("groq")

      yield* pollWithTimeout(
        Effect.gen(function* () {
          const list = yield* Effect.promise(() =>
            Promise.resolve(
              app().request("/api/providers", {
                headers: headers(tmp.path),
              }),
            ),
          )
          const body = yield* Effect.promise(() => list.json())
          return body.data.length === 0 ? (true as const) : undefined
        }),
        "stale provider still listed after deletion",
      )
    }),
    30_000,
  )

  it.live(
    "reports unreachable endpoints gracefully for test and fetch-models",
    Effect.gen(function* () {
      const tmp = yield* tmpdirEffect({ config: { formatter: false, lsp: false } })

      const test = yield* Effect.promise(() =>
        Promise.resolve(
          app().request("/api/providers/test", {
            method: "POST",
            headers: headers(tmp.path),
            body: JSON.stringify({ baseUrl: "http://127.0.0.1:1", apiKey: "x", model: "test-model" }),
          }),
        ),
      )
      expect(test.status).toBe(200)
      expect(yield* Effect.promise(() => test.json())).toMatchObject({ data: { success: false } })

      const models = yield* Effect.promise(() =>
        Promise.resolve(
          app().request("/api/providers/fetch-models", {
            method: "POST",
            headers: headers(tmp.path),
            body: JSON.stringify({ baseUrl: "http://127.0.0.1:1", apiKey: "x" }),
          }),
        ),
      )
      expect(models.status).toBe(200)
      expect(yield* Effect.promise(() => models.json())).toEqual({ data: { models: [] } })
    }),
    30_000,
  )
})