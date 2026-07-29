import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import {
  Folder,
  FolderCheck,
  Settings,
  MessageSquare,
  Paperclip,
  SlidersHorizontal,
  Sparkles,
  ArrowUp,
  FileText,
  FileSpreadsheet,
  Search,
  ShieldCheck,
  BarChart3,
  FileCode,
  Info,
  X,
  Plus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Square,
  Activity,
  Compass,
} from "lucide-react";
import { toast } from "sonner";
import FileTree from "../components/workspace/FileTree";
import { API_BASE } from "../lib/api";

interface AgentStep {
  type: "thinking" | "plan" | "tool" | "result" | "error";
  label: string;
  detail?: string;
  status: "running" | "done" | "error";
}

export function WorkspacePage() {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [promptInput, setPromptInput] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [customName, setCustomName] = useState("");
  const [isRestoring, setIsRestoring] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const connectedWsRef = useRef<string | null>(null);

  // Agent auto-analysis state
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);

  // VS Code-like: native folder tree from Electron IPC
  const [nativeTree, setNativeTree] = useState<any[] | null>(null);
  const [nativeFileCount, setNativeFileCount] = useState(0);
  const [connectedFolderPath, setConnectedFolderPath] = useState<string | null>(null);

  // Workspace Heartbeat & Proactive Monitor State (OpenClaw Layer 10 & 29)
  const [heartbeatAlert, setHeartbeatAlert] = useState<string | null>(null);
  const previousFileCountRef = useRef<number>(0);

  // Restore last connected workspace on mount
  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      try {
        const res = await fetch(`${API_BASE}/workspaces`);
        const json = await res.json();
        const workspaces = json.data || [];

        // Find workspace with rootPath (connected folder)
        const connected = workspaces.find((ws: any) => ws.rootPath);

        if (connected && !cancelled) {
          setWorkspaceId(connected.id);
          setConnectedFolderPath(connected.rootPath);
          setIsConnected(true);
          connectedWsRef.current = connected.id;
          localStorage.setItem('arunaki_workspace_id', connected.id);
          queryClient.invalidateQueries({ queryKey: ["wsFiles", connected.id] });

          // Load cached analysis result (if available from previous session)
          try {
            const analysisRes = await fetch(`${API_BASE}/workspaces/${connected.id}/analysis`);
            const analysisJson = await analysisRes.json();
            if (analysisJson.data?.analysisResult && !cancelled) {
              setAnalysisResult(analysisJson.data.analysisResult);
              setAgentSteps([{
                type: "result",
                label: "Analisis sebelumnya dimuat dari cache",
                detail: `Terakhir dianalisis: ${new Date(analysisJson.data.analyzedAt).toLocaleString('id-ID')}`,
                status: "done",
              }]);
            }
          } catch {
            // No cached analysis — that's fine
          }

          setIsRestoring(false);

          // Load native tree in background (non-blocking)
          const desktop = (window as any).arunakiDesktop;
          if (desktop?.getFolderTree && connected.rootPath) {
            desktop.getFolderTree(connected.rootPath).then((scan: any) => {
              if (scan?.tree && !cancelled) {
                const countFiles = (nodes: any[]): number =>
                  nodes.reduce((sum: number, n: any) => sum + (n.type === 'directory' ? countFiles(n.children || []) : 1), 0);
                setNativeTree(scan.tree);
                setNativeFileCount(countFiles(scan.tree));
              }
            }).catch(() => {});
          }
          return;
        }
      } catch {
        // Backend not available
      }
      if (!cancelled) setIsRestoring(false);
    };
    restore();
    return () => { cancelled = true; };
  }, [queryClient]);

  // Show modal only after restore attempt
  useEffect(() => {
    if (!isRestoring && !workspaceId) {
      setIsModalOpen(true);
    }
  }, [isRestoring, workspaceId]);

  const triggerAutoAnalysis = useCallback(async (wsId: string, goal?: string) => {
    setIsAnalyzing(true);
    setAgentSteps([]);
    setAnalysisResult(null);

    try {
      await fetchEventSource(`${API_BASE}/workspaces/${wsId}/agent/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: goal || "Baca dan analisis semua dokumen dalam workspace ini. Buat ringkasan singkat isi setiap dokumen dan identifikasi poin-poin penting.",
        }),
        openWhenHidden: true,
        onmessage(ev) {
          try {
            const event = JSON.parse(ev.data);
            switch (event.type) {
              case "thinking":
                setAgentSteps((prev) => [
                  ...prev,
                  { type: "thinking", label: event.data, status: "running" },
                ]);
                break;
              case "plan_created":
                setAgentSteps((prev) =>
                  prev.map((s) =>
                    s.status === "running" ? { ...s, status: "done" as const } : s
                  )
                );
                setAgentSteps((prev) => [
                  ...prev,
                  {
                    type: "plan",
                    label: `Rencana: ${event.data.steps?.length || 0} langkah`,
                    detail: event.data.steps?.join(" | "),
                    status: "done",
                  },
                ]);
                break;
              case "tool_start":
                setAgentSteps((prev) => [
                  ...prev,
                  {
                    type: "tool",
                    label: `Membaca: ${event.data.toolName}`,
                    detail: event.data.args?.filename || event.data.args?.query || "",
                    status: "running",
                  },
                ]);
                break;
              case "tool_done":
                setAgentSteps((prev) =>
                  prev.map((s) =>
                    s.status === "running" ? { ...s, status: "done" as const } : s
                  )
                );
                queryClient.invalidateQueries({ queryKey: ["wsFiles", wsId] });
                break;
              case "text_delta":
                setAnalysisResult(event.data);
                break;
              case "done":
                setAgentSteps((prev) =>
                  prev.map((s) =>
                    s.status === "running" ? { ...s, status: "done" as const } : s
                  )
                );
                if (event.data?.content) {
                  setAnalysisResult(event.data.content);
                }
                queryClient.invalidateQueries({ queryKey: ["wsFiles", wsId] });
                break;
              case "error":
                setAgentSteps((prev) => [
                  ...prev,
                  {
                    type: "error",
                    label: `Error: ${event.data?.message || "Unknown error"}`,
                    status: "error",
                  },
                ]);
                break;
            }
          } catch {
            // skip parse errors
          }
        },
        onerror(err) {
          console.error("Agent stream error:", err);
          setAgentSteps((prev) => [
            ...prev,
            { type: "error", label: "Koneksi stream terputus", status: "error" },
          ]);
        },
        onclose() {
          setIsAnalyzing(false);
        },
      });
    } catch (err) {
      console.error("Agent analysis failed:", err);
      setIsAnalyzing(false);
    }
  }, []);

  const doConnect = useCallback(async (files: File[], folderName: string, businessType: string = "generic") => {
    setIsCreating(true);
    try {
      // 1. Create workspace
      const wsRes = await fetch(`${API_BASE}/workspaces`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: folderName, businessType }),
      });
      const wsJson = await wsRes.json();
      const newId = wsJson.data?.id;
      if (!newId) {
        toast.error("Gagal membuat workspace");
        return;
      }

      // 2. Upload files (if any exist)
      if (files.length > 0) {
        const formData = new FormData();
        formData.append("workspaceId", newId);
        formData.append("sourceName", "Uploads");
        const relativePaths: string[] = [];
        files.forEach((f) => {
          formData.append("files", f);
          relativePaths.push(f.name);
        });
        formData.append("relativePaths", JSON.stringify(relativePaths));

        const uploadRes = await fetch(`${API_BASE}/files/upload`, {
          method: "POST",
          body: formData,
        });
        if (!uploadRes.ok) {
          console.warn("File upload failed, but workspace created");
        }
      }

      // 3. Connect
      setWorkspaceId(newId);
      setIsConnected(true);
      setIsModalOpen(false);
      connectedWsRef.current = newId;
      localStorage.setItem('arunaki_workspace_id', newId);
      queryClient.invalidateQueries({ queryKey: ["wsFiles", newId] });
      toast.success(`Workspace "${folderName}" terhubung!`);

      // 4. Auto-analyze di background (fire & forget)
      triggerAutoAnalysis(newId);
    } catch (err: any) {
      console.error("Connect failed:", err);
      toast.error(`Gagal menghubungkan: ${err.message || "Periksa apakah backend berjalan"}`);
    } finally {
      setIsCreating(false);
    }
  }, [queryClient, triggerAutoAnalysis]);

  const handleConnectFolder = useCallback(async () => {
    // Check if running in Electron with native folder picker
    const desktop = typeof window !== 'undefined' && (window as any).arunakiDesktop;
    const isElectron = !!(desktop?.pickFolder && desktop?.getFolderTree);

    if (isElectron) {
      try {
        // 1. Open native folder dialog (like VS Code)
        const result = await desktop.pickFolder();
        if (!result?.path) return;

        const folderPath = result.path;
        const folderName = folderPath.split(/[\\/]/).pop() || 'Workspace';

        setIsCreating(true);
        toast.info(`Membaca struktur folder "${folderName}"...`);

        // 2. Get full folder tree (files stay on disk — VS Code approach)
        const scan = await desktop.getFolderTree(folderPath);

        if (!scan?.tree) {
          toast.error('Gagal membaca folder.');
          setIsCreating(false);
          return;
        }

        // 3. Count all files in tree
        const countFiles = (nodes: any[]): number =>
          nodes.reduce((sum: number, n: any) => sum + (n.type === 'directory' ? countFiles(n.children || []) : 1), 0);
        const fileCount = countFiles(scan.tree);

        // 4. Register workspace in backend (rootPath stored — API can read files by path)
        const wsRes = await fetch(`${API_BASE}/workspaces`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: folderName, rootPath: folderPath, businessType: 'generic' }),
        });
        const wsJson = await wsRes.json();
        const newId = wsJson.data?.id;
        if (!newId) {
          toast.error('Gagal membuat workspace');
          setIsCreating(false);
          return;
        }

        // 5. Set native tree in state — displayed immediately like VS Code
        setNativeTree(scan.tree);
        setNativeFileCount(fileCount);
        setConnectedFolderPath(folderPath);
        setWorkspaceId(newId);
        setIsConnected(true);
        setIsModalOpen(false);
        connectedWsRef.current = newId;
        localStorage.setItem('arunaki_workspace_id', newId);
        toast.success(`Folder "${folderName}" terhubung! (${fileCount} file)`);

        // 6. Index files in backend for AI (await before analysis)
        try {
          await fetch(`${API_BASE}/workspaces/${newId}/connect-folder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderPath }),
          });
          queryClient.invalidateQueries({ queryKey: ['wsFiles', newId] });
        } catch {
          // Backend indexing failed — tree still visible
        }
        triggerAutoAnalysis(newId);
      } catch (err: any) {
        console.error('Connect folder failed:', err);
        toast.error(`Gagal menghubungkan folder: ${err.message || 'Periksa apakah backend berjalan'}`);
        setIsCreating(false);
      } finally {
        setIsCreating(false);
      }
      return;
    }

    
    // Fallback to browser File System Access API
    if ("showDirectoryPicker" in window) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker({ mode: "read" });
        const folderName = dirHandle.name;

        setIsCreating(true);

        const files: File[] = [];
        const IGNORED_NAMES = new Set([
          "node_modules", ".git", "dist", "build", ".next", ".venv", "__pycache__", ".idea", ".vscode", "coverage", ".cache"
        ]);

        const readEntries = async (handle: any, path: string) => {
          if (files.length >= 100) return;

          try {
            const entries = handle.values ? handle.values() : [];
            for await (const entry of entries) {
              if (files.length >= 100) break;
              if (!entry || !entry.name || entry.name.startsWith(".") || IGNORED_NAMES.has(entry.name)) continue;

              if (entry.kind === "file") {
                try {
                  const file = await entry.getFile();
                  files.push(new File([file], `${path}${file.name}`, { type: file.type }));
                } catch {
                  // Skip unreadable files silently
                }
              } else if (entry.kind === "directory") {
                await readEntries(entry, `${path}${entry.name}/`);
              }
            }
          } catch {
            // Fallback for directory reading
          }
        };

        await readEntries(dirHandle, "");
        await doConnect(files, folderName);
      } catch (e: any) {
        setIsCreating(false);
        if (e?.name === "AbortError") {
          return;
        }
        // Fallback to webkitdirectory if showDirectoryPicker fails
        fileInputRef.current?.click();
      }
    } else {
      fileInputRef.current?.click();
    }
  }, [doConnect, queryClient]);

  const handleCreateManual = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;
    await doConnect([], customName.trim());
  }, [customName, doConnect]);

  const handleFilesSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsCreating(true);
    const folderName = files[0].webkitRelativePath?.split("/")[0] || "Workspace Baru";
    const fileList = Array.from(files).filter(
      (f) => !f.name.startsWith(".") && !f.webkitRelativePath.includes("node_modules/")
    ).slice(0, 100);

    await doConnect(fileList, folderName);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [doConnect]);

  const { data: workspace } = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/workspaces/${workspaceId}`);
      const json = await res.json();
      return json.data;
    },
    enabled: !!workspaceId,
  });

  const { data: files = [] } = useQuery<any[]>({
    queryKey: ["wsFiles", workspaceId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/files/workspace/${workspaceId}`);
      const json = await res.json();
      return json.data || [];
    },
    enabled: !!workspaceId,
  });

  const handleRefreshFolder = useCallback(async () => {
    const rootPath = connectedFolderPath || workspace?.rootPath;
    const desktop = typeof window !== 'undefined' && (window as any).arunakiDesktop;
    if (desktop?.getFolderTree && rootPath) {
      const scan = await desktop.getFolderTree(rootPath);
      if (scan?.tree) {
        setNativeTree(scan.tree);
        const countFiles = (nodes: any[]): number =>
          nodes.reduce((sum: number, n: any) => sum + (n.type === 'directory' ? countFiles(n.children || []) : 1), 0);
        setNativeFileCount(countFiles(scan.tree));
        toast.success("Struktur folder diperbarui!");
      }
    }
    queryClient.invalidateQueries({ queryKey: ["wsFiles", workspaceId] });
  }, [connectedFolderPath, workspace?.rootPath, workspaceId, queryClient]);

  const handleCreateFile = useCallback(async (fileName: string) => {
    const rootPath = connectedFolderPath || workspace?.rootPath;
    const desktop = typeof window !== 'undefined' && (window as any).arunakiDesktop;
    if (desktop?.writeFile && rootPath) {
      const filePath = `${rootPath}/${fileName}`.replace(/\\/g, '/');
      const res = await desktop.writeFile(filePath, '');
      if (res?.error) {
        toast.error(`Gagal membuat file: ${res.error}`);
      } else {
        toast.success(`File "${fileName}" berhasil dibuat!`);
        handleRefreshFolder();
      }
    } else {
      toast.info("Pembuatan file via Explorer membutuhkan Desktop Electron.");
    }
  }, [connectedFolderPath, workspace?.rootPath, handleRefreshFolder]);

  const handleCreateFolder = useCallback(async (folderName: string) => {
    const rootPath = connectedFolderPath || workspace?.rootPath;
    const desktop = typeof window !== 'undefined' && (window as any).arunakiDesktop;
    if (desktop?.createFolder && rootPath) {
      const folderPath = `${rootPath}/${folderName}`.replace(/\\/g, '/');
      const res = await desktop.createFolder(folderPath);
      if (res?.error) {
        toast.error(`Gagal membuat folder: ${res.error}`);
      } else {
        toast.success(`Folder "${folderName}" berhasil dibuat!`);
        handleRefreshFolder();
      }
    } else {
      toast.info("Pembuatan folder via Explorer membutuhkan Desktop Electron.");
    }
  }, [connectedFolderPath, workspace?.rootPath, handleRefreshFolder]);

  const handleDeletePath = useCallback(async (targetPath: string, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus "${name}"?`)) return;
    const desktop = typeof window !== 'undefined' && (window as any).arunakiDesktop;
    if (desktop?.deletePath) {
      const res = await desktop.deletePath(targetPath);
      if (res?.error) {
        toast.error(`Gagal menghapus: ${res.error}`);
      } else {
        toast.success(`"${name}" telah dihapus.`);
        handleRefreshFolder();
      }
    }
  }, [handleRefreshFolder]);

  const handleRenamePath = useCallback(async (oldPath: string, oldName: string, newName: string) => {
    if (!newName.trim() || oldName === newName) return;
    const desktop = typeof window !== 'undefined' && (window as any).arunakiDesktop;
    if (desktop?.renamePath) {
      const parts = oldPath.replace(/\\/g, '/').split('/');
      parts[parts.length - 1] = newName;
      const newPath = parts.join('/');

      const res = await desktop.renamePath(oldPath, newPath);
      if (res?.error) {
        toast.error(`Gagal mengubah nama: ${res.error}`);
      } else {
        toast.success(`Nama berhasil diubah dari "${oldName}" menjadi "${newName}"!`);
        handleRefreshFolder();
      }
    } else {
      toast.info("Pengubahan nama file/folder via Explorer membutuhkan Desktop Electron.");
    }
  }, [handleRefreshFolder]);

  const handleAnalyzeFile = useCallback((fileName: string) => {
    if (!workspaceId || isAnalyzing) return;
    const goal = `Baca dan analisis file "${fileName}" secara mendalam. Ekstrak data penting, identifikasi informasi utama, dan berikan ringkasan komprehensif.`;
    setPromptInput(goal);
    triggerAutoAnalysis(workspaceId, goal);
  }, [workspaceId, isAnalyzing, triggerAutoAnalysis]);

  const handleAbortAgent = useCallback(async () => {
    if (!workspaceId) return;
    try {
      await fetch(`${API_BASE}/workspaces/${workspaceId}/agent/abort`, { method: "POST" });
      toast.info("Permintaan pembatalan analisis dikirim.");
      setIsAnalyzing(false);
    } catch {
      toast.error("Gagal membatalkan agen.");
    }
  }, [workspaceId]);

  const handleSteerAgent = useCallback(async () => {
    if (!workspaceId || !promptInput.trim() || !isAnalyzing) return;
    const steerMessage = promptInput.trim();
    setPromptInput("");

    try {
      const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/agent/steer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: steerMessage }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`🎯 Mid-Run Steering terkirim: "${steerMessage}"`);
        setAgentSteps((prev) => [
          ...prev,
          {
            type: "thinking",
            label: `🎯 Mid-Run Steering dari Pengguna: "${steerMessage}"`,
            detail: "Agen otonom menerima instruksi tambahan pertengahan alur",
            status: "done",
          },
        ]);
      } else {
        toast.error(`Gagal mengirim steering: ${json.message}`);
      }
    } catch (err: any) {
      toast.error(`Gagal mengirim steering: ${err.message}`);
    }
  }, [workspaceId, promptInput, isAnalyzing]);

  // Periodic Workspace Heartbeat & Background Monitor (Layer 10 & 29 OpenClaw)
  useEffect(() => {
    if (!isConnected || !workspaceId) return;

    const interval = setInterval(async () => {
      const desktop = typeof window !== 'undefined' && (window as any).arunakiDesktop;
      const rootPath = connectedFolderPath || workspace?.rootPath;

      if (desktop?.getFolderTree && rootPath) {
        const scan = await desktop.getFolderTree(rootPath);
        if (scan?.tree) {
          const countFiles = (nodes: any[]): number =>
            nodes.reduce((sum: number, n: any) => sum + (n.type === 'directory' ? countFiles(n.children || []) : 1), 0);
          const currentCount = countFiles(scan.tree);

          if (previousFileCountRef.current > 0 && currentCount > previousFileCountRef.current) {
            const diff = currentCount - previousFileCountRef.current;
            toast.info(`📁 Heartbeat Monitor: Terdeteksi ${diff} file baru di Workspace!`);
            setNativeTree(scan.tree);
            setNativeFileCount(currentCount);
            setHeartbeatAlert(`Heartbeat Monitor: Terdeteksi ${diff} file baru di Workspace. Klik untuk memicu pemindaian ingatan AI.`);
          }
          previousFileCountRef.current = currentCount;
        }
      }
    }, 12000);

    return () => clearInterval(interval);
  }, [isConnected, workspaceId, connectedFolderPath, workspace?.rootPath]);

  const handleSendChat = useCallback(() => {
    if (!isConnected || !promptInput.trim() || isAnalyzing) return;
    const goal = promptInput.trim();
    setPromptInput("");
    triggerAutoAnalysis(workspaceId!, goal);
  }, [isConnected, promptInput, isAnalyzing, workspaceId, triggerAutoAnalysis]);

  const handleDisconnectFolder = () => {
    setIsConnected(false);
    setWorkspaceId(null);
    setAgentSteps([]);
    setAnalysisResult(null);
    setIsAnalyzing(false);
    setNativeTree(null);
    setNativeFileCount(0);
    connectedWsRef.current = null;
    localStorage.removeItem('arunaki_workspace_id');
    setIsModalOpen(true);
  };

  // Use native file count from Electron tree if available, else from API
  const fileCount = nativeTree ? nativeFileCount : files.length;

  const quickPrompts = [
    { icon: BarChart3, text: "Analisis Tren Laporan Keuangan FY24" },
    { icon: FileCode, text: "Ekstrak Klausa & Risiko Kontrak Vendor" },
    { icon: FileText, text: "Buat Ringkasan Eksekutif dari Semua Dokumen" },
    { icon: Search, text: "Bandingkan Invoice & Rekap Pembayaran" },
  ];

  const getStepIcon = (step: AgentStep) => {
    if (step.status === "running") return <Loader2 className="w-3.5 h-3.5 text-gray-500 shrink-0 animate-spin" />;
    if (step.status === "error") return <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />;
    return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
  };

  if (isRestoring) {
    return (
      <div className="flex-1 h-full bg-[#FAFAFA] flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm font-medium">Memuat workspace...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden h-full bg-[#FAFAFA] p-6 lg:p-8 space-y-6 flex flex-col relative min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-white border border-gray-200/90 shadow-2xs flex items-center justify-center text-gray-800 shrink-0">
            <Folder className="w-5 h-5 text-gray-800" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
              {workspace?.name || "Workspace Strategis & Analisis"}
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              {isConnected
                ? `${fileCount} file terhubung dari workspace ini.`
                : "Pusat pengelolaan dokumen korporat, otomatisasi ekstraksi data, dan intelijen berbasis AI."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {!isConnected ? (
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-black text-white hover:bg-gray-800 rounded-xl px-4 py-2.5 text-xs font-semibold shadow-xs cursor-pointer transition-all active:scale-98"
            >
              <Plus className="w-4 h-4" />
              <span>Hubungkan Folder</span>
            </button>
          ) : (
            <button
              onClick={handleDisconnectFolder}
              className="flex items-center gap-2 border border-gray-200/90 bg-white hover:bg-gray-50 rounded-xl px-4 py-2.5 text-xs font-semibold text-gray-700 shadow-2xs cursor-pointer transition-all active:scale-98"
            >
              <FolderCheck className="w-4 h-4 text-emerald-600" />
              <span>Terhubung: {workspace?.name || "Workspace"}</span>
            </button>
          )}

          <button className="flex items-center gap-2 border border-gray-200/90 bg-white hover:bg-gray-50 rounded-xl px-4 py-2.5 text-xs font-semibold text-gray-800 shadow-2xs cursor-pointer transition-all active:scale-98">
            <Settings className="w-4 h-4 text-gray-600" />
            <span>Kelola Workspace</span>
          </button>
        </div>
      </div>

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        {/* Left - Chat Area */}
        <div className="lg:col-span-8 flex flex-col h-full space-y-6 min-h-[550px] min-w-0">
          <div className="bg-white rounded-2xl border border-gray-200/90 p-6 shadow-2xs flex-1 flex flex-col justify-between space-y-6 overflow-hidden min-w-0">
            {/* Top Header */}
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <MessageSquare className="w-5 h-5 text-gray-900" />
                <h3 className="font-bold text-base text-gray-900">Asisten Intelijen Arunaki AI</h3>
              </div>

              {isConnected && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {fileCount} Dokumen Aktif
                </span>
              )}
            </div>

            {/* Middle Message Area */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 min-w-0 py-2">
              {!isConnected ? (
                <div className="bg-[#F8F9FA] border border-gray-200/70 rounded-2xl p-6 text-xs sm:text-sm text-gray-700 space-y-3.5 max-w-2xl">
                  <div className="flex items-center gap-2 text-gray-900 font-bold text-base sm:text-lg">
                    <span>Selamat Datang di Workspace Arunaki!</span>
                  </div>
                  <p className="text-gray-600 leading-relaxed">
                    Belum ada direktori folder yang terhubung ke workspace ini. Hubungkan folder bisnis Anda untuk mulai mengindeks dokumen, menganalisis risiko, serta mengekstrak informasi secara otomatis.
                  </p>
                  <div className="pt-2">
                    <button
                      onClick={() => setIsModalOpen(true)}
                      className="inline-flex items-center gap-2 bg-black text-white hover:bg-gray-800 px-5 py-3 rounded-xl text-xs font-semibold cursor-pointer transition-all shadow-xs active:scale-98"
                    >
                      <Folder className="w-4 h-4" />
                      <span>Hubungkan Folder Sekarang</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 max-w-2xl animate-fade-in overflow-hidden min-w-0">
                  {/* Proactive Heartbeat Alert Banner */}
                  {heartbeatAlert && (
                    <div className="bg-amber-50 border border-amber-200/90 rounded-2xl p-4 flex items-center justify-between gap-3 text-xs text-amber-900 shadow-2xs animate-in fade-in duration-200">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Activity className="w-4 h-4 text-amber-600 animate-pulse shrink-0" />
                        <span className="font-medium truncate">{heartbeatAlert}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setHeartbeatAlert(null);
                            if (workspaceId) triggerAutoAnalysis(workspaceId, "Lakukan pemindaian cepat terhadap file/dokumen baru yang ditambahkan di workspace.");
                          }}
                          className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                        >
                          Pindai Dokumen Baru
                        </button>
                        <button
                          type="button"
                          onClick={() => setHeartbeatAlert(null)}
                          className="text-amber-500 hover:text-amber-700 p-1"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Agent Progress */}
                  {agentSteps.length > 0 && (
                    <div className="bg-[#F8F9FA] border border-gray-100 rounded-2xl p-5 space-y-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {isAnalyzing ? (
                            <Loader2 className="w-4 h-4 text-gray-600 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          )}
                          <span className="text-sm font-bold text-gray-900">
                            {isAnalyzing ? "AI sedang menganalisis dokumen..." : "Analisis Selesai"}
                          </span>
                        </div>

                        {isAnalyzing && (
                          <button
                            type="button"
                            onClick={handleAbortAgent}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs bg-red-50 hover:bg-red-100 text-red-700 rounded-lg border border-red-200 font-medium transition-colors cursor-pointer"
                          >
                            <Square className="w-3 h-3 text-red-600 fill-red-600" />
                            <span>Hentikan AI</span>
                          </button>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        {agentSteps.map((step, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs">
                            {getStepIcon(step)}
                            <div className="min-w-0 flex-1 break-words">
                              <span className="text-gray-700 font-medium">{step.label}</span>
                              {step.detail && (
                                <span className="text-gray-500 ml-1.5 block break-words">{step.detail}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Analysis Result */}
                  {analysisResult && (
                    <div className="bg-[#F8F9FA] border border-gray-100 rounded-2xl p-5 text-xs sm:text-sm text-gray-800 space-y-2 overflow-hidden min-w-0">
                      <p className="font-bold text-gray-900 text-base">Hasil Analisis AI</p>
                      <div className="text-gray-600 leading-relaxed whitespace-pre-wrap break-words" style={{ overflowWrap: 'anywhere' }}>{analysisResult}</div>
                    </div>
                  )}

                  {/* Waiting / connected but no analysis yet */}
                  {!isAnalyzing && agentSteps.length === 0 && (
                    <div className="bg-[#F8F9FA] border border-gray-100 rounded-2xl p-5 text-xs sm:text-sm text-gray-800 space-y-3.5">
                      <p className="font-bold text-gray-900 text-base">Workspace Berhasil Diinisialisasi!</p>
                      <p className="text-gray-600 leading-relaxed">
                        AI akan segera membaca dan menganalisis <strong className="font-semibold text-gray-900">{fileCount} berkas</strong> dari direktori terhubung ({workspace?.name}).
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="space-y-4 pt-2 shrink-0 border-t border-gray-100">
              <div className={`flex flex-wrap gap-2 transition-opacity ${!isConnected ? "opacity-50 pointer-events-none" : ""}`}>
                {quickPrompts.map((prompt, idx) => {
                  const IconComponent = prompt.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => isConnected && setPromptInput(prompt.text)}
                      disabled={!isConnected}
                      className="border border-gray-200/90 bg-white hover:bg-gray-50 px-3.5 py-2 rounded-xl text-xs text-gray-700 font-medium flex items-center gap-2 cursor-pointer transition-all shadow-2xs active:scale-98"
                    >
                      <IconComponent className="w-3.5 h-3.5 text-gray-500" />
                      <span>{prompt.text}</span>
                    </button>
                  );
                })}
              </div>

              <div>
                <div className={`bg-white border border-gray-200 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-xs focus-within:border-gray-300 focus-within:shadow-sm transition-all ${!isConnected ? "bg-gray-50/50" : ""}`}>
                  <div className="flex items-center gap-2 pl-1">
                    <button disabled={!isConnected} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40" title="Lampirkan Dokumen">
                      <Paperclip className="w-4.5 h-4.5" />
                    </button>
                    <button disabled={!isConnected} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40" title="Filter Parameter Analisis">
                      <SlidersHorizontal className="w-4.5 h-4.5" />
                    </button>
                    <button disabled={!isConnected} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40" title="Mode Analisis Mendalam AI">
                      <Sparkles className="w-4.5 h-4.5" />
                    </button>
                  </div>

                  <input
                    type="text"
                    value={promptInput}
                    disabled={!isConnected}
                    onChange={(e) => setPromptInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (isAnalyzing) handleSteerAgent();
                        else handleSendChat();
                      }
                    }}
                    placeholder={
                      !isConnected
                        ? "Hubungkan folder direktori terlebih dahulu untuk mulai bertanya..."
                        : isAnalyzing
                        ? "🎯 Kirim arahan/instruksi tambahan (Mid-Run Steering) ke agen..."
                        : "Tanyakan analisis dokumen, korelasi data, atau draf laporan bisnis..."
                    }
                    className="flex-1 bg-transparent border-none outline-none text-xs sm:text-sm text-gray-900 placeholder:text-gray-400 focus:ring-0 px-2 disabled:cursor-not-allowed"
                  />

                  {isAnalyzing ? (
                    <button
                      type="button"
                      onClick={handleSteerAgent}
                      disabled={!promptInput.trim()}
                      className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Kirim Mid-Run Steering ke Agen AI"
                    >
                      <Compass className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '4s' }} />
                      <span>Steer AI</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleSendChat}
                      disabled={!isConnected || !promptInput.trim()}
                      className="w-10 h-10 rounded-full bg-black text-white hover:bg-gray-800 flex items-center justify-center shrink-0 cursor-pointer transition-colors shadow-xs disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ArrowUp className="w-4.5 h-4.5" />
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-gray-400 text-center mt-2.5">
                  Arunaki AI memproses dokumen secara terenkripsi. Selalu verifikasi data krusial sebelum pengambilan keputusan.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="lg:col-span-4 space-y-6 flex flex-col">
          {/* Ringkasan */}
          <div className="bg-white rounded-2xl border border-gray-200/90 p-5 space-y-3 shadow-2xs">
            <h3 className="font-bold text-sm sm:text-base text-gray-900">Ringkasan Direktori Dokumen</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              {!isConnected
                ? "Belum ada dokumen yang terhubung. Klik tombol Hubungkan Folder untuk mengaktifkan ringkasan dan ekstraksi data otomatis."
                : isAnalyzing
                ? `AI sedang membaca ${fileCount} file dari "${workspace?.name}"...`
                : analysisResult
                ? `AI telah selesai menganalisis ${fileCount} file dari "${workspace?.name}".`
                : `Workspace "${workspace?.name}" memiliki ${fileCount} file yang siap dianalisis oleh AI.`}
            </p>
          </div>

          {/* Struktur Folder */}
          <div className="flex-1 min-h-0 flex flex-col">
            {!isConnected ? (
              <div className="bg-white rounded-2xl border border-gray-200/90 p-5 shadow-2xs">
                <h3 className="font-bold text-sm sm:text-base text-gray-900 mb-2">Struktur Folder</h3>
                <p className="text-xs text-gray-500">Hubungkan folder untuk melihat struktur direktori.</p>
              </div>
            ) : (
              <div className="flex-1 min-h-[360px]">
                <FileTree
                  files={files.map((f: any) => ({ id: f.id, name: f.name, type: f.type, size: f.size }))}
                  workspaceName={workspace?.name || "Workspace"}
                  workspaceFolderPath={connectedFolderPath || workspace?.rootPath}
                  nativeTree={nativeTree ?? undefined}
                  onRefresh={handleRefreshFolder}
                  onCreateFile={handleCreateFile}
                  onCreateFolder={handleCreateFolder}
                  onDeletePath={handleDeletePath}
                  onRenamePath={handleRenamePath}
                  onAnalyzeFile={handleAnalyzeFile}
                />
              </div>
            )}
          </div>

          {/* Card C: Log Aktivitas */}
          <div className="bg-white rounded-2xl border border-gray-200/90 p-5 space-y-3.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm sm:text-base text-gray-900">Log Aktivitas Terakhir</h3>
            </div>

            <div className="space-y-2.5 pt-1">
              {!isConnected ? (
                <div className="flex items-center justify-between text-xs py-1">
                  <div className="flex items-center gap-2.5 text-gray-700 min-w-0 flex-1">
                    <Info className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="truncate font-medium">Workspace siap untuk pengindeksan awal</span>
                  </div>
                  <span className="text-[11px] text-gray-400 shrink-0 ml-2 font-mono">-</span>
                </div>
              ) : isAnalyzing ? (
                <div className="flex items-center justify-between text-xs py-1">
                  <div className="flex items-center gap-2.5 text-gray-700 min-w-0 flex-1">
                    <Loader2 className="w-3.5 h-3.5 text-gray-500 shrink-0 animate-spin" />
                    <span className="truncate font-medium">AI sedang membaca dokumen...</span>
                  </div>
                  <span className="text-[11px] text-gray-400 shrink-0 ml-2 font-mono">proses</span>
                </div>
              ) : files.length === 0 ? (
                <div className="flex items-center justify-between text-xs py-1">
                  <div className="flex items-center gap-2.5 text-gray-700 min-w-0 flex-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="truncate font-medium">Folder sedang dibuka...</span>
                  </div>
                  <span className="text-[11px] text-gray-400 shrink-0 ml-2 font-mono">-</span>
                </div>
              ) : (
                files.slice(0, 5).map((file: any) => {
                  const ext = file.name.split(".").pop()?.toLowerCase() || "";
                  const Icon = ["xlsx", "xls", "csv"].includes(ext)
                    ? FileSpreadsheet
                    : ["docx", "doc"].includes(ext)
                    ? FileCode
                    : ShieldCheck;
                  return (
                    <div key={file.id} className="flex items-center justify-between text-xs py-1">
                      <div className="flex items-center gap-2.5 text-gray-700 min-w-0 flex-1">
                        <Icon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="truncate font-medium">{file.name}</span>
                      </div>
                      <span className="text-[11px] text-gray-400 shrink-0 ml-2 font-mono">terbuka</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* POPUP MODAL: Folder Connection Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl border border-gray-200/90 shadow-2xl w-full max-w-lg p-6 sm:p-8 flex flex-col items-center justify-center relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="bg-[#F8F9FA] rounded-2xl p-6 sm:p-8 w-full flex flex-col items-center text-center gap-4 mb-6 border border-gray-100 mt-2">
              <Folder className="w-16 h-16 text-gray-900 stroke-[1.5]" />
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-1.5">
                  Buka Folder
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 leading-relaxed max-w-xs mx-auto">
                  Pilih folder di komputer Anda. Nama workspace diambil dari nama folder.
                </p>
              </div>

              <button
                onClick={handleConnectFolder}
                disabled={isCreating}
                className="w-full py-3 bg-black text-white hover:bg-gray-800 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 shadow-xs"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menghubungkan...</span>
                  </>
                ) : (
                  <>
                    <Folder className="w-4 h-4" />
                    <span>Pilih Folder di Komputer</span>
                  </>
                )}
              </button>

              <div className="relative w-full my-1">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-[#F8F9FA] px-2 text-gray-400 font-medium">atau buat nama manual</span></div>
              </div>

              <form onSubmit={handleCreateManual} className="w-full flex gap-2">
                <input
                  type="text"
                  placeholder="Nama workspace (cth: Laporan Keuangan)"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-hidden focus:border-gray-900"
                />
                <button
                  type="submit"
                  disabled={isCreating || !customName.trim()}
                  className="px-4 py-2.5 bg-gray-900 text-white hover:bg-gray-800 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-40 transition-all shrink-0"
                >
                  Buat
                </button>
              </form>

              <input
                ref={fileInputRef}
                type="file"
                // @ts-expect-error directory & webkitdirectory not in React types
                directory=""
                webkitdirectory=""
                multiple
                className="hidden"
                onChange={handleFilesSelected}
              />
            </div>

            <button
              onClick={() => setIsModalOpen(false)}
              className="text-xs text-gray-400 hover:text-gray-600 font-medium cursor-pointer pt-4"
            >
              Nanti saja
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
