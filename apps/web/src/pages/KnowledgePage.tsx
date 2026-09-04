import { useState, useEffect, useCallback, useRef } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  ReactFlowProvider,
  MarkerType,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import {
  UploadCloud,
  FileText,
  CheckCircle2,
  X,
} from "lucide-react";
import { cn } from "../lib/utils";
import { API_BASE, apiFetch } from "../lib/api";

import { KnowledgeNode } from "../components/knowledge/KnowledgeNode";
import { KnowledgeNodePanel } from "../components/knowledge/KnowledgeNodePanel";
import { KnowledgeToolbar } from "../components/knowledge/KnowledgeToolbar";
import { FloatingEdge } from "../components/knowledge/FloatingEdge";
import { useTheme, getSystemTheme } from "../lib/theme";

// ─── Interfaces ─────────────────────────────────────────────────────────

interface KnowledgeDoc {
  id: string;
  title: string;
  content: string;
  type: string;
  active: boolean;
  positionX: number;
  positionY: number;
  nodeColor: string;
  icon: string;
  createdAt: string;
}

interface KnowledgeEdgeData {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string;
}

// ─── Flow Editor Component ───────────────────────────────────────────────

const nodeTypes = {
  knowledge: KnowledgeNode,
};

const edgeTypes = {
  floating: FloatingEdge,
  bezier: FloatingEdge,
  default: FloatingEdge,
};

