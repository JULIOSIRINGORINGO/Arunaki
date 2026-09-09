// Engine API adapter — all requests go through Vite proxy /api → engine :4096

const ENGINE_BASE = "";

export async function engineFetch(path: string, init?: RequestInit) {
  const url = `${ENGINE_BASE}${path}`;
  return fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
}

// --- Session (maps to old "chat") ---

export async function createSession(opts?: {
  agent?: string;
  model?: { providerID: string; id: string } | string;
  directory?: string;
}) {
  let modelPayload: { providerID: string; id: string } | undefined;
  if (opts?.model) {
    if (typeof opts.model === "object") {
      let id = opts.model.id;
      if (id && id.includes(",")) {
        const parts = id.split(",").map((s) => s.trim()).filter(Boolean);
        id = parts.find((m) => m !== "mistral-large:free" && !m.includes("muse-spark")) || parts[0];
      }
      modelPayload = { providerID: opts.model.providerID, id };
    } else if (typeof opts.model === "string") {
      let clean = opts.model;
      if (clean.includes(",")) {
        const parts = clean.split(",").map((s) => s.trim()).filter(Boolean);
        clean = parts.find((m) => m !== "mistral-large:free" && !m.includes("muse-spark")) || parts[0];
      }
      if (clean.includes("/")) {
        const [providerID, id] = clean.split("/", 2);
        modelPayload = { providerID, id };
      } else {
        modelPayload = { providerID: "kenari", id: clean };
      }
    }
  }

  const query = opts?.directory ? `?directory=${encodeURIComponent(opts.directory)}` : "";
  const res = await engineFetch(`/api/session${query}`, {
    method: "POST",
    headers: {
      ...(opts?.directory && { "x-arunaki-directory": opts.directory }),
    },
    body: JSON.stringify({
      ...(opts?.agent && { agent: opts.agent }),
      ...(modelPayload && { model: modelPayload }),
      ...(opts?.directory && { location: { type: "directory", directory: opts.directory } }),
    }),
  });
  if (!res.ok) throw new Error(`createSession failed: ${res.status}`);
  const json = await res.json();
  return json.data;
}

export async function listSessions(opts?: { project?: string; limit?: number; directory?: string }) {
  const params = new URLSearchParams();
  if (opts?.project) params.set("project", opts.project);
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.directory) params.set("directory", opts.directory);
  const res = await engineFetch(`/api/session?${params}`, {
    headers: {
      ...(opts?.directory && { "x-arunaki-directory": opts.directory }),
    },
  });
  if (!res.ok) throw new Error(`listSessions failed: ${res.status}`);
  const json = await res.json();
  return json.data;
}

export async function getSession(sessionID: string) {
  const res = await engineFetch(`/api/session/${sessionID}`);
  if (!res.ok) throw new Error(`getSession failed: ${res.status}`);
  const json = await res.json();
  return json.data;
}

export async function switchSessionModel(sessionID: string, model: { providerID: string; id: string }) {
  let id = model.id;
  if (id && id.includes(",")) {
    const parts = id.split(",").map((s) => s.trim()).filter(Boolean);
    id = parts.find((m) => m !== "mistral-large:free" && !m.includes("muse-spark")) || parts[0];
  }
  const res = await engineFetch(`/api/session/${sessionID}/model`, {
    method: "POST",
    body: JSON.stringify({ model: { providerID: model.providerID, id } }),
  });
  return res.ok;
}

export async function getMessages(sessionID: string, opts?: { limit?: number; order?: "asc" | "desc" }) {
  const params = new URLSearchParams();
  params.set("order", opts?.order ?? "asc");
  if (opts?.limit) params.set("limit", String(opts.limit));
  const res = await engineFetch(`/api/session/${sessionID}/message?${params}`);
  if (!res.ok) throw new Error(`getMessages failed: ${res.status}`);
  const json = await res.json();
  return json.data;
}

// --- Prompt (send message) ---

export async function sendPrompt(sessionID: string, content: string, opts?: { variant?: string }) {
  const res = await engineFetch(`/api/session/${sessionID}/prompt`, {
    method: "POST",
    body: JSON.stringify({
      prompt: { type: "text", text: content },
      ...(opts?.variant ? { variant: opts.variant } : {}),
    }),
  });
  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(`sendPrompt failed: ${res.status} ${errorBody}`);
  }
  const json = await res.json();
  return json.data;
}

// --- SSE event stream with auto-reconnect ---

