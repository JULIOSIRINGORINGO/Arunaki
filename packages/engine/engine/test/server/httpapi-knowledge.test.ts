import { afterEach, describe, expect, test } from "bun:test"
import { Context } from "effect"
import path from "path"
import { HttpApiApp } from "../../src/server/routes/instance/httpapi/server"
import { resetDatabase } from "../fixture/db"
import { disposeAllInstances, tmpdir } from "../fixture/fixture"

const context = Context.empty() as Context.Context<unknown>

function request(route: string, directory: string, query?: Record<string, string>, init?: RequestInit) {
  const url = new URL(`http://localhost${route}`)
  for (const [key, value] of Object.entries(query ?? {})) {
    url.searchParams.set(key, value)
  }
  return HttpApiApp.webHandler().handler(
    new Request(url, {
      ...init,
      headers: {
        "content-type": "application/json",
        "x-Arunaki-directory": directory,
        ...(init?.headers || {}),
      },
    }),
    context,
  )
}

function jsonRequest(route: string, directory: string, method: string, body: unknown) {
  return request(route, directory, {}, {
    method,
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

afterEach(async () => {
  await disposeAllInstances()
  await resetDatabase()
})

describe("knowledge HttpApi", () => {
  test("serves node CRUD, edges, and graph persistence", async () => {
    await using tmp = await tmpdir()

    const list0 = await request("/knowledge", tmp.path)
    expect(list0.status).toBe(200)
    const initial = (await list0.json()) as { data: { id: string }[] }
    expect(initial.data.some((n) => n.id === "main-ai-node")).toBe(true)

    const create = await jsonRequest("/knowledge", tmp.path, "POST", {
      title: "Format Rekap",
      content: "Header wajib berisi tanggal terbaru.",
      type: "rules",
      positionX: 100,
      positionY: 200,
      nodeColor: "#10B981",
      icon: "shield-check",
    })
    expect(create.status).toBe(200)
    const created = ((await create.json()) as { data: { id: string; title: string } }).data
    expect(created.title).toBe("Format Rekap")

    const list1 = await request("/knowledge", tmp.path)
    const nodes1 = (await list1.json()) as { data: { id: string }[] }
    expect(nodes1.data.some((n) => n.id === created.id)).toBe(true)

    const update = await jsonRequest(`/knowledge/${created.id}`, tmp.path, "PATCH", {
      title: "Format Rekap (update)",
      content: "Isi baru.",
      urls: ["https://example.com"],
      city: "Medan",
    })
    expect(update.status).toBe(200)
    const updated = ((await update.json()) as { data: { title: string; city: string; urls: string } }).data
    expect(updated.title).toBe("Format Rekap (update)")
    expect(updated.city).toBe("Medan")
    expect(updated.urls).toBe('["https://example.com"]')

    const toggle = await request(`/knowledge/${created.id}/toggle`, tmp.path, {}, { method: "PATCH" })
    expect(toggle.status).toBe(200)
    const toggled = ((await toggle.json()) as { data: { active: boolean } }).data
    expect(toggled.active).toBe(false)

    const edge = await jsonRequest("/knowledge/edges", tmp.path, "POST", {
      sourceId: created.id,
      targetId: "main-ai-node",
    })
    expect(edge.status).toBe(200)
    const edgeData = (await edge.json()) as { data: { id: string; sourceId: string } }
    expect(edgeData.data.sourceId).toBe(created.id)

    const edges = await request("/knowledge/edges", tmp.path)
    expect(edges.status).toBe(200)
    expect((await edges.json()) as { data: unknown[] }).toHaveProperty("data")

    // Persisted across reloads (re-read from file)
    const listReload = await request("/knowledge", tmp.path)
    const nodesReload = (await listReload.json()) as { data: { id: string }[] }
    expect(nodesReload.data.some((n) => n.id === created.id)).toBe(true)

    const remove = await request(`/knowledge/${created.id}`, tmp.path, {}, { method: "DELETE" })
    expect(remove.status).toBe(200)
    const afterRemove = (await (await request("/knowledge", tmp.path)).json()) as { data: { id: string }[] }
    expect(afterRemove.data.some((n) => n.id === created.id)).toBe(false)
  }, { timeout: 30000 })

  test("serves upload and compose", async () => {
    await using tmp = await tmpdir()

    const boundary = "arunakitestboundary"
    const body = [
      `--${boundary}`,
      `Content-Disposition: form-data; name="file"; filename="catatan.md"`,
      "Content-Type: text/markdown",
      "",
      "# Catatan",
      "",
      "Ini konten knowledge dari upload.",
      `--${boundary}--`,
      "",
    ].join("\r\n")
    const upload = await request(
      "/knowledge/upload",
      tmp.path,
      {},
      {
        method: "POST",
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
        },
        body,
      },
    )
    expect(upload.status).toBe(200)
    const node = ((await upload.json()) as { data: { title: string; content: string; type: string } }).data
    expect(node.title).toBe("catatan")
    expect(node.content).toContain("Ini konten knowledge")
    expect(node.type).toBe("document")

    // upload persisted to graph store (auto-connected edge created)
    const edges = (await (await request("/knowledge/edges", tmp.path)).json()) as { data: { targetId: string }[] }
    expect(edges.data.some((e) => e.targetId === "main-ai-node")).toBe(true)
  }, { timeout: 30000 })
})