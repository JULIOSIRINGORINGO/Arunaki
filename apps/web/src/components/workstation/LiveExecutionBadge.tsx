import { useState, useEffect } from "react";
import {
  Monitor,
  Camera,
  Globe,
  Loader2,
  FileSpreadsheet,
  FileText,
  Keyboard,
  Sparkles,
  Cpu,
  ChevronDown,
  ChevronUp,
  Check,
  Database,
  FileSearch,
} from "lucide-react";

export interface LiveStatusData {
  type?: 'thinking' | 'tool_start' | 'tool_live_status' | 'tool_done' | 'text_delta';
  toolName?: string;
  preview?: string;
  screenshot?: string;
  timestamp?: string;
}

interface StepItem {
  id: string;
  label: string;
  status: 'completed' | 'running';
  iconType: 'thinking' | 'tool' | 'text';
  toolName?: string;
}

interface LiveExecutionBadgeProps {
  status: LiveStatusData | null;
  active?: boolean;
}

export function LiveExecutionBadge({ status, active = true }: LiveExecutionBadgeProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [steps, setSteps] = useState<StepItem[]>([]);
  const [waitingSec, setWaitingSec] = useState(0);

  useEffect(() => {
    if (!status || !active) return;
    if (status.type !== 'thinking') {
      setWaitingSec(0);
      return;
    }
    setWaitingSec(0);
    const start = Date.now();
    const t = setInterval(() => setWaitingSec(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(t);
  }, [status?.type, status?.toolName, active]);

  useEffect(() => {
    if (!status) {
      setSteps([]);
      return;
    }

    const type = status.type || (status.toolName ? 'tool_start' : 'thinking');
    const toolName = status.toolName || '';
    const preview = status.preview || '';

    setSteps((prev) => {
      let label = "Analyzing";
      let iconType: 'thinking' | 'tool' | 'text' = 'thinking';

      if (type === 'thinking') {
        label = preview ? preview : "Analyzing request...";
        iconType = 'thinking';
      } else if (type === 'tool_start' || type === 'tool_live_status') {
        iconType = 'tool';
        const displayTool = toolName ? toolName : 'desktop_action';
        const detail = preview ? ` → ${preview}` : '';
        label = `Executing: ${displayTool}${detail}`;
      } else if (type === 'text_delta') {
        label = preview ? preview : "Generating response...";
        iconType = 'text';
      }

      // Avoid duplicate consecutive identical step labels
      const last = prev[prev.length - 1];
      if (last && last.label === label) {
        return prev;
      }

      // Mark all previous steps as completed
      const updatedPrev = prev.map((s) => ({ ...s, status: 'completed' as const }));
      return [
        ...updatedPrev,
        {
          id: `${Date.now()}-${Math.random()}`,
          label,
          status: 'running',
          iconType,
          toolName,
        },
      ];
    });
  }, [status?.type, status?.toolName, status?.preview]);

  if (!status || !active || steps.length === 0) return null;

  const completedCount = steps.filter((s) => s.status === 'completed').length;
  const hasToolExecution = steps.some((s) => s.iconType === 'tool');
  const summaryHeader = hasToolExecution
    ? `Executing ${steps.length} document task${steps.length > 1 ? 's' : ''}`
    : `Processing instruction...`;

  const renderStepIcon = (step: StepItem) => {
    if (step.iconType === 'thinking') {
      return <Sparkles size={12} className="text-zinc-400 shrink-0 mt-0.5" />;
    }
    if (step.iconType === 'text') {
      return <Cpu size={12} className="text-emerald-400 shrink-0 mt-0.5" />;
    }
    const t = (step.toolName || '').toLowerCase();
    if (t.includes("excel")) return <FileSpreadsheet size={12} className="text-emerald-400 shrink-0 mt-0.5" />;
    if (t.includes("word")) return <FileText size={12} className="text-blue-400 shrink-0 mt-0.5" />;
    if (t.includes("knowledge") || t.includes("memory")) return <Database size={12} className="text-amber-500 shrink-0 mt-0.5" />;
    if (t.includes("read") || t.includes("file")) return <FileSearch size={12} className="text-[var(--text-muted)] shrink-0 mt-0.5" />;
    if (t.includes("browser")) return <Globe size={12} className="text-indigo-500 shrink-0 mt-0.5" />;
    if (t.includes("screenshot")) return <Camera size={12} className="text-purple-500 shrink-0 mt-0.5" />;
    if (t.includes("key")) return <Keyboard size={12} className="text-[var(--text-muted)] shrink-0 mt-0.5" />;
    return <Monitor size={12} className="text-[var(--text-muted)] shrink-0 mt-0.5" />;
  };

  return (
    <div className="my-2 rounded-lg bg-[var(--bg-panel)] border border-[var(--border-color)] text-[var(--text-primary)] font-mono text-[11px] overflow-hidden animate-fade-in max-w-sm">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-1.5 bg-[var(--bg-panel-sub)] hover:bg-[var(--bg-hover)] transition-colors border-b border-[var(--border-color)] cursor-pointer text-left"
      >
        <div className="flex items-center gap-2">
          <Loader2 size={12} className="animate-spin text-[var(--text-muted)]" />
          <span className="font-semibold text-[var(--text-primary)]">{summaryHeader}</span>
          {completedCount > 0 && (
            <span className="text-[10px] text-[var(--text-dim)]">({completedCount} done)</span>
          )}
        </div>
        <div className="flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </div>
      </button>

      {/* Expanded Trace List */}
      {isExpanded && (
        <div className="px-3 py-2 space-y-1.5 bg-[var(--bg-panel)]">
          {steps.map((step) => {
            const isCompleted = step.status === 'completed';
            return (
              <div key={step.id} className="flex items-start gap-2 text-[var(--text-secondary)]">
                {isCompleted ? (
                  <Check size={12} className="text-emerald-500 mt-0.5 shrink-0" />
                ) : (
                  renderStepIcon(step)
                )}
                <span
                  className={`truncate max-w-[260px] ${
                    isCompleted ? "text-[var(--text-dim)]" : "text-[var(--text-primary)] font-medium"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
          <div className="pt-1 flex items-center gap-1.5 text-[var(--text-dim)] text-[10px]">
            <span className="animate-pulse">
              {status.type === 'thinking' ? `Working... ${waitingSec}s` : 'Working...'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