export function subscribeEvents(
  onEvent: (event: { type: string; data?: any }) => void,
  signal?: AbortSignal,
) {
  const controller = new AbortController();
  const finalSignal = signal
    ? (() => {
        const c = new AbortController();
        signal.addEventListener("abort", () => c.abort());
        controller.signal.addEventListener("abort", () => c.abort());
        return c.signal;
      })()
    : controller.signal;

  (async () => {
    while (!finalSignal.aborted) {
      try {
        const res = await fetch(`${ENGINE_BASE}/api/event`, {
          headers: { Accept: "text/event-stream" },
          signal: finalSignal,
        });
        const reader = res.body?.getReader();
        if (!reader) {
          if (!finalSignal.aborted) await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
        const decoder = new TextDecoder();
        let buffer = "";

        while (!finalSignal.aborted) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const event = JSON.parse(line.slice(6));
                onEvent(event);
              } catch {}
            }
          }
        }
      } catch {
        // SSE connection dropped or fetch failed
      }

      // If disconnected due to network drop and not explicitly aborted, wait and retry
      if (!finalSignal.aborted) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }
  })();

  return controller;
}

// --- Event mapping: engine events → old frontend format ---

export function mapEngineEvent(
  event: { type: string; data?: any; sessionID?: string; [key: string]: any },
  currentSessionID: string,
): { type: string; data?: any } | null {
  const payload = event.data || event.properties || event;
  const sessionID = payload.sessionID || event.sessionID;
  if (sessionID && sessionID !== currentSessionID) return null;

  switch (event.type) {
    case "session.next.text.delta":
      return { type: "text_delta", data: payload.delta || event.delta };
    case "session.next.text.ended":
      return { type: "text_end", data: payload.text };
    case "session.next.reasoning.started":
      return { type: "thinking", data: "Thinking..." };
    case "session.next.reasoning.delta":
      return { type: "reasoning_delta", data: payload.delta || event.delta };
    case "session.next.reasoning.ended":
      return { type: "reasoning_end", data: payload.text };
    case "session.next.step.started":
      return { type: "thinking", data: "Processing..." };
    case "session.next.step.ended":
      return { type: "done" };
    case "session.next.tool.input.started": {
      const toolName = payload.name || event.name || "action";
      return {
        type: "tool_preparing",
        data: {
          toolName,
          preview: `Preparing ${toolName}...`,
        },
      };
    }
    case "session.next.tool.called": {
      const toolName = payload.tool || event.tool || "action";
      const input = payload.input || event.input || {};
      const target =
        input.path ||
        input.TargetFile ||
        input.filePath ||
        input.targetFile ||
        input.pattern ||
        (typeof input.command === "string" ? input.command.slice(0, 40) : undefined);
      const filePreview = target && typeof target === "string" ? target.split(/[/\\]/).pop() : undefined;
      return {
        type: "tool_start",
        data: {
          toolName,
          args: input,
          preview: filePreview || (typeof target === "string" ? target : undefined),
        },
      };
    }
    case "session.next.tool.progress": {
      const toolName = payload.tool || event.tool || "action";
      return {
        type: "tool_progress",
        data: {
          toolName,
          preview: `Executing ${toolName}...`,
        },
      };
    }
    case "session.next.tool.success": {
      const toolName = payload.tool || event.tool || "action";
      return {
        type: "tool_live_status",
        data: {
          toolName,
          status: "completed",
          preview: `Completed ${toolName}`,
        },
      };
    }
    case "session.next.tool.failed": {
      const toolName = payload.tool || event.tool || "action";
      return {
        type: "tool_live_status",
        data: {
          toolName,
          status: "failed",
          preview: `Failed ${toolName}`,
        },
      };
    }
    case "session.next.step.failed":
      return {
        type: "error",
        data: {
          message: payload.error?.message || event.error?.message || "An error occurred while processing your request.",
        },
      };
    default:
      return null;
  }
}

// --- Provider (maps to old "providers") ---

export async function listProviders() {
  const res = await engineFetch("/api/provider");
  if (!res.ok) throw new Error(`listProviders failed: ${res.status}`);
  const json = await res.json();
  return json.data;
}

// --- Agent ---

export async function listAgents() {
  const res = await engineFetch("/api/agent");
  if (!res.ok) throw new Error(`listAgents failed: ${res.status}`);
  const json = await res.json();
  return json.data;
}

// --- Model ---

export async function listModels() {
  const res = await engineFetch("/api/model");
  if (!res.ok) throw new Error(`listModels failed: ${res.status}`);
  const json = await res.json();
  return json.data;
}
