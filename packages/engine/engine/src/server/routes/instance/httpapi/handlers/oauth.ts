import { randomUUID } from "node:crypto"
import { OauthCallbackPage } from "@arunaki/core/oauth/page"

import { Duration, Effect, Exit, Schema } from "effect"
import { HttpClient, HttpClientRequest, HttpServerRequest, HttpServerResponse } from "effect/unstable/http"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { InstanceHttpApi } from "../api"
import { OAuthApiError, OAuthProvider } from "../groups/oauth"

// ponytail: in-memory state store, single process. If the engine is ever
// clustered, move to the SQLite `account` table or a signed cookie.
const pendingLogins = new Map<string, PendingLogin>()
const PENDING_TTL_MS = 10 * 60_000

interface PendingLogin {
  provider: "google" | "github"
  expiresAt: number
  profile?: { email: string; name: string; avatar: string }
}

const REDIRECT_BASE = process.env.ARUNAKI_OAUTH_REDIRECT_BASE ?? "http://127.0.0.1:4096"

function credential(provider: "google" | "github") {
  const prefix = `ARUNAKI_${provider.toUpperCase()}_CLIENT`
  return { id: process.env[`${prefix}_ID`] ?? "", secret: process.env[`${prefix}_SECRET`] ?? "" }
}

function callbackURL(provider: "google" | "github") {
  return `${REDIRECT_BASE}/api/oauth/${provider}/callback`
}

function authorizeURL(provider: "google" | "github", creds: { id: string; secret: string }, state: string) {
  const url =
    provider === "google"
      ? new URL("https://accounts.google.com/o/oauth2/v2/auth")
      : new URL("https://github.com/login/oauth/authorize")
  url.searchParams.set("client_id", creds.id)
  url.searchParams.set("redirect_uri", callbackURL(provider))
  url.searchParams.set("state", state)
  if (provider === "google") {
    url.searchParams.set("response_type", "code")
    url.searchParams.set("scope", "openid email profile")
  } else {
    url.searchParams.set("scope", "read:user user:email")
  }
  return url.href
}

function newState(provider: "google" | "github") {
  for (const [state, entry] of pendingLogins) {
    if (entry.expiresAt < Date.now()) pendingLogins.delete(state)
  }
  const state = randomUUID()
  pendingLogins.set(state, { provider, expiresAt: Date.now() + PENDING_TTL_MS })
  return state
}

function exchangeToken(http: HttpClient.HttpClient, provider: "google" | "github", creds: { id: string; secret: string }, code: string) {
  const endpoint =
    provider === "google"
      ? "https://oauth2.googleapis.com/token"
      : "https://github.com/login/oauth/access_token"
  const params = new URLSearchParams({ client_id: creds.id, client_secret: creds.secret, code, redirect_uri: callbackURL(provider) })
  if (provider === "google") params.set("grant_type", "authorization_code")

  return Effect.gen(function* () {
    const request = HttpClientRequest.post(endpoint).pipe(
      HttpClientRequest.setHeaders({ accept: "application/json" }),
      HttpClientRequest.bodyText(params.toString(), "application/x-www-form-urlencoded"),
    )
    const response = yield* http.execute(request).pipe(Effect.timeout(Duration.seconds(20)))
    if (response.status < 200 || response.status >= 300) {
      return yield* Effect.fail(new Error(`Token exchange failed (HTTP ${response.status})`))
    }
    const json = yield* response.json.pipe(Effect.orDie)
    const token = (json as { access_token?: unknown }).access_token
    if (typeof token !== "string" || token.length === 0) {
      return yield* Effect.fail(new Error("No access token in provider response"))
    }
    return token
  })
}

function fetchGithubEmail(http: HttpClient.HttpClient, token: string) {
  return Effect.gen(function* () {
    const response = yield* http
      .execute(
        HttpClientRequest.get("https://api.github.com/user/emails").pipe(
          HttpClientRequest.setHeaders({ authorization: `Bearer ${token}`, accept: "application/vnd.github+json" }),
        ),
      )
      .pipe(Effect.timeout(Duration.seconds(20)))
    const json = yield* response.json.pipe(Effect.orDie)
    const list = json as Array<{ email?: string; primary?: boolean }>
    const primary = list.find((item) => item.primary === true) ?? list[0]
    return typeof primary?.email === "string" ? primary.email : ""
  })
}

