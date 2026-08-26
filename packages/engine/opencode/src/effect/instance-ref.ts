import { Context } from "effect"
import type { InstanceContext } from "@/project/instance-context"
import type { WorkspaceV2 } from "@arunaki/core/workspace"

export const InstanceRef = Context.Reference<InstanceContext | undefined>("~Arunaki/InstanceRef", {
  defaultValue: () => undefined,
})

export const WorkspaceRef = Context.Reference<WorkspaceV2.ID | undefined>("~Arunaki/WorkspaceRef", {
  defaultValue: () => undefined,
})
