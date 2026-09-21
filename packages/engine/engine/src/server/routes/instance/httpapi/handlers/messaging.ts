import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { InstanceHttpApi } from "../api";
import { telegramService } from "@/messaging/telegram";
import type { MessagingConfig } from "@/messaging/telegram";

export const messagingHandlers = HttpApiBuilder.group(InstanceHttpApi, "messaging", (handlers) =>
  Effect.gen(function* () {
    const getConfig = Effect.fn("MessagingHttpApi.getConfig")(function* () {
      return yield* Effect.promise(() => telegramService.getConfig());
    });

    const updateConfig = Effect.fn("MessagingHttpApi.updateConfig")(function* (ctx: {
      payload: MessagingConfig;
    }) {
      return yield* Effect.promise(() => telegramService.saveConfig(ctx.payload));
    });

    const getStatus = Effect.fn("MessagingHttpApi.getStatus")(function* () {
      return telegramService.getStatus();
    });

    const testConnection = Effect.fn("MessagingHttpApi.testConnection")(function* (ctx: {
      payload: { botToken: string };
    }) {
      return yield* Effect.promise(() => telegramService.testToken(ctx.payload.botToken));
    });

    return handlers
      .handle("getConfig", getConfig)
      .handle("updateConfig", updateConfig)
      .handle("getStatus", getStatus)
      .handle("testConnection", testConnection);
  })
);