function fetchProfile(http: HttpClient.HttpClient, provider: "google" | "github", token: string) {
  return Effect.gen(function* () {
    if (provider === "google") {
      const response = yield* http
        .execute(HttpClientRequest.get("https://www.googleapis.com/oauth2/v3/userinfo").pipe(HttpClientRequest.bearerToken(token)))
        .pipe(Effect.timeout(Duration.seconds(20)))
      const json = yield* response.json.pipe(Effect.orDie)
      const data = json as { email?: string; name?: string; picture?: string }
      return { email: data.email ?? "", name: data.name ?? "", avatar: data.picture ?? "" }
    }

    const response = yield* http
      .execute(
        HttpClientRequest.get("https://api.github.com/user").pipe(
          HttpClientRequest.setHeaders({ authorization: `Bearer ${token}`, accept: "application/vnd.github+json" }),
        ),
      )
      .pipe(Effect.timeout(Duration.seconds(20)))
    const json = yield* response.json.pipe(Effect.orDie)
    const data = json as { name?: string; login?: string; email?: string | null; avatar_url?: string }
    const email = typeof data.email === "string" && data.email ? data.email : yield* fetchGithubEmail(http, token)
    return { email, name: data.name || data.login || "", avatar: data.avatar_url ?? "" }
  })
}

function htmlResponse(html: string) {
  return HttpServerResponse.raw(new TextEncoder().encode(html), { headers: { "content-type": "text/html; charset=utf-8" } })
}

export const oauthHandlers = HttpApiBuilder.group(InstanceHttpApi, "oauth", (handlers) =>
  Effect.gen(function* () {
    const http = yield* HttpClient.HttpClient

    const start = Effect.fn("OAuth.start")(function* (ctx: { params: { provider: Schema.Schema.Type<typeof OAuthProvider> } }) {
      const provider = ctx.params.provider
      const creds = credential(provider)
      if (!creds.id || !creds.secret) {
        return yield* Effect.fail(
          new OAuthApiError({
            name: "BadRequest",
            data: { message: `"${provider}" sign-in is not configured. Set ARUNAKI_${provider.toUpperCase()}_CLIENT_ID and ARUNAKI_${provider.toUpperCase()}_CLIENT_SECRET in the engine environment.` },
          }),
        )
      }
      const state = newState(provider)
      return { url: authorizeURL(provider, creds, state), state }
    })

    const result = Effect.fn("OAuth.result")(function* (ctx: { params: { provider: Schema.Schema.Type<typeof OAuthProvider> }; query: { state: string } }) {
      const entry = pendingLogins.get(ctx.query.state)
      if (!entry || entry.provider !== ctx.params.provider || entry.expiresAt < Date.now() || !entry.profile) {
        return { pending: true, email: "", name: "", avatar: "" }
      }
      return { pending: false, ...entry.profile }
    })

    const callback = Effect.fn("OAuth.callback")(function* (ctx: {
      request: HttpServerRequest.HttpServerRequest
      params: { provider: Schema.Schema.Type<typeof OAuthProvider> }
    }) {
      const provider = ctx.params.provider
      const url = new URL(ctx.request.url, "http://localhost")
      const code = url.searchParams.get("code")
      const state = url.searchParams.get("state")
      const error = url.searchParams.get("error")
      const errorDescription = url.searchParams.get("error_description")
      const creds = credential(provider)

      const fail = (message: string) => htmlResponse(OauthCallbackPage.error(message, { provider }))

      if (!state) return fail("Missing required state parameter - possible CSRF attack.")
      if (error) return fail(errorDescription || error)
      const entry = pendingLogins.get(state)
      if (!entry || entry.provider !== provider || entry.expiresAt < Date.now()) {
        return fail("Invalid or expired state parameter - possible CSRF attack.")
      }
      if (!code) return fail("No authorization code provided.")
      if (!creds.id || !creds.secret) return fail("OAuth client credentials are not configured on the engine.")

      const login = Effect.gen(function* () {
        const token = yield* exchangeToken(http, provider, creds, code)
        const profile = yield* fetchProfile(http, provider, token)
        return profile
      }).pipe(Effect.timeout(Duration.seconds(30)), Effect.exit)
      const outcome = yield* login
      if (Exit.isFailure(outcome)) {
        return fail(`${String(outcome.cause)}`)
      }
      entry.profile = outcome.value
      return htmlResponse(OauthCallbackPage.success({ provider }))
    })

    return handlers
      .handle("start", start)
      .handleRaw("callback", callback)
      .handle("result", result)
  }),
)