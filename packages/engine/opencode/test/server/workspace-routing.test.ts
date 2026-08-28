import { describe, expect, test } from "bun:test"
import { getWorkspaceRouteSessionID } from "../../src/server/shared/workspace-routing"
import { SessionID } from "../../src/session/schema"

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