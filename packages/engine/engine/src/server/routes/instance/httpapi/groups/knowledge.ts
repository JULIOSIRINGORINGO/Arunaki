import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema, OpenApi } from "effect/unstable/httpapi"
import { Authorization } from "../middleware/authorization"
import { InstanceContextMiddleware } from "../middleware/instance-context"
import { WorkspaceRoutingMiddleware, WorkspaceRoutingQuery } from "../middleware/workspace-routing"
import { described } from "./metadata"

const uiRoot = "/api/knowledge"

export class KnowledgeError extends Schema.TaggedErrorClass<KnowledgeError>()("KnowledgeError", {
  message: Schema.String,
  status: Schema.Number,
}) {}

export const KnowledgeNodeSchema = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  content: Schema.String,
  type: Schema.String,
  active: Schema.Boolean,
  positionX: Schema.Number,
  positionY: Schema.Number,
  nodeColor: Schema.String,
  icon: Schema.String,
  city: Schema.String,
  urls: Schema.String,
  createdAt: Schema.String,
}).annotate({ identifier: "KnowledgeNode" })

export const KnowledgeEdgeSchema = Schema.Struct({
  id: Schema.String,
  sourceId: Schema.String,
  targetId: Schema.String,
  label: Schema.optional(Schema.String),
}).annotate({ identifier: "KnowledgeEdge" })

export const KnowledgeNodeData = Schema.Struct({ data: KnowledgeNodeSchema })
export const KnowledgeNodeListData = Schema.Struct({ data: Schema.Array(KnowledgeNodeSchema) })
export const KnowledgeEdgeData = Schema.Struct({ data: KnowledgeEdgeSchema })
export const KnowledgeEdgeListData = Schema.Struct({ data: Schema.Array(KnowledgeEdgeSchema) })
export const EmptyData = Schema.Struct({ data: Schema.Struct({}) })

export const KnowledgeParams = Schema.Struct({ id: Schema.String })
export const KnowledgeEdgeParams = Schema.Struct({ edgeId: Schema.String })

export const CreateNodeInput = Schema.Struct({
  title: Schema.String,
  content: Schema.String,
  type: Schema.String,
  positionX: Schema.Number,
  positionY: Schema.Number,
  nodeColor: Schema.String,
  icon: Schema.String,
})

export const UpdateNodeInput = Schema.Struct({
  title: Schema.String,
  content: Schema.String,
  urls: Schema.Array(Schema.String),
  city: Schema.String,
})

export const PositionInput = Schema.Struct({
  positionX: Schema.Number,
  positionY: Schema.Number,
})

export const CreateEdgeInput = Schema.Struct({
  sourceId: Schema.String,
  targetId: Schema.String,
  label: Schema.optional(Schema.String),
})

export const ComposeInput = Schema.Struct({
  url: Schema.String,
})

export const ComposeResult = Schema.Struct({
  title: Schema.String,
  content: Schema.String,
  urls: Schema.Array(Schema.String),
})

