import { QuestionV2 } from "@arunaki/core/question"
import { Effect } from "effect"
import { HttpApiBuilder, HttpApiSchema } from "effect/unstable/httpapi"
import { Api } from "../api"
import { QuestionNotFoundError } from "@arunaki/protocol/errors"
import { response } from "../location"

function missingRequest(id: QuestionV2.ID) {
  return new QuestionNotFoundError({ requestID: id, message: `Question request not found: ${id}` })
}

export const QuestionHandler = HttpApiBuilder.group(Api, "server.question", (handlers) =>
  Effect.gen(function* () {
    const withOwnedQuestion = Effect.fnUntraced(function* <A, E>(
      sessionID: QuestionV2.Request["sessionID"],
      requestID: QuestionV2.ID,
      use: (question: QuestionV2.Interface, request: QuestionV2.Request) => Effect.Effect<A, E>,
    ) {
      const question = yield* QuestionV2.Service
      const request = (yield* question.list()).find(
        (request) => request.id === requestID || request.tool?.callID === requestID,
      )
      if (!request || request.sessionID !== sessionID) return yield* missingRequest(requestID)
      return yield* use(question, request)
    })

    return handlers
      .handle(
        "question.request.list",
        Effect.fn(function* () {
          return yield* response((yield* QuestionV2.Service).list())
        }),
      )
      .handle(
        "session.question.list",
        Effect.fn(function* (ctx) {
          const requests = yield* (yield* QuestionV2.Service).list()
          return { data: requests.filter((request) => request.sessionID === ctx.params.sessionID) }
        }),
      )
      .handle(
        "session.question.reply",
        Effect.fn(function* (ctx) {
          yield* withOwnedQuestion(ctx.params.sessionID, ctx.params.requestID, (question, request) =>
            question
              .reply({ requestID: request.id, answers: ctx.payload.answers })
              .pipe(Effect.catchTag("QuestionV2.NotFoundError", () => missingRequest(ctx.params.requestID))),
          )
          return HttpApiSchema.NoContent.make()
        }),
      )
      .handle(
        "session.question.reject",
        Effect.fn(function* (ctx) {
          yield* withOwnedQuestion(ctx.params.sessionID, ctx.params.requestID, (question, request) =>
            question
              .reject(request.id)
              .pipe(Effect.catchTag("QuestionV2.NotFoundError", () => missingRequest(ctx.params.requestID))),
          )
          return HttpApiSchema.NoContent.make()
        }),
      )
  }),
)