function FlowEditor() {
  const { theme } = useTheme();
  const isLight = theme === 'light' || (theme === 'system' && getSystemTheme() === 'light');
  const { setCenter, fitView } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  
  const [loading, setLoading] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  
  // Upload modal state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [extractStep, setExtractStep] = useState<"idle" | "uploading" | "extracting" | "saving" | "done">("idle");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Fetch Data ────────────────────────────────────────────────────────
  
  const fetchData = useCallback(async () => {
    try {
      const [resDocs, resEdges] = await Promise.all([
        apiFetch(`${API_BASE}/knowledge`),
        apiFetch(`${API_BASE}/knowledge/edges`)
      ]);
      
      const dataDocs = await resDocs.json();
      const dataEdges = await resEdges.json();
      
      const docs = dataDocs.data || [];
      const dbEdges = dataEdges.data || [];
      
      // Build nodes
      const initialNodes: Node[] = docs.map((doc: KnowledgeDoc) => ({
        id: doc.id,
        type: 'knowledge',
        position: { x: doc.positionX || 0, y: doc.positionY || 0 },
        data: {
          id: doc.id,
          title: doc.title,
          content: doc.content,
          type: doc.type,
          active: doc.active,
          nodeColor: doc.nodeColor,
          icon: doc.icon,
          isMain: doc.id === 'main-ai-node',
          onSelect: () => setSelectedNodeId(doc.id),
        },
        draggable: doc.id !== 'main-ai-node',
      }));

      // Build edges with sleek floating auto-facing curves (9router hub style)
      const initialEdges: Edge[] = dbEdges.map((e: KnowledgeEdgeData) => ({
        id: e.id,
        source: e.sourceId,
        target: e.targetId,
        label: e.label,
        type: 'floating',
        style: {
          stroke: isLight ? '#64748B' : '#94A3B8',
          strokeWidth: 2.75,
        },
      }));

      setNodes(initialNodes);
      setEdges(initialEdges);

      // Smoothly center the camera exactly on the main AI node
      setTimeout(() => {
        const mainNode = initialNodes.find(n => n.id === 'main-ai-node');
        if (mainNode) {
          // Add 48px to offset for the node's center (w-24 h-24 is 96x96)
          setCenter(mainNode.position.x + 48, mainNode.position.y + 48, { zoom: 0.85, duration: 800 });
        } else {
          fitView({ padding: 0.9, maxZoom: 0.85, duration: 600 });
        }
      }, 100);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [setNodes, setEdges, isLight, setCenter, fitView]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Flow Handlers ─────────────────────────────────────────────────────

  // Validation: Knowledge nodes can ONLY connect to the Agent Core node ('main-ai-node')
  // Knowledge-to-Knowledge connections are strictly prohibited!
  const isValidConnection = useCallback((connection: Connection | Edge) => {
    if (connection.source === connection.target) return false;
    const isSourceMain = connection.source === 'main-ai-node';
    const isTargetMain = connection.target === 'main-ai-node';
    return isSourceMain || isTargetMain;
  }, []);

  const onConnect = useCallback(
    async (params: Connection) => {
      // Enforce connection validation rule
      if (!isValidConnection(params)) return;

      // Create edge in DB
      try {
        const res = await apiFetch(`${API_BASE}/knowledge/edges`, {
          method: 'POST',
          body: JSON.stringify({
            sourceId: params.source,
            targetId: params.target,
          }),
        });
        
        if (res.ok) {
          const { data } = await res.json();
          const newEdge: Edge = {
            id: data.id,
            source: data.sourceId,
            target: data.targetId,
            sourceHandle: params.sourceHandle,
            targetHandle: params.targetHandle,
            type: 'floating',
            style: {
              stroke: isLight ? '#64748B' : '#94A3B8',
              strokeWidth: 2.75,
            },
          };
          setEdges((eds) => addEdge(newEdge, eds));
        }
      } catch (e) {
        console.error(e);
      }
    },
    [setEdges, isLight, isValidConnection],
  );

  const onEdgesDelete = useCallback(
    async (edgesToDelete: Edge[]) => {
      for (const edge of edgesToDelete) {
        try {
          await apiFetch(`${API_BASE}/knowledge/edges/${edge.id}`, {
            method: 'DELETE',
          });
        } catch (e) {
          console.error(e);
        }
      }
    },
    []
  );

  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault();
      // Remove from UI
      setEdges((eds) => eds.filter((e) => e.id !== edge.id));
      // Call our backend deletion handler
      onEdgesDelete([edge]);
    },
    [setEdges, onEdgesDelete]
  );

// Anti-Collision Algorithm: Prevents nodes from overlapping or stacking on top of each other
function resolveNodeCollision(draggedNode: Node, allNodes: Node[]): { x: number; y: number } {
  let { x, y } = draggedNode.position;
  const isDraggedMain = draggedNode.id === 'main-ai-node';
  const w1 = isDraggedMain ? 220 : 140;
  const h1 = isDraggedMain ? 75 : 110;
  const padding = 30; // Minimum clearance margin between node borders

  for (const other of allNodes) {
    if (other.id === draggedNode.id) continue;
    const isOtherMain = other.id === 'main-ai-node';
    const w2 = isOtherMain ? 220 : 140;
    const h2 = isOtherMain ? 75 : 110;

    const minDistanceX = (w1 + w2) / 2 + padding;
    const minDistanceY = (h1 + h2) / 2 + padding;

    const center1X = x + w1 / 2;
    const center1Y = y + h1 / 2;
    const center2X = other.position.x + w2 / 2;
    const center2Y = other.position.y + h2 / 2;

    const dx = center1X - center2X;
    const dy = center1Y - center2Y;

    if (Math.abs(dx) < minDistanceX && Math.abs(dy) < minDistanceY) {
      // Collision detected! Push along the axis of least penetration
      const overlapX = minDistanceX - Math.abs(dx);
      const overlapY = minDistanceY - Math.abs(dy);

      if (overlapX < overlapY) {
        x += dx >= 0 ? overlapX : -overlapX;
      } else {
        y += dy >= 0 ? overlapY : -overlapY;
      }
    }
  }

  return { x, y };
}

  // Save node positions on drag stop with Anti-Collision snapping
  const onNodeDragStop = useCallback(
    async (_: any, node: Node) => {
      const resolved = resolveNodeCollision(node, nodes);
      const finalX = Math.round(resolved.x);
      const finalY = Math.round(resolved.y);

      if (finalX !== node.position.x || finalY !== node.position.y) {
        setNodes((nds) =>
          nds.map((n) => (n.id === node.id ? { ...n, position: { x: finalX, y: finalY } } : n))
        );
      }

      if (node.id === 'main-ai-node') return;
      try {
        await apiFetch(`${API_BASE}/knowledge/${node.id}/position`, {
          method: 'PATCH',
          body: JSON.stringify({
            positionX: finalX,
            positionY: finalY,
          }),
        });
      } catch (e) {
        console.error(e);
      }
    },
    [nodes, setNodes]
  );

  // ─── Node Actions ──────────────────────────────────────────────────────

  const handleAddNode = async (type: string, x: number, y: number) => {
    let title = 'New Knowledge';
    let nodeColor = '#3B82F6';
    let icon = 'file-text';

    if (type === 'catalog') {
      title = 'Product Catalog';
      nodeColor = '#3B82F6'; // Blue
      icon = 'database';
    } else if (type === 'rules') {
      title = 'Rules / SOP';
      nodeColor = '#10B981'; // Emerald
      icon = 'shield-check';
    } else if (type === 'template') {
      title = 'Report Template';
      nodeColor = '#8B5CF6'; // Purple
      icon = 'type';
    }

    try {
      const res = await apiFetch(`${API_BASE}/knowledge`, {
        method: 'POST',
        body: JSON.stringify({
          title,
          content: 'Enter knowledge content here...',
          type,
          positionX: x + Math.random() * 50, // offset slightly
          positionY: y + Math.random() * 50,
          nodeColor,
          icon,
        }),
      });

      if (res.ok) {
        const { data } = await res.json();
        
        // Auto connect to main AI node
        const edgeRes = await apiFetch(`${API_BASE}/knowledge/edges`, {
          method: 'POST',
          body: JSON.stringify({
            sourceId: data.id,
            targetId: 'main-ai-node',
          }),
        });
        
        let newEdge: Edge | null = null;
        if (edgeRes.ok) {
          const edgeData = (await edgeRes.json()).data;
          newEdge = {
            id: edgeData.id,
            source: edgeData.sourceId,
            target: edgeData.targetId,
            type: 'floating',
            style: { stroke: isLight ? '#64748B' : '#94A3B8', strokeWidth: 2.75 },
          };
        }

        const newNode: Node = {
          id: data.id,
          type: 'knowledge',
          position: { x: data.positionX, y: data.positionY },
          data: {
            id: data.id,
            title: data.title,
            content: data.content,
            type: data.type,
            active: data.active,
            nodeColor: data.nodeColor,
            icon: data.icon,
            onSelect: setSelectedNodeId,
          },
        };
        
        setNodes((nds) => [...nds, newNode]);
        if (newEdge) setEdges((eds) => addEdge(newEdge, eds));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateNode = (id: string, updatedData: any) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          return {
            ...node,
            data: {
              ...node.data,
              ...updatedData,
              title: updatedData.title ?? node.data.title,
              content: updatedData.content ?? node.data.content,
              type: updatedData.type ?? node.data.type,
              active: updatedData.active !== undefined ? updatedData.active : node.data.active,
              city: updatedData.city !== undefined ? updatedData.city : node.data.city,
              urls: updatedData.urls !== undefined ? updatedData.urls : node.data.urls,
            },
          };
        }
        return node;
      })
    );
  };

  const handleDeleteNode = (id: string) => {
    setNodes((nds) => nds.filter((node) => node.id !== id));
    setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id));
    setSelectedNodeId(null);
  };

  // ─── File Upload Logic ─────────────────────────────────────────────────

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) setSelectedFile(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  const createDoc = async () => {
    if (!selectedFile) return;
    setCreating(true);
    setExtractStep("uploading");
    
    try {
      await new Promise((r) => setTimeout(r, 600));
      setExtractStep("extracting");

      const formData = new FormData();
      formData.append("file", selectedFile);
      // Place new node near center
      formData.append("positionX", "200");
      formData.append("positionY", "200");
      
      const res = await apiFetch(`${API_BASE}/knowledge/upload`, {
        method: "POST",
        body: formData,
      });
      
      if (!res.ok) throw new Error("Upload failed");
      const data = (await res.json()).data;

      setExtractStep("saving");
      await new Promise((r) => setTimeout(r, 400));
      
      // Auto connect to main AI node
      const edgeRes = await apiFetch(`${API_BASE}/knowledge/edges`, {
        method: 'POST',
        body: JSON.stringify({
          sourceId: data.id,
          targetId: 'main-ai-node',
        }),
      });
      
      let newEdge: Edge | null = null;
      if (edgeRes.ok) {
        const edgeData = (await edgeRes.json()).data;
        newEdge = {
          id: edgeData.id,
          source: edgeData.sourceId,
          target: edgeData.targetId,
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#9ca3af', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#9ca3af' },
        };
      }

      const newNode: Node = {
        id: data.id,
        type: 'knowledge',
        position: { x: data.positionX, y: data.positionY },
        data: {
          id: data.id,
          title: data.title,
          content: data.content,
          type: data.type,
          active: data.active,
          nodeColor: '#F59E0B', // amber for uploaded file
          icon: 'file-text',
          onSelect: setSelectedNodeId,
        },
      };
      
      setNodes((nds) => [...nds, newNode]);
      if (newEdge) setEdges((eds) => addEdge(newEdge, eds));
      
      setExtractStep("done");
      await new Promise((r) => setTimeout(r, 800));

      setSelectedFile(null);
      setUploadOpen(false);
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
      setExtractStep("idle");
    }
  };

  return (
    <div className="flex-1 h-full relative bg-[var(--bg-app)] text-[var(--text-primary)]">


      {loading ? (
        <div className="w-full h-full flex items-center justify-center bg-[var(--bg-app)]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-2 border-[var(--border-strong)] border-t-[var(--text-primary)] rounded-full animate-spin" />
            <p className="text-sm text-[var(--text-muted)] font-medium">Loading Knowledge Graph...</p>
          </div>
        </div>
      ) : (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgesDelete={onEdgesDelete}
          onEdgeContextMenu={onEdgeContextMenu}
          onNodeDragStop={onNodeDragStop}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          isValidConnection={isValidConnection}
          colorMode={isLight ? 'light' : 'dark'}
          proOptions={{ hideAttribution: true }}
          fitView
          fitViewOptions={{ padding: 0.9, maxZoom: 0.85, minZoom: 0.1 }}
          minZoom={0.1}
          maxZoom={2}
          className="bg-[var(--bg-app)]"
          defaultEdgeOptions={{
            type: 'floating',
            style: { stroke: isLight ? '#64748B' : '#94A3B8', strokeWidth: 2.75 },
          }}
          onNodeClick={(_, node) => {
            setSelectedNodeId(node.id);
          }}
          onPaneClick={() => {
            setSelectedNodeId(null);
          }}
        >
          <Background color={isLight ? "#D1D5DB" : "#333338"} gap={20} size={1.2} />
          <Controls className="!bg-[var(--bg-panel)] border !border-[var(--border-strong)] rounded-xl overflow-hidden !bottom-8 !left-4 [&_button]:!bg-[var(--bg-panel)] [&_button]:!text-[var(--text-primary)] [&_button]:!border-b-[var(--border-color)] [&_button:hover]:!bg-[var(--bg-hover)]" />
          <MiniMap 
            className="rounded-xl !bg-[#121214] border !border-[var(--border-strong)] overflow-hidden !bottom-8 !right-4"
            maskColor={isLight ? "rgba(243, 244, 246, 0.75)" : "rgba(10, 10, 10, 0.85)"}
            nodeBorderRadius={16}
            nodeColor={(node) => {
              if (node.id === 'main-ai-node') return isLight ? '#8B5CF6' : '#a855f7';
              return '#3b82f6';
            }}
          />
          
          <KnowledgeToolbar 
            onAddNode={handleAddNode}
            onUpload={() => setUploadOpen(true)}
          />
          
          <KnowledgeNodePanel
            nodeId={selectedNodeId}
            onClose={() => {
              setSelectedNodeId(null);
              setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
            }}
            onUpdate={handleUpdateNode}
            onDelete={handleDeleteNode}
          />
        </ReactFlow>
      )}

      {/* Upload Modal (Same as original but absolute overlay) */}
      {uploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-[var(--bg-card)] text-[var(--text-primary)] rounded-3xl p-6 space-y-5 border border-[var(--border-color)]">
            {creating ? (
              /* Loading State */
              <div className="py-10 space-y-6">
                <div className="flex items-center justify-center gap-3">
                  <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
                  <span className="text-sm font-semibold text-gray-900">
                    {extractStep === "uploading" && "Uploading file..."}
                    {extractStep === "extracting" && "Extracting text from document..."}
                    {extractStep === "saving" && "Saving to Knowledge Graph..."}
                    {extractStep === "done" && "Saved successfully!"}
                  </span>
                </div>

                <div className="space-y-2.5 px-4">
                  {(["uploading", "extracting", "saving", "done"] as const).map((step, i) => {
                    const steps = ["uploading", "extracting", "saving", "done"] as const;
                    const currentIdx = steps.indexOf(extractStep as typeof steps[number]);
                    const stepIdx = i;
                    const isDone = stepIdx < currentIdx;
                    const isCurrent = stepIdx === currentIdx;

                    return (
                      <div key={step} className="flex items-center gap-3">
                        <div className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border shrink-0",
                          isDone
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : isCurrent
                              ? "border-gray-900 text-gray-900 bg-gray-50"
                              : "border-gray-200 text-gray-400 bg-gray-50"
                        )}>
                          {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                        </div>
                        <span className={cn(
                          "text-xs font-medium",
                          isDone ? "text-emerald-600" : isCurrent ? "text-gray-900" : "text-gray-400"
                        )}>
                          {step === "uploading" && "Upload file"}
                          {step === "extracting" && "Text extraction"}
                          {step === "saving" && "Create Node & Connections"}
                          {step === "done" && "Complete"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Upload Form */
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-gray-100 text-gray-700">
                      <UploadCloud className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Add Document Node</h3>
                      <p className="text-xs text-gray-500">This node will be automatically linked to the AI</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setUploadOpen(false); setSelectedFile(null); }}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleFileDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all",
                    dragOver
                      ? "border-gray-900 bg-gray-50"
                      : selectedFile
                        ? "border-emerald-300 bg-emerald-50/50"
                        : "border-gray-200 hover:border-gray-400 hover:bg-gray-50/50"
                  )}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.txt,.md,.csv"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  {selectedFile ? (
                    <>
                      <FileText className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                      <p className="text-sm font-semibold text-gray-900">{selectedFile.name}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                        className="mt-2 text-xs text-gray-500 hover:text-gray-700 underline"
                      >
                        Change file
                      </button>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                      <p className="text-sm font-semibold text-gray-700">
                        Click or drag a document file here
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Supports PDF, DOCX, TXT, Markdown, CSV
                      </p>
                    </>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => { setUploadOpen(false); setSelectedFile(null); }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createDoc}
                    disabled={!selectedFile}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-semibold bg-gray-900 text-white hover:bg-gray-800 transition-all",
                      !selectedFile && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    Upload & Create Node
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function KnowledgePage() {
  return (
    <ReactFlowProvider>
      <FlowEditor />
    </ReactFlowProvider>
  );
}
