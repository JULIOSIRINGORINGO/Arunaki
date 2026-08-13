import { useState, useEffect, useCallback } from "react";
import { Clock, Plus, Play, Trash2, Calendar, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { API_BASE, apiFetch } from "../../lib/api";

interface ScheduledReport {
  id: string;
  name: string;
  reportType: string;
  cronExpr: string;
  format: string;
  active: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
}

interface ScheduledReportsPanelProps {
  workspaceId: string;
}

export function ScheduledReportsPanel({ workspaceId }: ScheduledReportsPanelProps) {
  const [schedules, setSchedules] = useState<ScheduledReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);

  // New Schedule Form State
  const [name, setName] = useState("");
  const [reportType, setReportType] = useState("laba_rugi");
  const [frequency, setFrequency] = useState("daily");
  const [format, setFormat] = useState("excel");

  const fetchSchedules = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const res = await apiFetch(`${API_BASE}/workspaces/${workspaceId}/schedules`);
      const data = await res.json();
      setSchedules(data.data || []);
    } catch (err) {
      console.error("Failed to fetch schedules:", err);
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      const res = await apiFetch(`${API_BASE}/workspaces/${workspaceId}/schedules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          reportType,
          cronExpr: frequency === "daily" ? "0 17 * * *" : frequency === "weekly" ? "0 17 * * 5" : "0 17 1 * *",
          format,
        }),
      });

      if (res.ok) {
        toast.success(`Report schedule "${name}" added successfully!`);
        setIsModalOpen(false);
        setName("");
        fetchSchedules();
      } else {
        toast.error("Failed to add report schedule");
      }
    } catch {
      toast.error("Failed to connect to server");
    }
  };

  const handleToggle = async (id: string) => {
    try {
      const res = await apiFetch(`${API_BASE}/workspaces/${workspaceId}/schedules/${id}/toggle`, {
        method: "PATCH",
      });
      if (res.ok) {
        fetchSchedules();
      }
    } catch {
      toast.error("Failed to toggle schedule status");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await apiFetch(`${API_BASE}/workspaces/${workspaceId}/schedules/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Schedule deleted");
        fetchSchedules();
      }
    } catch {
      toast.error("Failed to delete schedule");
    }
  };

  const handleManualRun = async (id: string, reportName: string) => {
    setRunningId(id);
    try {
      const res = await apiFetch(`${API_BASE}/workspaces/${workspaceId}/schedules/${id}/run`, {
        method: "POST",
      });
      if (res.ok) {
        toast.success(`Report "${reportName}" generated & saved to Studio Artifact Store!`);
        fetchSchedules();
      } else {
        toast.error("Failed to generate report");
      }
    } catch {
      toast.error("Failed to connect to server");
    } finally {
      setRunningId(null);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "Never";
    try {
      return new Date(dateStr).toLocaleString("en-US", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="bg-white border border-surface-200 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between border-b border-surface-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-accent/10 text-accent">
            <Clock size={16} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-surface-900 tracking-tight">
              Automatic Report Scheduling (Proactive Cron)
            </h3>
            <p className="text-[11px] text-surface-500">
              Background automation for RUG, Income Statement, & Balance Sheet reports
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
        >
          <Plus size={13} />
          <span>Add Schedule</span>
        </button>
      </div>

      {loading ? (
        <div className="py-6 text-center text-xs text-surface-400 animate-pulse">
          Loading report schedules...
        </div>
      ) : schedules.length === 0 ? (
        <div className="py-6 text-center space-y-1.5">
          <Calendar className="w-6 h-6 text-surface-300 mx-auto" />
          <p className="text-xs font-medium text-surface-500">No automatic report schedules yet</p>
          <p className="text-[11px] text-surface-400">
            Click "Add Schedule" to schedule recurring report generation.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {schedules.map((sch) => (
            <div
              key={sch.id}
              className="flex items-center justify-between p-3 rounded-lg bg-surface-50 border border-surface-200 text-xs"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-surface-900">{sch.name}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-surface-200 text-surface-700 uppercase">
                    {sch.reportType.replace("_", " ")}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800">
                    {sch.format.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-surface-500">
                  <span>Last run: <strong>{formatDate(sch.lastRunAt)}</strong></span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleManualRun(sch.id, sch.name)}
                  disabled={runningId === sch.id}
                  title="Run Report Now (Instant Test)"
                  className="px-2.5 py-1.5 bg-accent/15 hover:bg-accent/25 text-accent rounded-md text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  {runningId === sch.id ? (
                    <RefreshCw size={12} className="animate-spin" />
                  ) : (
                    <Play size={12} />
                  )}
                  <span>Run</span>
                </button>
                <button
                  onClick={() => handleToggle(sch.id)}
                  className={`p-1.5 rounded-md transition-colors ${
                    sch.active ? "text-emerald-600 hover:bg-emerald-50" : "text-surface-400 hover:bg-surface-200"
                  }`}
                  title={sch.active ? "Active (click to deactivate)" : "Inactive (click to activate)"}
                >
                  {sch.active ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                </button>
                <button
                  onClick={() => handleDelete(sch.id)}
                  className="p-1.5 rounded-md text-surface-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  title="Delete Schedule"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Schedule Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-surface-200 rounded-xl shadow-xl w-full max-w-md p-5 space-y-4">
            <h3 className="text-sm font-bold text-surface-900 border-b border-surface-100 pb-2">
              Add Automatic Report Schedule
            </h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-surface-700 mb-1">Report Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Example: Weekly Income Statement Report"
                  className="w-full px-3 py-2 border border-surface-300 rounded-lg text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-surface-700 mb-1">Report Type</label>
                  <select
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value)}
                    className="w-full px-3 py-2 border border-surface-300 rounded-lg text-xs"
                  >
                    <option value="laba_rugi">Income Statement</option>
                    <option value="rug">RUG (Business Summary)</option>
                    <option value="neraca">Balance Sheet</option>
                    <option value="stok">Stock Recap</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-surface-700 mb-1">Cron Frequency</label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    className="w-full px-3 py-2 border border-surface-300 rounded-lg text-xs"
                  >
                    <option value="daily">Daily (5:00 PM)</option>
                    <option value="weekly">Weekly (Friday)</option>
                    <option value="monthly">Monthly (1st)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-surface-700 mb-1">Output Format</label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  className="w-full px-3 py-2 border border-surface-300 rounded-lg text-xs"
                >
                  <option value="excel">Excel (.xlsx)</option>
                  <option value="pdf">PDF Document (.pdf)</option>
                  <option value="csv">CSV Spreadsheet (.csv)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-surface-600 hover:bg-surface-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-semibold hover:bg-gray-800"
                >
                  Save Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
