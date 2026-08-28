import { NodeHttpServer, NodeServices } from "@effect/platform-node"
import { describe, expect } from "bun:test"
import { Effect, Fiber, Layer, Schema } from "effect"
import { HttpClient, HttpClientRequest, HttpRouter } from "effect/unstable/http"
import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import path from "node:path"
import { WorkspaceV2 } from "@arunaki/core/workspace"
import { InstanceRef, WorkspaceRef } from "../../src/effect/instance-ref"
import { Project } from "../../src/project/project"
import { Session } from "../../src/session/session"
import { disposeMiddleware, markInstanceForDisposal } from "../../src/server/routes/instance/httpapi/lifecycle"
import {
  InstanceContextMiddleware,
  instanceContextLayer,
} from "../../src/server/routes/instance/httpapi/middleware/instance-context"
import {
  WorkspaceRoutingMiddleware,
  WorkspaceRoutingQuery,
  workspaceRoutingLayer,
} from "../../src/server/routes/instance/httpapi/middleware/workspace-routing"
import { resetDatabase } from "../fixture/db"
import { disposeAllInstances, tmpdirScoped } from "../fixture/fixture"
import { withFixedWorkspaceID } from "../fixture/flag"
import { workspaceLayerWithRuntimeFlags } from "../fixture/workspace"
import { waitGlobalBusEvent } from "./global-bus"
import { testEffect } from "../lib/effect"

const testStateLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    yield* Effect.promise(() => resetDatabase())
    yield* Effect.addFinalizer(() =>
      Effect.promise(async () => {
        await disposeAllInstances()
        await resetDatabase()
      }),
    )
  }),
)

const workspaceLayer = workspaceLayerWithRuntimeFlags({ experimentalWorkspaces: true })

const it = testEffect(Layer.mergeAll(testStateLayer, NodeHttpServer.layerTest, NodeServices.layer, workspaceLayer))

const instanceContextTestLayer = Layer.mergeAll(instanceContextLayer, workspaceRoutingLayer)

const probeInstanceContext = Effect.gen(function* () {
  const instance = yield* InstanceRef
  const workspaceID = yield* WorkspaceRef
  return {
    directory: instance?.directory,
    worktree: instance?.worktree,
    projectID: instance?.project.id,
    workspaceID,
  }
})

const ProbeResult = Schema.Struct({
  directory: Schema.optional(Schema.String),
  worktree: Schema.optional(Schema.String),
  projectID: Schema.optional(Schema.String),
  workspaceID: Schema.optional(Schema.String),
})

const ProbeApi = HttpApi.make("instance-context-probe").add(
  HttpApiGroup.make("probe")
    .add(
      HttpApiEndpoint.get("get", "/probe", { query: WorkspaceRoutingQuery, success: ProbeResult }),
      HttpApiEndpoint.get("session", "/session", { query: WorkspaceRoutingQuery, success: ProbeResult }),
      HttpApiEndpoint.post("dispose", "/dispose-probe", {
        query: WorkspaceRoutingQuery,
        success: Schema.Boolean,
      }),
    )
    .middleware(InstanceContextMiddleware)
    .middleware(WorkspaceRoutingMiddleware),
)

const probeHandlers = HttpApiBuilder.group(ProbeApi, "probe", (handlers) =>
  handlers
    .handle("get", () => probeInstanceContext)
    .handle("session", () => probeInstanceContext)
    .handle(
      "dispose",
      Effect.fn("InstanceContextProbe.dispose")(function* () {
        const instance = yield* InstanceRef
        if (!instance) return false
        yield* markInstanceForDisposal(instance)
        return true
      }),
    ),
)

const probeRoutes = HttpApiBuilder.layer(ProbeApi).pipe(
  Layer.provide(probeHandlers),
  Layer.provide(instanceContextTestLayer),
  Layer.provide(Layer.mock(Session.Service)({})),
)

const serveProbe = () => probeRoutes.pipe(HttpRouter.serve, Layer.build)

const waitDisposedEvent = waitGlobalBusEvent({
  message: "timed out waiting for instance disposal",
  predicate: (event) => event.payload.type === "server.instance.disposed",
}).pipe(Effect.map((event) => ({ directory: event.directory, workspace: event.workspace })))

const serveDisposeProbe = () =>
  HttpRouter.serve(probeRoutes, { middleware: disposeMiddleware, disableListenLog: true, disableLogger: true }).pipe(
    Layer.build,
  )

