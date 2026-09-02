import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiError, HttpApiGroup, OpenApi } from "effect/unstable/httpapi"
import { described } from "./metadata"

const uiRoot = "/api/oauth"

export const OAuthProvider = Schema.Union([Schema.Literal("google"), Schema.Literal("github")])

export class OAuthApiError extends Schema.ErrorClass<OAuthApiError>("OAuthError")(
  {
    name: Schema.Literal("BadRequest"),
    data: Schema.Struct({
      message: Schema.String,
    }),
  },
  { httpApiStatus: 400 },
) {}

export const OAuthStartResult = Schema.Struct({
  url: Schema.String,
  state: Schema.String,
})

export const OAuthResult = Schema.Struct({
  pending: Schema.Boolean,
  email: Schema.String,
  name: Schema.String,
  avatar: Schema.String,
})

export const OAuthApi = HttpApi.make("oauth").add(
  HttpApiGroup.make("oauth")
    .add(
      HttpApiEndpoint.get("start", `${uiRoot}/:provider/start`, {
        params: { provider: OAuthProvider },
        success: described(OAuthStartResult, "OAuth authorize URL"),
        error: OAuthApiError,
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "oauth.start",
          summary: "Start OAuth login",
          description: "Return the provider authorize URL (popup target) for Google/GitHub sign-in.",
        }),
      ),
      HttpApiEndpoint.get("callback", `${uiRoot}/:provider/callback`, {
        params: { provider: OAuthProvider },
        success: described(OAuthResult, "OAuth callback result"),
        error: HttpApiError.BadRequest,
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "oauth.callback",
          summary: "OAuth callback",
          description: "Exchange the authorization code, fetch the profile, and show a branded result page.",
        }),
      ),
      HttpApiEndpoint.get("result", `${uiRoot}/:provider/result`, {
        params: { provider: OAuthProvider },
        query: { state: Schema.String },
        success: described(OAuthResult, "OAuth result"),
        error: HttpApiError.BadRequest,
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "oauth.result",
          summary: "Poll OAuth result",
          description: "Poll the completed sign-in profile for a state started via oauth.start.",
        }),
      ),
    )
    .annotateMerge(
      OpenApi.annotations({
        title: "oauth",
        description: "OAuth login routes for the settings UI (Google, GitHub).",
      }),
    ),
)