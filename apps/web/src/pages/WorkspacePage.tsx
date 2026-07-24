import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, FolderOpen } from "lucide-react";
import { WorkspaceCard } from "../components/workspace/WorkspaceCard";
import { CreateWorkspaceModal } from "../components/workspace/CreateWorkspaceModal";

const API_BASE = "http://localhost:3000/api/v1";

interface Workspace {
  id: string;
  name: string;
  status: string;
  createdAt: string;
}

export function WorkspacePage() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Fetch workspaces
  const { data: workspacesData, isLoading } = useQuery({
    queryKey: ["workspaces"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/workspaces`);
      const data = await res.json();
      return data.data || [];
    },
  });

  // Create workspace
  const createWorkspace = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch(`${API_BASE}/workspaces`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      setIsCreateOpen(false);
    },
  });

  // Delete workspace
  const deleteWorkspace = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`${API_BASE}/workspaces/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });

  const workspaces: Workspace[] = workspacesData || [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            Workspaces
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage your document workspaces
          </p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          <Plus size={18} />
          <span>New Workspace</span>
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      ) : workspaces.length === 0 ? (
        <div className="p-12 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg text-center">
          <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mx-auto mb-4">
            <FolderOpen className="text-purple-600 dark:text-purple-400" size={24} />
          </div>
          <h3 className="font-medium text-gray-900 dark:text-white mb-1">
            No workspaces yet
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Create your first workspace to get started
          </p>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
          >
            Create Workspace
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((ws) => (
            <WorkspaceCard
              key={ws.id}
              id={ws.id}
              name={ws.name}
              status={ws.status}
              createdAt={ws.createdAt}
              onDelete={(id) => deleteWorkspace.mutate(id)}
            />
          ))}
        </div>
      )}

      <CreateWorkspaceModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={(name) => createWorkspace.mutate(name)}
        isLoading={createWorkspace.isPending}
      />
    </div>
  );
}