describe("HttpApi instance context middleware", () => {
  it.live("provides instance context from the routed directory", () =>
    Effect.gen(function* () {
      const dir = yield* tmpdirScoped({ git: true })
      const project = yield* Project.use.fromDirectory(dir)
      yield* serveProbe()

      const response = yield* HttpClient.get(`/probe?directory=${encodeURIComponent(dir)}`)

      expect(response.status).toBe(200)
      expect(yield* response.json).toEqual({
        directory: dir,
        worktree: dir,
        projectID: project.project.id,
        workspaceID: null,
      })
    }),
  )

  it.live("persists the routed project while loading instance context", () =>
    Effect.gen(function* () {
      const dir = yield* tmpdirScoped({ git: true })
      const project = yield* Project.Service
      yield* serveProbe()

      const response = yield* HttpClient.get(`/probe?directory=${encodeURIComponent(dir)}`)

      expect(response.status).toBe(200)
      const saved = (yield* project.list()).find((item) => item.worktree === dir)
      expect(saved).toBeDefined()
      expect(saved?.id).not.toBe("global")
    }),
  )

  it.live("falls back to the raw directory when URI decoding fails", () =>
    Effect.gen(function* () {
      yield* serveProbe()

      const response = yield* HttpClient.get("/probe?directory=%25E0%25A4%25A")

      expect(response.status).toBe(200)
      expect(yield* response.json).toMatchObject({
        directory: path.join(process.cwd(), "%E0%A4%A"),
      })
    }),
  )

  it.live("provides selected workspace id on control-plane routes", () =>
    Effect.gen(function* () {
      const dir = yield* tmpdirScoped({ git: true })
      yield* Project.use.fromDirectory(dir)
      const workspaceID = WorkspaceV2.ID.ascending()
      yield* serveProbe()

      const response = yield* HttpClientRequest.get(
        `/session?workspace=${workspaceID}&directory=${encodeURIComponent(dir)}`,
      ).pipe(
        HttpClientRequest.setHeader("x-Arunaki-directory", dir),
        HttpClient.execute,
      )

      expect(response.status).toBe(200)
      expect(yield* response.json).toMatchObject({
        directory: dir,
        workspaceID,
      })
    }),
  )

  it.live("uses configured workspace id instead of the requested workspace", () =>
    Effect.gen(function* () {
      const fixedWorkspaceID = WorkspaceV2.ID.ascending()
      yield* withFixedWorkspaceID(fixedWorkspaceID)

      const dir = yield* tmpdirScoped({ git: true })
      yield* Project.use.fromDirectory(dir)
      yield* serveProbe()

      const response = yield* HttpClientRequest.get(
        `/probe?workspace=${WorkspaceV2.ID.ascending()}&directory=${encodeURIComponent(dir)}`,
      ).pipe(
        HttpClientRequest.setHeader("x-Arunaki-directory", dir),
        HttpClient.execute,
      )

      expect(response.status).toBe(200)
      expect(yield* response.json).toMatchObject({
        directory: dir,
        workspaceID: fixedWorkspaceID,
      })
    }),
  )

  it.live("falls through to local with the configured workspace id when one is set", () =>
    Effect.gen(function* () {
      const fixedWorkspaceID = WorkspaceV2.ID.ascending()
      yield* withFixedWorkspaceID(fixedWorkspaceID)

      const dir = yield* tmpdirScoped({ git: true })
      yield* Project.use.fromDirectory(dir)
      yield* serveProbe()

      // With the env override set, any requested workspace id is ignored and
      // the request falls through to Local with the configured workspace id.
      const unknownWorkspaceID = WorkspaceV2.ID.ascending()
      const response = yield* HttpClientRequest.get(
        `/probe?workspace=${unknownWorkspaceID}&directory=${encodeURIComponent(dir)}`,
      ).pipe(
        HttpClientRequest.setHeader("x-Arunaki-directory", dir),
        HttpClient.execute,
      )

      expect(response.status).toBe(200)
      expect(yield* response.json).toMatchObject({
        directory: dir,
        workspaceID: fixedWorkspaceID,
      })
    }),
  )

  it.live("preserves selected workspace id on instance disposal events", () =>
    Effect.gen(function* () {
      const dir = yield* tmpdirScoped({ git: true })
      yield* Project.use.fromDirectory(dir)
      const workspaceID = WorkspaceV2.ID.ascending()
      yield* serveDisposeProbe()
      const disposed = yield* waitDisposedEvent.pipe(Effect.forkScoped({ startImmediately: true }))

      const response = yield* HttpClientRequest.post(
        `/dispose-probe?workspace=${workspaceID}&directory=${encodeURIComponent(dir)}`,
      ).pipe(
        HttpClientRequest.setHeader("x-Arunaki-directory", dir),
        HttpClient.execute,
      )

      expect(response.status).toBe(200)
      expect(yield* response.json).toBe(true)
      expect(yield* Fiber.join(disposed)).toEqual({ directory: dir, workspace: workspaceID })
    }),
  )
})