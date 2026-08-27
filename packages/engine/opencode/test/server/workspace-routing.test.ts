import { describe, expect, test } from "bun:test"
import {
  isLocalWorkspaceRoute,
  getWorkspaceRouteSessionID,
  workspaceProxyURL,
} from "../../src/server/shared/workspace-routing"
import { SessionID } from "../../src/session/schema"

describe("isLocalWorkspaceRoute", () => {
  test("GET /session is local", () => {
    expect(isLocalWorkspaceRoute("GET", "/session")).toBe(true)
    expect(isLocalWorkspaceRoute("GET", "/api/session")).toBe(true)
    expect(isLocalWorkspaceRoute("GET", "/session/ses_abc")).toBe(true)
    expect(isLocalWorkspaceRoute("POST", "/session")).toBe(true)
    expect(isLocalWorkspaceRoute("GET", "/session/status")).toBe(true)
    expect(isLocalWorkspaceRoute("POST", "/session/status")).toBe(true)
    expect(isLocalWorkspaceRoute("GET", "/config")).toBe(false)
    expect(isLocalWorkspaceRoute("POST", "/session/ses_abc/message")).toBe(true)
    expect(isLocalWorkspaceRoute("GET", "/api/provider")).toBe(true)
    expect(isLocalWorkspaceRoute("GET", "/api/model")).toBe(true)
    expect(isLocalWorkspaceRoute("GET", "/api/event")).toBe(true)
    expect(isLocalWorkspaceRoute("GET", "/console")).toBe(true)
  })
})

describe("getWorkspaceRouteSessionID", () => {
  test("extracts session ID from path", () => {
    const url = new URL("http://localhost/session/ses_abc123/message")
    expect(getWorkspaceRouteSessionID(url)).toBe(SessionID.make("ses_abc123"))
  })

  test("extracts session ID from path with /api prefix", () => {
    const url = new URL("http://localhost/api/session/ses_abc123/message")
    expect(getWorkspaceRouteSessionID(url)).toBe(SessionID.make("ses_abc123"))
  })

  test("extracts session ID without trailing path", () => {
    const url = new URL("http://localhost/session/ses_xyz")
    expect(getWorkspaceRouteSessionID(url)).toBe(SessionID.make("ses_xyz"))
  })

  test("extracts session ID from experimental background path", () => {
    const url = new URL("http://localhost/experimental/session/ses_bg/background")
    expect(getWorkspaceRouteSessionID(url)).toBe(SessionID.make("ses_bg"))
  })

  test("returns null for /session/status and /api/session/status", () => {
    expect(getWorkspaceRouteSessionID(new URL("http://localhost/session/status"))).toBeNull()
    expect(getWorkspaceRouteSessionID(new URL("http://localhost/api/session/status"))).toBeNull()
  })

  test("returns null for non-session paths", () => {
    const url = new URL("http://localhost/config")
    expect(getWorkspaceRouteSessionID(url)).toBeNull()
  })

  test("returns null for bare /session and /api/session paths", () => {
    expect(getWorkspaceRouteSessionID(new URL("http://localhost/session"))).toBeNull()
    expect(getWorkspaceRouteSessionID(new URL("http://localhost/api/session"))).toBeNull()
  })
})

describe("workspaceProxyURL", () => {
  test("appends request path to target", () => {
    const result = workspaceProxyURL("http://remote:8080/base", new URL("http://localhost/config"))
    expect(result.toString()).toBe("http://remote:8080/base/config")
  })

  test("strips trailing slash on target before appending", () => {
    const result = workspaceProxyURL("http://remote:8080/base/", new URL("http://localhost/session/abc"))
    expect(result.pathname).toBe("/base/session/abc")
  })

  test("preserves query params from request but removes workspace", () => {
    const url = new URL("http://localhost/config?workspace=ws_123&keep=yes")
    const result = workspaceProxyURL("http://remote:8080/base", url)
    expect(result.searchParams.get("workspace")).toBeNull()
    expect(result.searchParams.get("keep")).toBe("yes")
  })

  test("strips the host directory param so the remote resolves its own root", () => {
    const url = new URL("http://localhost/session/abc?directory=F%3A%5Cproj&keep=yes")
    const result = workspaceProxyURL("http://remote:8080/base", url)
    expect(result.searchParams.get("directory")).toBeNull()
    expect(result.searchParams.get("keep")).toBe("yes")
  })

  test("preserves hash from request", () => {
    const url = new URL("http://localhost/page#section")
    const result = workspaceProxyURL("http://remote:8080", url)
    expect(result.hash).toBe("#section")
  })

  test("works with URL object as target", () => {
    const target = new URL("http://remote:3000/api")
    const result = workspaceProxyURL(target, new URL("http://localhost/users"))
    expect(result.toString()).toBe("http://remote:3000/api/users")
  })
})
