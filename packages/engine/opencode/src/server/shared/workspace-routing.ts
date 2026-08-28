import { SessionID } from "@/session/schema"

export function getWorkspaceRouteSessionID(url: URL) {
  if (url.pathname === "/session/status" || url.pathname === "/api/session/status") return null

  const id =
    url.pathname.match(/^\/session\/([^/]+)(?:\/|$)/)?.[1] ??
    url.pathname.match(/^\/api\/session\/([^/]+)(?:\/|$)/)?.[1] ??
    url.pathname.match(/^\/experimental\/session\/([^/]+)\/background$/)?.[1]
  if (!id) return null

  return SessionID.make(id)
}