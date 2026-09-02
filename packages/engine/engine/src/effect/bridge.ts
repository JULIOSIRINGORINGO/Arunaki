import { Context, Effect, Exit, Fiber } from "effect"
import { InstanceRef, WorkspaceRef } from "./instance-ref"
import { attachWith } from "./run-service"

export interface Shape {
  readonly promise: <A, E, R>(effect: Effect.Effect<A, E, R>) => Promise<A>
  readonly fork: <A, E, R>(effect: Effect.Effect<A, E, R>) => Fiber.Fiber<A, E>
  readonly run: <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E>
  readonly bind: <Args extends readonly unknown[], Result>(fn: (...args: Args) => Result) => (...args: Args) => Result
}

function captureSync() {
  const fiber = Fiber.getCurrent()
  const instance = fiber ? Context.getReferenceUnsafe(fiber.context, InstanceRef) : undefined
  const workspace = fiber ? Context.getReferenceUnsafe(fiber.context, WorkspaceRef) : undefined
  return { instance, workspace }
}

export const bind = <Args extends readonly unknown[], Result>(fn: (...args: Args) => Result) => {
  const captured = captureSync()
  return (...args: Args) =>
    Effect.runSync(
      attachWith(
        Effect.sync(() => fn(...args)),
        captured,
      ),
    )
}

/**
 * Bridge from Effect into a Promise-returning JS callback while preserving
 * `WorkspaceRef` for effects run through the returned bridge APIs. `InstanceRef`
 * is captured for effects run through the returned bridge APIs; plain JS
 * callbacks that need it should receive the ref explicitly.
 *
 * Mirrors `Effect.promise`.
 */
export const fromPromise = <T>(fn: () => Promise<T> | T): Effect.Effect<T> =>
  Effect.gen(function* () {
    const workspace = yield* WorkspaceRef
    return yield* Effect.promise(() => Promise.resolve(fn()))
  })

export function make(): Effect.Effect<Shape> {
  return Effect.gen(function* () {
    const ctx = yield* Effect.context()
    const captured = captureSync()
    const instance = (yield* InstanceRef) ?? captured.instance
    const workspace = (yield* WorkspaceRef) ?? captured.workspace
    const wrap = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
      attachWith(effect.pipe(Effect.provide(ctx)) as Effect.Effect<A, E, never>, { instance, workspace })

    return {
      promise: <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.runPromise(wrap(effect)),
      fork: <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.runFork(wrap(effect)),
      run: <A, E, R>(effect: Effect.Effect<A, E, R>) =>
        Effect.callback<A, E>((resume) => {
          Effect.runPromiseExit(wrap(effect)).then((exit) =>
            resume(Exit.isSuccess(exit) ? Effect.succeed(exit.value) : Effect.failCause(exit.cause)),
          )
        }),
      bind:
        <Args extends readonly unknown[], Result>(fn: (...args: Args) => Result) =>
        (...args: Args) =>
          Effect.runSync(wrap(Effect.sync(() => fn(...args)))),
    } satisfies Shape
  })
}

export * as EffectBridge from "./bridge"
