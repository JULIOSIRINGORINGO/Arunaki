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
  ChevronRight,
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

export interface StepItem {
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
    if (!active) return;
    setWaitingSec(0);
    const start = Date.now();
    const t = setInterval(() => setWaitingSec(Math.max(1, Math.floor((Date.now() - start) / 1000))), 1000);
    return () => clearInterval(t);
  }, [active]);

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
  const toolSteps = steps.filter((s) => s.iconType === 'tool');
  const hasToolExecution = toolSteps.length > 0;

  // Antigravity style: If no tools are being executed (simple text response / thinking),
  // show only a subtle minimal indicator while waiting for tokens, not a big task card!
  if (!hasToolExecution) {
    if (status.type === 'text_delta') {
      return null;
    }
    return (
      <div className="flex items-center gap-2 py-1 px-2.5 rounded-md bg-[var(--bg-panel)] border border-[var(--border-color)] text-xs text-[var(--text-muted)] animate-pulse font-sans max-w-fit select-none my-1">
        <Sparkles size={12} className="text-amber-500/80 shrink-0" />
        <span className="text-[11px] text-[var(--text-muted)]">Thinking... ({waitingSec}s)</span>
      </div>
    );
  }

  const summaryHeader = `Executing ${toolSteps.length} document task${toolSteps.length > 1 ? 's' : ''}`;

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
    if (t.includes("read") || t.includes("file") || t.includes("search")) return <FileSearch size={12} className="text-[var(--text-muted)] shrink-0 mt-0.5" />;
    if (t.includes("browser")) return <Globe size={12} className="text-indigo-500 shrink-0 mt-0.5" />;
    if (t.includes("screenshot")) return <Camera size={12} className="text-purple-500 shrink-0 mt-0.5" />;
    if (t.includes("key")) return <Keyboard size={12} className="text-[var(--text-muted)] shrink-0 mt-0.5" />;
    return <Monitor size={12} className="text-[var(--text-muted)] shrink-0 mt-0.5" />;
  };

  return (
    <div className="my-2 rounded-lg bg-[var(--bg-panel)] border border-[var(--border-color)] text-[var(--text-primary)] font-mono text-[11px] overflow-hidden animate-fade-in max-w-sm select-none">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-1.5 bg-[var(--bg-panel-sub)] hover:bg-[var(--bg-hover)] transition-colors border-b border-[var(--border-color)] cursor-pointer text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Loader2 size={12} className="animate-spin text-[var(--text-muted)] shrink-0" />
          <span className="font-semibold text-[var(--text-primary)] truncate">{summaryHeader}</span>
          <span className="text-[10px] text-[var(--text-dim)] shrink-0">
            ({completedCount > 0 ? `${completedCount} done · ` : ''}{waitingSec}s)
          </span>
        </div>
        <div className="flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] shrink-0">
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
              Working... ({waitingSec}s)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Persisted Antigravity / Cursor IDE style collapsible thought/execution badge.
 * Rendered directly above assistant chat messages in the history.
 */
export function MessageThoughtBadge({
  steps = [],
  thoughtSec = 1,
}: {
  steps?: StepItem[];
  thoughtSec?: number;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const toolSteps = steps.filter((s) => s.iconType === 'tool' || s.toolName);
  const hasToolExecution = toolSteps.length > 0;

  if (hasToolExecution) {
    return (
      <div className="mb-2 max-w-full w-full min-w-0 font-mono text-[11px] rounded-lg bg-[var(--bg-panel)] border border-[var(--border-color)] overflow-hidden select-none">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between px-2.5 py-1 bg-[var(--bg-panel-sub)] hover:bg-[var(--bg-hover)] transition-colors border-b border-[var(--border-color)] cursor-pointer text-left"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <Check size={12} className="text-emerald-500 shrink-0" />
            <span className="font-semibold text-[var(--text-primary)] truncate">
              Executed {toolSteps.length} document task{toolSteps.length > 1 ? 's' : ''}
            </span>
            <span className="text-[10px] text-[var(--text-dim)] shrink-0">
              ({steps.length} step{steps.length > 1 ? 's' : ''}{thoughtSec ? ` · ${thoughtSec}s` : ''})
            </span>
          </div>
          <div className="flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] shrink-0">
            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </div>
        </button>

        {isExpanded && (
          <div className="px-2.5 py-2 space-y-1.5 bg-[var(--bg-panel)] max-w-full overflow-hidden">
            {steps.map((step, idx) => (
              <div key={step.id || idx} className="flex items-start gap-1.5 text-[var(--text-secondary)] min-w-0">
                <Check size={11} className="text-emerald-500 mt-0.5 shrink-0" />
                <span className="truncate max-w-full text-[var(--text-muted)]">
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // If there are no tool steps, do not render an empty badge (Antigravity parity: pure chat shows clean text bubble)
  if (steps.length === 0) {
    return null;
  }

  // Pure Thought Reasoning (when steps exist)
  return (
    <div className="mb-2 font-sans select-none max-w-full min-w-0">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] px-2 py-0.5 rounded-md hover:bg-[var(--bg-hover)] transition-colors cursor-pointer border border-transparent hover:border-[var(--border-color)]"
      >
        <span>Thought for {thoughtSec || 1}s</span>
        {isExpanded ? (
          <ChevronDown size={12} className="text-[var(--text-muted)]" />
        ) : (
          <ChevronRight size={12} className="text-[var(--text-muted)]" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-1 p-2.5 rounded-lg bg-[var(--bg-panel)] border border-[var(--border-color)] text-[11px] text-[var(--text-muted)] leading-relaxed max-w-full min-w-0 font-sans break-words [overflow-wrap:anywhere]">
          <div className="space-y-1">
            {steps.map((s, i) => (
              <div key={s.id || i} className="flex items-center gap-1.5 min-w-0">
                <Check size={10} className="text-emerald-500 shrink-0" />
                <span className="truncate max-w-full">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
