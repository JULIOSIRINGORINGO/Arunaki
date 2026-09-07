import { Message } from "./types";

export function mapEngineMessages(raw: any[]): Message[] {
  if (!Array.isArray(raw)) return [];

  const individualMessages: Message[] = raw.map((msg, idx) => {
    const role: "user" | "assistant" = msg.type === "user" || msg.role === "user" ? "user" : "assistant";
    let content = "";
    let reasoning = "";
    let executionSteps: any[] | undefined = undefined;
    let thoughtSec: number | undefined = undefined;

    // 1. Text & reasoning from msg.content / msg.text
    if (typeof msg.content === "string") {
      content = msg.content;
    } else if (typeof msg.text === "string") {
      content = msg.text;
    } else if (Array.isArray(msg.content)) {
      const reasoningParts = msg.content.filter((p: any) => p && p.type === "reasoning");
      if (reasoningParts.length > 0) {
        reasoning = reasoningParts
          .map((p: any) => (p && typeof p.text === "string" ? p.text : ""))
          .filter(Boolean)
          .join("\n\n");
      }

      const textParts = msg.content.filter((p: any) => p && p.type === "text" && typeof p.text === "string");
      content = textParts.map((p: any) => p.text).join("");

      const toolParts = msg.content.filter((p: any) => p && (p.type === "tool" || p.type === "tool-invocation"));
      if (toolParts.length > 0) {
        executionSteps = toolParts.map((t: any, i: number) => {
          const toolName = t.name || t.tool || t.toolInvocation?.toolName || "action";
          const input = t.state?.input || t.input || t.args || t.toolInvocation?.args || {};
          const target =
            input.path ||
            input.TargetFile ||
            input.filePath ||
            input.targetFile ||
            input.pattern ||
            (typeof input.command === "string" ? input.command.slice(0, 40) : undefined);
          const filePreview = target && typeof target === "string" ? target.split(/[/\\]/).pop() : undefined;
          const label = filePreview ? `Executed: ${toolName} → ${filePreview}` : `Executed: ${toolName}`;
          return {
            id: t.id || `tool-${idx}-${i}`,
            label,
            status: "completed",
            iconType: "tool",
            toolName,
          };
        });
      }
    }

    // 2. Text & reasoning from msg.parts
    if (Array.isArray(msg.parts)) {
      const reasoningParts = msg.parts.filter((p: any) => p && p.type === "reasoning");
      if (reasoningParts.length > 0) {
        reasoning = reasoningParts
          .map((p: any) => (p && typeof p.text === "string" ? p.text : ""))
          .filter(Boolean)
          .join("\n\n");
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

      const toolInvocations = msg.parts.filter((p: any) => p && (p.type === "tool" || p.type === "tool-invocation"));
      if (toolInvocations.length > 0) {
        executionSteps = toolInvocations.map((t: any, i: number) => {
          const toolName = t.name || t.tool || t.toolInvocation?.toolName || "action";
          const input = t.state?.input || t.input || t.args || t.toolInvocation?.args || {};
          const target =
            input.path ||
            input.TargetFile ||
            input.filePath ||
            input.targetFile ||
            input.pattern ||
            (typeof input.command === "string" ? input.command.slice(0, 40) : undefined);
          const filePreview = target && typeof target === "string" ? target.split(/[/\\]/).pop() : undefined;
          const label = filePreview ? `Executed: ${toolName} → ${filePreview}` : `Executed: ${toolName}`;
          return {
            id: t.id || `tool-${idx}-${i}`,
            label,
            status: "completed",
            iconType: "tool",
            toolName,
          };
        });
      }

      const textParts = msg.parts.filter((p: any) => p && p.type === "text" && typeof p.text === "string");
      content = textParts.map((p: any) => p.text).join("");
    }

    if (!content && msg.error?.message) {
      content = `⚠️ ${msg.error.message}`;
    }

    content = content.trim();

    return {
      id: msg.id || `${role}-${idx}-${Date.now()}`,
      role,
      content,
      reasoning: reasoning.trim() || undefined,
      executionSteps: executionSteps || undefined,
      thoughtSec: thoughtSec,
      createdAt: msg.createdAt || msg.time?.created || (msg.time?.start ? msg.time.start : undefined),
    };
  });

  // Group consecutive assistant messages belonging to the same turn
  const mergedMessages: Message[] = [];
  for (const m of individualMessages) {
    const last = mergedMessages[mergedMessages.length - 1];
    if (last && last.role === "assistant" && m.role === "assistant") {
      if (m.content) {
        last.content = last.content ? `${last.content}\n\n${m.content}` : m.content;
      }
      if (m.reasoning) {
        if (!last.reasoning) {
          last.reasoning = m.reasoning;
        } else {
          const existingParas = new Set(
            last.reasoning
              .split(/\n\s*\n/)
              .map((p) => p.trim())
              .filter(Boolean)
          );
          const newParas = m.reasoning
            .split(/\n\s*\n/)
            .map((p) => p.trim())
            .filter((p) => p && !existingParas.has(p));
          if (newParas.length > 0) {
            last.reasoning = `${last.reasoning}\n\n${newParas.join("\n\n")}`;
          }
        }
      }
      if (m.executionSteps) {
        const existingLabels = new Set((last.executionSteps || []).map((s) => s.label));
        const newSteps = m.executionSteps.filter((s) => !existingLabels.has(s.label));
        last.executionSteps = [...(last.executionSteps || []), ...newSteps];
      }
      if (m.thoughtSec) {
        last.thoughtSec = (last.thoughtSec || 0) + m.thoughtSec;
      }
      if (m.createdAt) {
        last.createdAt = m.createdAt;
      }
      last.id = m.id;
    } else {
      mergedMessages.push({ ...m });
    }
  }

  return mergedMessages;
}