export const KnowledgeApi = HttpApi.make("knowledge")
  .add(
    HttpApiGroup.make("knowledge")
      .add(
        HttpApiEndpoint.get("list", uiRoot, {
          query: WorkspaceRoutingQuery,
          success: described(KnowledgeNodeListData, "Knowledge nodes"),
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "knowledge.list",
            summary: "List knowledge nodes",
            description: "List all knowledge graph nodes in the workspace.",
          }),
        ),
        HttpApiEndpoint.post("create", uiRoot, {
          query: WorkspaceRoutingQuery,
          payload: CreateNodeInput,
          success: described(KnowledgeNodeData, "Created node"),
          error: KnowledgeError,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "knowledge.create",
            summary: "Create knowledge node",
            description: "Create a new knowledge graph node.",
          }),
        ),
        HttpApiEndpoint.get("get", `${uiRoot}/:id`, {
          params: KnowledgeParams,
          query: WorkspaceRoutingQuery,
          success: described(KnowledgeNodeData, "Knowledge node"),
          error: KnowledgeError,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "knowledge.get",
            summary: "Get knowledge node",
            description: "Get a single knowledge graph node by ID.",
          }),
        ),
        HttpApiEndpoint.patch("update", `${uiRoot}/:id`, {
          params: KnowledgeParams,
          query: WorkspaceRoutingQuery,
          payload: UpdateNodeInput,
          success: described(KnowledgeNodeData, "Updated node"),
          error: KnowledgeError,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "knowledge.update",
            summary: "Update knowledge node",
            description: "Update title, content, urls, and city of a knowledge node.",
          }),
        ),
        HttpApiEndpoint.delete("remove", `${uiRoot}/:id`, {
          params: KnowledgeParams,
          query: WorkspaceRoutingQuery,
          success: described(EmptyData, "Deleted"),
          error: KnowledgeError,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "knowledge.remove",
            summary: "Delete knowledge node",
            description: "Delete a knowledge graph node and its connected edges.",
          }),
        ),
        HttpApiEndpoint.patch("position", `${uiRoot}/:id/position`, {
          params: KnowledgeParams,
          query: WorkspaceRoutingQuery,
          payload: PositionInput,
          success: described(KnowledgeNodeData, "Position updated"),
          error: KnowledgeError,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "knowledge.position",
            summary: "Update node position",
            description: "Update the position of a knowledge graph node.",
          }),
        ),
        HttpApiEndpoint.patch("toggle", `${uiRoot}/:id/toggle`, {
          params: KnowledgeParams,
          query: WorkspaceRoutingQuery,
          success: described(KnowledgeNodeData, "Toggled active"),
          error: KnowledgeError,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "knowledge.toggle",
            summary: "Toggle node active",
            description: "Toggle a knowledge node between active and inactive for AI access.",
          }),
        ),
        HttpApiEndpoint.post("upload", `${uiRoot}/upload`, {
          query: WorkspaceRoutingQuery,
          payload: HttpApiSchema.NoContent,
          success: described(KnowledgeNodeData, "Uploaded knowledge"),
          error: KnowledgeError,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "knowledge.upload",
            summary: "Upload knowledge file",
            description: "Upload a document file (TXT, Markdown, CSV, JSON) to create a knowledge node.",
          }),
        ),
        HttpApiEndpoint.post("compose", `${uiRoot}/compose`, {
          query: WorkspaceRoutingQuery,
          payload: ComposeInput,
          success: described(Schema.Struct({ data: ComposeResult }), "Composed content"),
          error: KnowledgeError,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "knowledge.compose",
            summary: "Compose from URL",
            description: "Fetch a website URL and extract its content as Markdown.",
          }),
        ),
        HttpApiEndpoint.get("listEdges", `${uiRoot}/edges`, {
          query: WorkspaceRoutingQuery,
          success: described(KnowledgeEdgeListData, "Knowledge edges"),
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "knowledge.edges.list",
            summary: "List knowledge edges",
            description: "List all edges in the knowledge graph.",
          }),
        ),
        HttpApiEndpoint.post("createEdge", `${uiRoot}/edges`, {
          query: WorkspaceRoutingQuery,
          payload: CreateEdgeInput,
          success: described(KnowledgeEdgeData, "Created edge"),
          error: KnowledgeError,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "knowledge.edges.create",
            summary: "Create knowledge edge",
            description: "Create an edge between two knowledge graph nodes.",
          }),
        ),
        HttpApiEndpoint.delete("removeEdge", `${uiRoot}/edges/:edgeId`, {
          params: KnowledgeEdgeParams,
          query: WorkspaceRoutingQuery,
          success: described(EmptyData, "Deleted edge"),
          error: KnowledgeError,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "knowledge.edges.remove",
            summary: "Delete knowledge edge",
            description: "Delete an edge from the knowledge graph.",
          }),
        ),
      )
      .annotateMerge(
        OpenApi.annotations({
          title: "knowledge",
          description: "Knowledge graph endpoints for managing workspace knowledge nodes, edges, file uploads, and URL composition.",
        }),
      )
      .middleware(InstanceContextMiddleware)
      .middleware(WorkspaceRoutingMiddleware)
      .middleware(Authorization),
  )
  .annotateMerge(
    OpenApi.annotations({
      title: "Arunaki experimental HttpApi",
      version: "0.0.1",
      description: "Experimental HttpApi surface for selected instance routes.",
    }),
  )
