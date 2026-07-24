import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FolderOpen, FileText, RefreshCw } from "lucide-react";
import { FileUploadZone } from "../components/workspace/FileUploadZone";

const API_BASE = "http://localhost:3000/api/v1";

export function WorkspaceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: workspace } = useQuery({
    queryKey: ["workspace", id],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/workspaces/${id}`);
      const data = await res.json();
      return data.data;
    },
    enabled: !!id,
  });

  const { data: filesData } = useQuery({
    queryKey: ["files", id],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/files/workspace/${id}`);
      const data = await res.json();
      return data.data || [];
    },
    enabled: !!id,
  });

  const initWorkspace = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/workspaces/${id}/initialize`, {
        method: "POST",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace", id] });
    },
  });

  const files = filesData || [];

  return (
    <div className="flex h-full">
      {/* Left Panel - Sources */}
      <div className="w-72 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 flex flex-col">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-4">
          Sources
        </h2>

        <FileUploadZone
          workspaceId={id!}
          onUploadComplete={() => {
            queryClient.invalidateQueries({ queryKey: ["files", id] });
          }}
        />

        <div className="space-y-1 mt-4 flex-1 overflow-y-auto">
          {files.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No files yet
            </p>
          ) : (
            files.map((file: any) => (
              <div
                key={file.id}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <FileText size={16} className="text-gray-400 shrink-0" />
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                  {file.name}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Center Panel - Content */}
      <div className="flex-1 flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                {workspace?.name || "Loading..."}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Status: {workspace?.status || "unknown"}
              </p>
            </div>
            <button
              onClick={() => initWorkspace.mutate()}
              disabled={initWorkspace.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              <RefreshCw
                size={16}
                className={initWorkspace.isPending ? "animate-spin" : ""}
              />
              Initialize
            </button>
          </div>
        </div>

        <div className="flex-1 p-6">
          <div className="text-center py-12">
            <FolderOpen className="mx-auto text-gray-300 dark:text-gray-600" size={48} />
            <p className="mt-4 text-gray-500 dark:text-gray-400">
              Workspace content will appear here
            </p>
          </div>
        </div>
      </div>

      {/* Right Panel - Quick Actions */}
      <div className="w-64 border-l border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
        <h2 className="font-semibold text-gray-900 dark:text-white mb-4">
          Quick Actions
        </h2>
        <div className="space-y-2">
          <button className="w-full px-3 py-2 text-left text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300">
            Generate Report
          </button>
          <button className="w-full px-3 py-2 text-left text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300">
            Create Summary
          </button>
          <button className="w-full px-3 py-2 text-left text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300">
            Export Data
          </button>
        </div>
      </div>
    </div>
  );
}
