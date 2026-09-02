import { afterEach, describe, expect } from "bun:test"
import { Server } from "../../src/server/server"
import { Effect } from "effect"
import { resetDatabase } from "../fixture/db"
import { disposeAllInstances } from "../fixture/fixture"
import { it } from "../lib/effect"

function app() {
  return Server.Default().app
}

const ENV_KEYS = [
  "ARUNAKI_GOOGLE_CLIENT_ID",
  "ARUNAKI_GOOGLE_CLIENT_SECRET",
  "ARUNAKI_GITHUB_CLIENT_ID",
  "ARUNAKI_GITHUB_CLIENT_SECRET",
]

function withClientCreds(provider: "google" | "github", value: string) {
  const prefix = `ARUNAKI_${provider.toUpperCase()}_CLIENT`
  process.env[`${prefix}_ID`] = value
  process.env[`${prefix}_SECRET`] = value
}

afterEach(async () => {
  await disposeAllInstances()
  await resetDatabase()
  for (const key of ENV_KEYS) delete process.env[key]
})

describe("oauth login HttpApi", () => {
  it.live(
    "rejects sign-in start when provider credentials are not configured",
    Effect.gen(function* () {
      const response = yield* Effect.promise(() => Promise.resolve(app().request("/api/oauth/google/start")))
      expect(response.status).toBe(400)
      const body = yield* Effect.promise(() => response.text())
      expect(body).toContain("configured")
      expect(body).toContain("ARUNAKI_GOOGLE_CLIENT_ID")
    }),
    30_000,
  )

  it.live(
    "returns an authorize URL and state when credentials are configured",
    Effect.gen(function* () {
      withClientCreds("google", "google-dummy")
      const google = yield* Effect.promise(() => Promise.resolve(app().request("/api/oauth/google/start")))
      expect(google.status).toBe(200)
      const googleBody = (yield* Effect.promise(() => google.json())) as { url: string; state: string }
      expect(googleBody.url.startsWith("https://accounts.google.com/o/oauth2/v2/auth?")).toBe(true)
      expect(googleBody.url).toContain("client_id=google-dummy")
      expect(googleBody.url).toContain(`redirect_uri=${encodeURIComponent("http://127.0.0.1:4096/api/oauth/google/callback")}`)
      expect(googleBody.state.length).toBeGreaterThan(10)

      withClientCreds("github", "github-dummy")
      const github = yield* Effect.promise(() => Promise.resolve(app().request("/api/oauth/github/start")))
      expect(github.status).toBe(200)
      const githubBody = (yield* Effect.promise(() => github.json())) as { url: string; state: string }
      expect(githubBody.url.startsWith("https://github.com/login/oauth/authorize?")).toBe(true)
      expect(githubBody.url).toContain("client_id=github-dummy")

      const pending = yield* Effect.promise(() =>
        Promise.resolve(app().request(`/api/oauth/google/result?state=${encodeURIComponent(googleBody.state)}`)),
      )
      expect(pending.status).toBe(200)
      expect(yield* Effect.promise(() => pending.json())).toEqual({ pending: true, email: "", name: "", avatar: "" })
    }),
    30_000,
  )

  it.live(
    "returns branded error pages for invalid or denied callbacks",
    Effect.gen(function* () {
      const missing = yield* Effect.promise(() => Promise.resolve(app().request("/api/oauth/google/callback")))
      expect(missing.status).toBe(200)
      expect(missing.headers.get("content-type")).toContain("text/html")
      expect(yield* Effect.promise(() => missing.text())).toContain("Authorization failed")

      withClientCreds("github", "github-dummy")
      const denied = yield* Effect.promise(() =>
        Promise.resolve(app().request("/api/oauth/github/callback?state=stale&error=access_denied&error_description=User%20denied")),
      )
      expect(denied.status).toBe(200)
      expect(yield* Effect.promise(() => denied.text())).toContain("User denied")

      withClientCreds("google", "google-dummy")
      const genuine = yield* Effect.promise(() => Promise.resolve(app().request("/api/oauth/google/start")))
      expect(genuine.status).toBe(200)
      const state = ((yield* Effect.promise(() => genuine.json())) as { state: string }).state
      const noCode = yield* Effect.promise(() => Promise.resolve(app().request(`/api/oauth/google/callback?state=${encodeURIComponent(state)}`)))
      expect(noCode.status).toBe(200)
      expect(yield* Effect.promise(() => noCode.text())).toContain("No authorization code")
    }),
    30_000,
  )
})