// Engine API adapter — maps old /api/v1/* calls to new engine /api/* endpoints
// The engine runs on a configurable port (default 4096)

const ENGINE_BASE = import.meta.env.VITE_ARUNAKI_ENGINE_URL || "http://127.0.0.1:4096";

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

export async function createSession(opts?: { agent?: string; model?: string; directory?: string }) {
  const res = await engineFetch("/api/session", {
    method: "POST",
    body: JSON.stringify({
      ...(opts?.agent && { agent: opts.agent }),
      ...(opts?.model && { model: opts.model }),
      ...(opts?.directory && { location: { type: "directory", directory: opts.directory } }),
    }),
  });
  if (!res.ok) throw new Error(`createSession failed: ${res.status}`);
  const json = await res.json();
  return json.data;
}

export async function listSessions(opts?: { project?: string; limit?: number }) {
  const params = new URLSearchParams();
  if (opts?.project) params.set("project", opts.project);
  if (opts?.limit) params.set("limit", String(opts.limit));
  const res = await engineFetch(`/api/session?${params}`);
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

export async function getMessages(sessionID: string, opts?: { limit?: number }) {
  const params = new URLSearchParams();
  if (opts?.limit) params.set("limit", String(opts.limit));
  const res = await engineFetch(`/api/session/${sessionID}/message?${params}`);
  if (!res.ok) throw new Error(`getMessages failed: ${res.status}`);
  const json = await res.json();
  return json.data;
}

// --- Prompt (send message) ---

export async function sendPrompt(sessionID: string, content: string) {
  const res = await engineFetch(`/api/session/${sessionID}/prompt`, {
    method: "POST",
    body: JSON.stringify({
      prompt: { type: "text", text: content },
    }),
  });
  if (!res.ok) throw new Error(`sendPrompt failed: ${res.status}`);
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

  fetch(`${ENGINE_BASE}/api/event`, {
    headers: { Accept: "text/event-stream" },
    signal: finalSignal,
  }).then(async (res) => {
    const reader = res.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
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
  }).catch(() => {});

  return controller;
}

// --- Event mapping: engine events → old frontend format ---

export function mapEngineEvent(
  event: { type: string; data?: any; sessionID?: string; [key: string]: any },
  currentSessionID: string,
): { type: string; data?: any } | null {
  if (event.sessionID && event.sessionID !== currentSessionID) return null;

  switch (event.type) {
    case "session.next.text.delta":
      return { type: "text_delta", data: event.delta };
    case "session.next.text.ended":
      return { type: "done" };
    case "session.next.reasoning.delta":
      return { type: "thinking", data: event.delta };
    case "session.next.tool.called":
      return {
        type: "tool_start",
        data: { toolName: event.tool, args: event.input },
      };
    case "session.next.tool.success":
      return {
        type: "tool_live_status",
        data: { toolName: event.tool, status: "completed" },
      };
    case "session.next.tool.failed":
      return {
        type: "tool_live_status",
        data: { toolName: event.tool, status: "failed" },
      };
    case "session.next.step.started":
      return { type: "thinking", data: "Processing..." };
    case "session.next.step.ended":
      return null;
    case "session.next.tool.input.started":
      return { type: "thinking", data: `Preparing ${event.name || "tool"}...` };
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
