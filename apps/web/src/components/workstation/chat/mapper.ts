import { Message } from "./types";

export function mapEngineMessages(raw: any[]): Message[] {
  return raw.map((msg, idx) => {
    const role: "user" | "assistant" = msg.type === "user" || msg.role === "user" ? "user" : "assistant";
    let content = "";
    let reasoning = "";

    if (typeof msg.content === "string") {
      content = msg.content;
    } else if (typeof msg.text === "string") {
      content = msg.text;
    } else if (Array.isArray(msg.content)) {
      const reasoningParts = msg.content.filter((p: any) => p && p.type === "reasoning");
      if (reasoningParts.length > 0) {
        reasoning = reasoningParts.map((p: any) => (p && typeof p.text === "string" ? p.text : "")).join("\n\n");
      }
      const textParts = msg.content.filter((p: any) => p && p.type !== "reasoning");
      content = (textParts.length > 0 ? textParts : msg.content)
        .filter((p: any) => p && p.type !== "reasoning")
        .map((p: any) => (p && typeof p.text === "string" ? p.text : ""))
        .join("");
    }
    let executionSteps: any[] | undefined = undefined;
    let thoughtSec: number | undefined = undefined;
    
    if (Array.isArray(msg.parts)) {
      const reasoningParts = msg.parts.filter((p: any) => p && p.type === "reasoning");
      if (reasoningParts.length > 0) {
        reasoning = reasoningParts.map((p: any) => (p && typeof p.text === "string" ? p.text : "")).join("\n\n");
        let totalReasoningTime = 0;
        reasoningParts.forEach((p: any) => {
          if (p.time?.created && p.time?.completed) {
            totalReasoningTime += (p.time.completed - p.time.created);
          } else if (p.time?.created && msg.time?.updated) {
            totalReasoningTime += (msg.time.updated - p.time.created);
          }
        });
        if (totalReasoningTime > 0) {
          thoughtSec = Math.max(1, Math.round(totalReasoningTime / 1000));
        }
      }
      
      const toolInvocations = msg.parts.filter((p: any) => p && p.type === "tool-invocation");
      if (toolInvocations.length > 0) {
        executionSteps = toolInvocations.map((t: any, i: number) => ({
          id: `tool-${idx}-${i}`,
          label: `Executed: ${t.toolInvocation?.toolName || "tool"}`,
          status: "completed",
          iconType: "tool",
        }));
      }

      const textParts = msg.parts.filter((p: any) => p && p.type !== "reasoning" && p.type !== "tool-invocation");
      content = (textParts.length > 0 ? textParts : msg.parts)
        .filter((p: any) => p && p.type !== "reasoning" && p.type !== "tool-invocation")
        .map((p: any) => (p && typeof p.text === "string" ? p.text : ""))
        .join("");
    }
    if (!content && msg.error?.message) {
      content = `⚠️ ${msg.error.message}`;
    }
    return {
      id: msg.id || `${role}-${idx}-${Date.now()}`,
      role,
      content,
      reasoning: reasoning || undefined,
      executionSteps: executionSteps || undefined,
      thoughtSec: thoughtSec,
      createdAt: msg.createdAt || msg.time?.created || undefined,
    };
  });
}
